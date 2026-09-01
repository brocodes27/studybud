# Curve scroll-world — generation prompt pack

Everything needed to generate the assets for the scroll-scrubbed landing page at
`public/world/index.html`. The page is already wired; drop files into
`public/world/assets/` with the exact filenames below and it comes alive.

- **Art direction:** clay diorama at night — matte clay islands glowing in a dark violet
  void, tilt-shift miniature.
- **Camera architecture:** B — dive into each scene + aerial connector to the next
  (6 dives + 5 connectors).
- **Chains:** desktop 16:9 **and** native mobile 9:16 (a second full chain, not a crop).
- **Totals:** 6 stills ×2 aspects, 11 clips ×2 aspects = 12 images + 22 videos.

**Built with Google Flow** (Nano Banana Pro for stills, Veo 3.1 - Fast for clips) through the
patched MCP at `~/Developer/google-flow-browser-mcp` — see §4. Any other generator works too,
as long as it accepts **both** a start image and an end image: connectors cannot be made
without an end frame, and a model that can't frame-lock produces a visible pop at every seam.
Flow delivered 1280×720 / 720×1280 at a fixed 8s per clip.

---

## 0. Style preamble (verbatim, every image prompt)

Byte-for-byte identical text in all six still prompts. This is what makes the six scenes
read as one world.

```
Isometric low-poly 3D diorama floating as a small rounded island in a deep dark violet void,
plain solid #0E0A14 background, no horizon, a soft violet glow pooling beneath the island.
Soft matte clay 3D render, rounded toy-model shapes, moody night lighting with warm interior
glow and soft violet rim light, tilt-shift miniature look. Cohesive color palette of near-black
violet #0E0A14, deep plum #150F1D, raised plum #251B33, electric violet #7B5CF0, lilac #C9B8F7,
amber #F5C451, mint #A8E6D8, blush pink #F5B8D8. Highly detailed, centered composition,
absolutely no text, no letters, no numbers, no logos.
```

Style tail used inside the *video* prompts (shorter — the start image already carries the
look):

```
Soft matte clay diorama at night, tilt-shift miniature, dark violet #0E0A14 void, warm
interior glow and violet rim light, palette of electric violet #7B5CF0, lilac #C9B8F7,
amber #F5C451, mint #A8E6D8, blush pink #F5B8D8.
```

---

## 1. Scene stills — 6 images, aspect 16:9 (desktop) and 9:16 (mobile)

> Flow offers 1:1 / 16:9 / 9:16 / 4:3 / 3:4 — **no 3:2**. Desktop stills are rendered
> 16:9 so they match the film they seed. Nano Banana Pro returns 1376×768 / 768×1376.

Each prompt = **style preamble** + the `Subject:` line below. Keep the focal subject
horizontally centred with headroom.

Filenames: `assets/<id>.png` (16:9) and `assets/<id>-m.png` (9:16). For the 9:16 render,
use the same subject line and add: `Vertical composition, the island centred with clear
space above and below.`

Note the hard "no letters, no numbers" rule in the preamble — these scenes are about grades
and papers, so lean on **blank** pages, **blank** dials and coloured bars. Never ask for a
letter grade or a GPA figure to be drawn; the model will render garbled glyphs.

### 1 — `syllabus` — the intake
```
Subject: A small rounded clay intake terminal island. A wide angled slot at the front where
a fan of blank paper documents slides in, glowing violet along the slot edge. Inside, a short
lit conveyor carries each blank page through a scanning arch, and out the far side the pages
come apart into small stacked coloured bars of different heights — violet, amber, mint,
blush — dropping into four tidy sorting bins. One tiny clay student stands at the slot feeding
pages in. Cables and small glowing nodes around the rim.
```

### 2 — `forecast` — the grade engine
```
Subject: A rounded clay observatory island under the dark violet void. At its centre a large
smooth dish-shaped instrument holding a single glowing violet arc that curves upward, like a
projection rising off the dish. Around it, low clay consoles with blank dials and small
coloured bar sliders in amber and mint. A tiny clay student at one console, hand on a slider,
watching the glowing arc bend. Soft violet light spilling across the island floor.
```

