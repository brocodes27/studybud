# ElevenFolks scroll-world — generation prompt pack

Everything needed to generate the assets for the scroll-scrubbed landing page at
`public/world/index.html`. The page is already wired; drop files into
`public/world/assets/` with the exact filenames below and it comes alive.

- **Art direction:** soft matte clay diorama, isometric, tilt-shift miniature.
- **Camera architecture:** B — dive into each scene + aerial connector to the next
  (6 dives + 5 connectors).
- **Chains:** desktop 16:9 **and** native mobile 9:16 (a second full chain, not a crop).
- **Totals:** 6 stills ×2 aspects, 11 clips ×2 aspects = 12 images + 22 videos.

Recommended model: Seedance 2.0 (`seedance_2_0`, `--mode std --resolution 1080p`), or any
model that accepts **both** a start image and an end image — connectors cannot be made
without `end_image`, and a model that can't frame-lock will produce a visible pop at every
seam.

---

## 0. Style preamble (verbatim, every image prompt)

Byte-for-byte identical text in all six still prompts. This is what makes the six scenes
read as one world.

```
Isometric low-poly 3D diorama floating as a small rounded island on a plain solid #FAF8F5
background with a soft contact shadow beneath it. Soft matte clay 3D render, rounded
toy-model shapes, gentle warm studio lighting, soft long shadows, tilt-shift miniature
look. Cohesive color palette of cream #FAF8F5, sand #F5F0E8, clay tan #C4A484, walnut
brown #8B7355, deep ink #2D2A26, sage green #6B8E6B, warm gold #B8956A. Highly detailed,
centered composition, absolutely no text, no letters, no numbers, no logos.
```

Style tail used inside the *video* prompts (shorter — the start image already carries the
look):

```
Soft matte clay diorama, tilt-shift miniature, warm studio light, cream #FAF8F5 background,
palette of clay tan #C4A484, walnut #8B7355, sage #6B8E6B, warm gold #B8956A.
```

---

## 1. Scene stills — 6 images, aspect 3:2 (desktop) and 9:16 (mobile)

Each prompt = **style preamble** + the `Subject:` line below. Keep the focal subject
horizontally centred with headroom.

Filenames: `assets/<id>.png` (3:2) and `assets/<id>-m.png` (9:16). For the 9:16 render,
use the same subject line and add: `Vertical composition, the island centred with clear
space above and below.`

### 1 — `syow` — the Ingest Yard
```
Subject: A small open-air sorting yard on a rounded clay island. A tilted intake chute on
one side where blank paper documents, closed books, rolled scrolls, tiny blank screens and
little film reels tumble in. They ride a short conveyor through a rounded scanning arch and
come out the far side as neat identical stacked blocks, sorted into three tidy trays. Two
tiny clay workers guide the flow. Crates and spools of cable along the edges.
```

### 2 — `atlas` — the ATLAS workspace
```
Subject: A cosy cutaway study pod on a rounded clay island — one warm room with a desk, a
lamp, a soft chair and shelves of blank books. A tiny clay student sits at the desk; beside
them a friendly rounded clay robot companion, chest slightly glowing, leaning in to look at
the same blank tablet. A small floating cluster of soft rounded memory orbs drifts above
the desk, connected by thin threads.
```

### 3 — `feynman` — the Feynman board
```
Subject: A tiny amphitheatre lecture nook on a rounded clay island. A small blank chalkboard
on an easel at the front, a tiny clay student standing beside it mid-gesture explaining, and
a single small clay pupil figure sitting on the front bench with one hand raised asking a
question. A few empty benches behind. Soft chalk dust motes in the light.
```

### 4 — `planner` — mission control
```
Subject: A rounded clay mission-control room, one wall opened away. A large curved blank
planning wall made of small rounded tiles in sage, gold and clay tan arranged in horizontal
tracks. A tiny clay operator at a low console adjusting the tiles; a small model calendar
tower beside them and a rounded clock with blank face. Thin threads connect tiles across the
wall.
```

### 5 — `simulator` — the exam arena
```
Subject: A small circular exam hall on a rounded clay island, roof lifted away. Concentric
rings of tiny identical desks facing a central raised pillar with a rounded blank timer disc
on top. A handful of tiny clay students at the desks, heads down. Soft spotlight pooling from
above onto the centre ring. Rounded stone arches around the rim.
```

### 6 — `mastery` — the finale (drop the island framing)
```
Subject: A single oversized rounded clay tree floating alone in soft cream #FAF8F5 space,
no island beneath it. Its trunk is smooth walnut clay and its canopy is made of many small
rounded leaf-tiles in sage, gold and clay tan, some tiles glowing faintly. A few tiny
rounded orbs and small model books orbit slowly around the canopy. Soft contact shadow far
below.
```

---

## 2. Dive clips — 6 videos

`--start-image` = that scene's still (the solid-background version). Desktop:
`--aspect_ratio 16:9 --duration 8`, start from `assets/<id>.png`. Mobile: identical prompt,
`--aspect_ratio 9:16`, start from `assets/<id>-m.png`.

