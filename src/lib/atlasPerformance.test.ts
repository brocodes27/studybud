import assert from "node:assert/strict";
import { shouldUseFullAtlasOrchestration } from "./atlasPerformance";

assert.equal(
  shouldUseFullAtlasOrchestration("Explain Newton's second law simply."),
  false,
);
assert.equal(
  shouldUseFullAtlasOrchestration("Quiz me on quadratic equations."),
  false,
);
assert.equal(
  shouldUseFullAtlasOrchestration(
    "I feel overwhelmed and I can't do this anymore.",
  ),
  true,
);
assert.equal(
  shouldUseFullAtlasOrchestration(
    "Analyze my learning patterns and tell me why my progress has stalled.",
  ),
  true,
);
assert.equal(
  shouldUseFullAtlasOrchestration(
    "Compare mitosis and meiosis, then quiz me on the differences.",
  ),
  true,
);
assert.equal(
  shouldUseFullAtlasOrchestration(
    "Explain photosynthesis with one clear example.",
  ),
  false,
);

console.log("Atlas performance routing tests passed");