### 3 — `stages` — the study loop
```
Subject: A ring-shaped rounded clay island split into four small connected chambers joined by
short glowing walkways, seen from above and slightly to the side. Each chamber holds a
different small setup: a soft lamp and a single open blank book; a workbench with small
coloured blocks being fitted together; a quiet booth with a blank card rack; a small round
platform with a glowing mint disc. One tiny clay student mid-walk between two chambers. Warm
interior glow from each chamber against the dark violet void.
```

### 4 — `briefing` — today's queue
```
Subject: A small rounded clay control room island, front wall opened away. Inside, a tall
narrow board holds a vertical stack of five rounded task cards in amber, violet and mint,
the top one lifted slightly forward and glowing. A tiny clay student sits at a low desk with
a blank tablet, reaching toward the top card. A small model clock with a blank face and a
short row of glowing deadline pins along the side wall.
```

### 5 — `sprint` — the exam sprint
```
Subject: A tight rounded clay war-room island lit in blush pink and amber. A central round
table with a tall thin countdown pillar rising from it, a single blush ring of light glowing
partway down the pillar. Around the table, small stacks of blank paper sorted into two piles
— a tall glowing pile pulled close and a dimmed pile pushed to the edge. Two tiny clay
students leaning over the table. Dark violet void all around, hard rim light on the island edge.
```

### 6 — `gpa` — the finale (drop the island framing)
```
Subject: A single oversized smooth clay arc floating alone in the dark violet #0E0A14 void,
no island beneath it — a thick rounded upward-sweeping curve of polished violet clay, its
leading edge glowing bright electric violet and lilac. A few small rounded clay markers sit
along the curve like milestones, each softly lit in amber, mint and blush. Faint violet
particles drifting around it. Deep soft glow far below.
```

---

## 2. Dive clips — 6 videos

`--start-image` = that scene's still. Desktop: `--aspect_ratio 16:9 --duration 8`, start from
`assets/<id>.png`. Mobile: identical prompt, `--aspect_ratio 9:16`, start from
`assets/<id>-m.png`.

Filenames: `assets/vid/<id>.mp4` and `assets/vid/<id>-m.mp4`.

Template — every dive follows this shape:

```
Single continuous cinematic camera move, no cuts. Begin high and far, looking down at the
whole [SCENE] from outside like a tiny model glowing in a dark violet void. The camera slowly
glides forward and descends toward it, sweeping in toward [FOCAL POINT], as if flying inside.
As the camera pushes in, [OPENING CLAUSE]. Soft matte clay diorama at night, tilt-shift
miniature, dark violet #0E0A14 void, warm interior glow and violet rim light, palette of
electric violet #7B5CF0, lilac #C9B8F7, amber #F5C451, mint #A8E6D8, blush pink #F5B8D8.
Smooth, graceful, slow motion, subtle parallax. No text, no captions.
```

Per scene, fill:

| # | file | SCENE | FOCAL POINT | OPENING CLAUSE |
|---|---|---|---|---|
| 1 | `syllabus.mp4` | intake terminal island | the glowing slot and the conveyor behind it | the camera drops low and flies along the conveyor, following the pages through the scanning arch as they break into coloured bars |
| 2 | `forecast.mp4` | observatory island | the dish and the glowing violet arc rising from it | the camera curves in low around the dish and settles facing the arc as it bends upward |
| 3 | `stages.mp4` | ring of four chambers | the lit walkway between the chambers | the camera descends into the ring and glides through each chamber's open side in turn |
| 4 | `briefing.mp4` | control-room island | the stack of task cards on the board | the remaining walls fold gently open and the camera pushes in until the top glowing card fills the frame |
| 5 | `sprint.mp4` | war-room island | the countdown pillar at the centre of the table | the roof lifts away and the camera spirals down the pillar toward the table |
| 6 | `gpa.mp4` | giant floating clay curve | the bright glowing leading edge of the curve | the camera rises along the underside of the curve and drifts out past its glowing tip |

---

## 3. Connector clips — 5 videos

**This is the step that makes or breaks the page.** Each connector's endpoints must be the
**actual rendered frames** of the neighbouring dives — never the stills. Run
`bash scripts/scroll-world-frames.sh extract` after the dives are rendered; it writes the
frames to `assets/frames/`.

```
--start-image assets/frames/<id_i>_last.png       # last frame of dive i
--end-image   assets/frames/<id_next>_first.png   # first frame of dive i+1
--aspect_ratio 16:9 --duration 5
```

