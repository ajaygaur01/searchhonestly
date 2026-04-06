// collectors/youtube.ts
const axios = require("axios");
const YoutubeTranscript = require("youtube-transcript");
const prisma = require("../lib/prisma");

export async function collectYoutube(queryId: string, query: string) {
  // Step 1: search for top 5 videos with captions
  const searchRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: {
      key:            process.env.YOUTUBE_API_KEY,
      q:              query,
      part:           "snippet",
      type:           "video",
      videoCaption:   "closedCaption", // only videos that have transcripts
      maxResults:     5,
    },
  });

  const videos = searchRes.data.items;

  // Step 2: for each video, fetch transcript
  const results = [];
  for (const video of videos) {
    const videoId = video.id.videoId;
    let transcript = "";

    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
      transcript = segments
        .map((s: any) => s.text)
        .filter((t: string) => !t.startsWith("["))
        .join(" ")
        .slice(0, 15000);
    } catch {
      // no transcript available, skip
      continue;
    }

    results.push({
      videoId,
      title:       video.snippet.title,
      channel:     video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      url:         `https://youtube.com/watch?v=${videoId}`,
      transcript,
    });
  }

  await prisma.rawData.createMany({
    data: results.map((r) => ({
      queryId,
      source:  "YOUTUBE",
      status:  "UNPROCESSED",
      payload: r,
    })),
  });

  return results;
}