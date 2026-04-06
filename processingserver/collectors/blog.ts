// collectors/blog.ts
const puppeteer = require("puppeteer");
const prisma = require("../lib/prisma");

export async function collectBlogs(queryId: string, query: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
  );

  // block images/fonts to load faster
  await page.setRequestInterception(true);
  page.on("request", (req:any) => {
    if (["image", "font", "stylesheet", "media"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // Step 1: search substack
  await page.goto(
    `https://substack.com/search/${encodeURIComponent(query)}?searching=posts`,
    { waitUntil: "networkidle2", timeout: 30000 }
  );

  // scroll to load more results
  await page.evaluate(() => window.scrollBy(0, 1500));
  await new Promise((r) => setTimeout(r, 2000));

  // grab top 5 post URLs
  const postUrls = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    const seen = new Set<string>();
    const results: string[] = [];
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href;
      if (!seen.has(href)) {
        seen.add(href);
        results.push(href);
      }
      if (results.length >= 5) break;
    }
    return results;
  });

  // Step 2: scrape each post
  const posts = [];
  for (const url of postUrls) {
    await new Promise((r) => setTimeout(r, 1500)); // polite delay

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.evaluate(() => window.scrollBy(0, 2000));

      const data = await page.evaluate((postUrl:any) => {
        const title =
          document.querySelector("h1.post-title, h1")?.textContent?.trim() ?? "";

        const author =
          document.querySelector("[class*='author-name']")?.textContent?.trim() ??
          document.querySelector('meta[name="author"]')?.getAttribute("content") ?? "";

        const contentEl = document.querySelector(
          ".available-content, .post-content, article"
        );
        const content = contentEl
          ? Array.from(contentEl.querySelectorAll("p, h2, h3"))
              .map((el) => el.textContent?.trim())
              .filter((t) => t && t.length > 20)
              .join("\n\n")
              .slice(0, 10000)
          : "";

        const publishedAt =
          document.querySelector("time")?.getAttribute("datetime") ??
          new Date().toISOString();

        return { title, author, url: postUrl, content, publishedAt };
      }, url);

      if (data.title || data.content) posts.push(data);
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err);
    }
  }

  await browser.close();

  await prisma.rawData.createMany({
    data: posts.map((p) => ({
      queryId,
      source:  "BLOG",
      status:  "UNPROCESSED",
      payload: p,
    })),
  });

  return posts;
}