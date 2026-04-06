// index.ts
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const prisma = require("./lib/prisma");
const collectReddit = require("./collectors/reddit");
const collectYoutube = require("./collectors/youtube");
const collectBlogs = require("./collectors/blog");

const app = express();
app.use(express.json());

// POST /process
// Called by your primary server when a new search query comes in
// Body: { query: string }

app.post("/process", async (req:any, res:any) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }
  // 1. create or find the SearchQuery row
  const searchQuery = await prisma.searchQuery.upsert({
    where:  { query },
    update: {},
    create: { query },
  });
  // immediately tell the primary server "we're on it"
  res.json({ queryId: searchQuery.id, status: "processing" });

  // 2. run all 3 collectors in parallel (after responding)
  console.log(`\n🚀 Running collectors for: "${query}"`);

  const [reddit, youtube, blogs] = await Promise.allSettled([
    collectReddit(searchQuery.id, query),
    collectYoutube(searchQuery.id, query),
    collectBlogs(searchQuery.id, query),
  ]);

  console.log("✅ Reddit  →", reddit.status  === "fulfilled" ? `${reddit.value.length} posts`   : "failed: " + reddit.reason);
  console.log("✅ YouTube →", youtube.status === "fulfilled" ? `${youtube.value.length} videos` : "failed: " + youtube.reason);
  console.log("✅ Blogs   →", blogs.status   === "fulfilled" ? `${blogs.value.length} posts`    : "failed: " + blogs.reason);

  // 3. TODO: send queryId to Kafka / filtering server here
  // await notifyFilteringServer(searchQuery.id, query)
});

// GET /status/:queryId
// Primary server can poll this to check if results are ready

app.get("/status/:queryId", async (req:any, res:any) => {
  const { queryId } = req.params;

  const result = await prisma.processedResult.findUnique({
    where: { queryId },
  });

  if (result) {
    return res.json({ status: "done", result });
  }

  const rawCount = await prisma.rawData.count({ where: { queryId } });

  res.json({
    status:   rawCount > 0 ? "processing" : "not_found",
    rawCount,
  });
});

app.listen(3001, () => console.log("Processing server running on :3001"));