Filenames: `assets/vid/<id>.mp4` and `assets/vid/<id>-m.mp4`.

Template — every dive follows this shape:

```
Single continuous cinematic camera move, no cuts. Begin high and far, looking down at the
whole [SCENE] from outside like a tiny model. The camera slowly glides forward and descends
toward it, sweeping in toward [FOCAL POINT], as if flying inside. As the camera pushes in,
[OPENING CLAUSE]. Soft matte clay diorama, tilt-shift miniature, warm studio light, cream
#FAF8F5 background, palette of clay tan #C4A484, walnut #8B7355, sage #6B8E6B, warm gold
#B8956A. Smooth, graceful, slow motion, subtle parallax. No text, no captions.
```

Per scene, fill:

| # | file | SCENE | FOCAL POINT | OPENING CLAUSE |
|---|---|---|---|---|
| 1 | `syow.mp4` | ingest yard island | the scanning arch and the conveyor beneath it | the camera drops low and flies along the conveyor, passing under the arch |
| 2 | `atlas.mp4` | study-pod island | the desk where the student and the clay robot sit together | the roof and front wall gently lift and open away to reveal the warm interior |
| 3 | `feynman.mp4` | lecture-nook island | the blank chalkboard and the student explaining beside it | the camera glides down over the empty benches and settles facing the board |
| 4 | `planner.mp4` | mission-control island | the curved tile wall and the operator at the console | the remaining walls fold gently open to reveal the full planning wall |
| 5 | `simulator.mp4` | circular exam hall island | the central pillar with the blank timer disc | the roof lifts away and the camera spirals slowly down into the rings of desks |
| 6 | `mastery.mp4` | giant floating clay tree | the glowing tiles in the heart of the canopy | the camera rises along the trunk and drifts in among the orbiting leaf-tiles |

---

## 3. Connector clips — 5 videos

**This is the step that makes or breaks the page.** Each connector's endpoints must be the
**actual rendered frames** of the neighbouring dives — never the stills. Run
`scripts/scroll-world-frames.sh extract` after the dives are rendered; it writes the
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
of [SCENE i], rising into the sky, then glides forward across the connected miniature clay
world and arrives above [SCENE i+1], beginning to descend toward it. One connected miniature
clay world, seamless flowing aerial transition. Soft matte clay diorama, tilt-shift
miniature, warm studio light, cream #FAF8F5 background, palette of clay tan #C4A484, walnut
#8B7355, sage #6B8E6B, warm gold #B8956A. Smooth graceful slow motion. No text, no captions.
```

| file | frames | SCENE i → SCENE i+1 |
|---|---|---|
| `conn1.mp4` | `syow_last` → `atlas_first` | the ingest yard → the study pod |
| `conn2.mp4` | `atlas_last` → `feynman_first` | the study pod → the lecture nook |
| `conn3.mp4` | `feynman_last` → `planner_first` | the lecture nook → the mission-control room |
| `conn4.mp4` | `planner_last` → `simulator_first` | the mission-control room → the circular exam hall |
| `conn5.mp4` | `simulator_last` → `mastery_first` | the exam hall → **see below** |

`conn5` is the finale connector — replace the arrival clause with:

```
…rising into the sky, then gliding forward as the miniature world dissolves away into soft
cream space and a single giant floating clay tree comes into view, arriving in front of it.
```

Mobile connectors take the same filenames with `-m`: `conn1-m.mp4` … `conn5-m.mp4`.

---

## 4. Order of operations

1. Render 6 stills 3:2 → `assets/<id>.png`; 6 stills 9:16 → `assets/<id>-m.png`.
   **Review them together before continuing** — one off-style scene breaks the whole world.
2. Render the 6 desktop dives and the 6 mobile dives (these can all run in parallel).
   Save raw output as `assets/vid/raw/<id>.mp4` / `<id>-m.mp4`.
3. `bash scripts/scroll-world-frames.sh extract` → boundary frames into `assets/frames/`.
4. Render the 5 desktop + 5 mobile connectors using those frames →
   `assets/vid/raw/conn<N>.mp4` / `conn<N>-m.mp4`.
5. `bash scripts/scroll-world-frames.sh encode` → scrub-ready files in `assets/vid/`.
6. Open the page and check each seam (see QA below).

If a clip is rejected by a content filter: re-roll first (it is often non-deterministic),
then strip trigger words, then try a different model with the same start/end frames. A
connector that never passes can be dropped — set that slot to `null` in
`public/world/index.html` and the engine crossfades the seam directly.

## 5. QA

- At each seam, the dive's last frame and the connector's first frame must show the **same
  composition and props**. Judge by composition, not sharpness — some shimmer is normal.
  Different props = you used a still instead of a rendered frame.
- Console clean, and `document.querySelector('video').seekable.end(0) > 0` (blob loading
  works).
- Mobile clips must be **natively portrait**: `videoWidth < videoHeight`.
- Reduced-motion: stills only, no video.
