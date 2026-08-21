import assert from "node:assert/strict";
import {
  buildVideoRecommendationQuery,
  normalizeVideoRecommendations,
  youtubeSearchUrl,
} from "./videoRecommendations";

assert.equal(
  buildVideoRecommendationQuery({
    subject: "Physics",
    topic: "Newton's laws",
    description: "Free-body diagrams",
  }),
  "Physics Newton's laws Free-body diagrams",
);
assert.equal(
  buildVideoRecommendationQuery(null),
  "effective study techniques for students",
);

const searchUrl = youtubeSearchUrl("quadratic equations & graphs");
assert.ok(
  searchUrl.startsWith("https://www.youtube.com/results?search_query="),
);
assert.ok(searchUrl.includes("quadratic%20equations"));

const recommendations = normalizeVideoRecommendations([
  {
    video_id: "dQw4w9WgXcQ",
    title: "A useful lesson",
    thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    channel_title: "Example Education",
  },
  {
    id: "fallback",
    title: "Search for worked examples",
    watch_url:
      "https://www.youtube.com/results?search_query=quadratic+worked+examples",
    source: "youtube_search",
  },
  {
    id: "unsafe",
    title: "Unsafe link",
    watch_url: "https://example.com/phishing",
  },
]);

assert.equal(recommendations.length, 2);
assert.equal(
  recommendations[0].watchUrl,
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
);
assert.equal(recommendations[1].source, "youtube_search");

console.log("Student video recommendation tests passed");
