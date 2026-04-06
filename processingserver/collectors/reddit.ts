// collectors/reddit.ts
const axios = require("axios");
const prisma = require("../lib/prisma");

async function getAccessToken() {
  const res = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    "grant_type=client_credentials",
    {
      auth: {
        username: process.env.REDDIT_CLIENT_ID!,
        password: process.env.REDDIT_CLIENT_SECRET!,
      },
      headers: { "User-Agent": process.env.REDDIT_USER_AGENT! },
    }
  );
  return res.data.access_token;
}

export async function collectReddit(queryId: string, query: string) {
  const token = await getAccessToken();

  const res = await axios.get("https://oauth.reddit.com/search.json", {
    params: { q: query, sort: "relevance", limit: 5, type: "link" },
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT!,
    },
  });

  const posts = res.data.data.children.map((c: any) => ({
    id:          c.data.id,
    title:       c.data.title,
    subreddit:   c.data.subreddit,
    author:      c.data.author,
    score:       c.data.score,
    url:         `https://reddit.com${c.data.permalink}`,
    body:        c.data.selftext ?? "",
    numComments: c.data.num_comments,
    createdAt:   new Date(c.data.created_utc * 1000).toISOString(),
  }));

  await prisma.rawData.createMany({
    data: posts.map((post: any) => ({
      queryId,
      source:  "REDDIT",
      status:  "UNPROCESSED",
      payload: post,
    })),
  });

  return posts;
}