Mobile: same prompt, `--aspect_ratio 9:16`, using the `-m` frames
(`<id>_last-m.png` / `<id>_first-m.png`) — mobile connectors must be locked against the
**mobile** dives, never the desktop ones.

Template:

```
Single continuous cinematic camera move, no cuts. The camera smoothly pulls up and back out
of [SCENE i], rising into the dark violet void above the world, then glides forward across
the connected miniature clay world, past drifting violet particles, and arrives above
[SCENE i+1], beginning to descend toward it. One connected miniature clay world at night,
seamless flowing aerial transition. Soft matte clay diorama, tilt-shift miniature, dark violet
#0E0A14 void, warm interior glow and violet rim light, palette of electric violet #7B5CF0,
lilac #C9B8F7, amber #F5C451, mint #A8E6D8, blush pink #F5B8D8. Smooth graceful slow motion.
No text, no captions.
```

| file | frames | SCENE i → SCENE i+1 |
|---|---|---|
| `conn1.mp4` | `syllabus_last` → `forecast_first` | the intake terminal → the observatory |
| `conn2.mp4` | `forecast_last` → `stages_first` | the observatory → the ring of study chambers |
| `conn3.mp4` | `stages_last` → `briefing_first` | the ring of study chambers → the control room |
| `conn4.mp4` | `briefing_last` → `sprint_first` | the control room → the war room |
| `conn5.mp4` | `sprint_last` → `gpa_first` | the war room → **see below** |

`conn5` is the finale connector — replace the arrival clause with:

```
…rising into the dark violet void, then gliding forward as the miniature world falls away
below and a single giant glowing violet clay curve sweeps into view, arriving alongside its
bright leading edge.
```

Mobile connectors take the same filenames with `-m`: `conn1-m.mp4` … `conn5-m.mp4`.

---

## 4. Running it through Flow (automated)

The whole chain is scripted. [scripts/curve-world-jobs.mjs](../scripts/curve-world-jobs.mjs)
holds the prompt text (mirror of this file) and emits batch job files for the patched
Flow MCP at `~/Developer/google-flow-browser-mcp`:

```bash
node scripts/curve-world-jobs.mjs stills-16 > /tmp/jobs.json
node ~/Developer/google-flow-browser-mcp/scripts/flow-batch.mjs /tmp/jobs.json
```

Modes: `stills-16`, `stills-9`, `dives-16`, `dives-9`, `conns-16`, `conns-9`. Run
`bash scripts/scroll-world-frames.sh extract` between the dives and the connectors —
connector jobs read the boundary frames it writes.

Flow specifics learned the hard way: **prompts must be single-line** (Enter submits the
composer, so a newline generates whatever precedes it and discards the rest), Veo 3.1 -
Fast renders a fixed 8s at 720p, and every clip carries a "Veo" watermark plus a sparkle
mark in the corner.

## 5. Order of operations (manual)

1. Render 6 stills 3:2 → `assets/<id>.png`; 6 stills 9:16 → `assets/<id>-m.png`.
   **Review them together before continuing** — one off-style scene breaks the whole world.
2. Render the 6 desktop dives and the 6 mobile dives (these can all run in parallel).
   Save raw output as `assets/vid/raw/<id>.mp4` / `<id>-m.mp4`.
3. `bash scripts/scroll-world-frames.sh extract` → boundary frames into `assets/frames/`.
4. Render the 5 desktop + 5 mobile connectors using those frames →
   `assets/vid/raw/conn<N>.mp4` / `conn<N>-m.mp4`.
5. `bash scripts/scroll-world-frames.sh encode` → scrub-ready files in `assets/vid/`.
6. Open the page and check each seam (see QA below).

If a clip is rejected by a content filter: re-roll first (often non-deterministic), then strip
trigger words, then try a different model with the same start/end frames. A connector that
never passes can be dropped — set that slot to `null` in `public/world/index.html` and the
engine crossfades the seam directly.

## 6. QA

- At each seam, the dive's last frame and the connector's first frame must show the **same
  composition and props**. Judge by composition, not sharpness — some shimmer is normal.
  Different props = you used a still instead of a rendered frame.
- Console clean, and `document.querySelector('video').seekable.end(0) > 0` (blob loading works).
- Mobile clips must be **natively portrait**: `videoWidth < videoHeight`.
- Reduced-motion: stills only, no video.
