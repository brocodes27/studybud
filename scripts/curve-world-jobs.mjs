#!/usr/bin/env node
/**
 * Emit Flow batch job files for the Curve scroll-world chain.
 *
 *   node scripts/curve-world-jobs.mjs stills-16  > /tmp/jobs.json
 *   node scripts/curve-world-jobs.mjs stills-9   > /tmp/jobs.json
 *   node scripts/curve-world-jobs.mjs dives-16   > /tmp/jobs.json
 *   node scripts/curve-world-jobs.mjs dives-9    > /tmp/jobs.json
 *   node scripts/curve-world-jobs.mjs conns-16   > /tmp/jobs.json
 *   node scripts/curve-world-jobs.mjs conns-9    > /tmp/jobs.json
 *
 * Then: node ~/Developer/google-flow-browser-mcp/scripts/flow-batch.mjs /tmp/jobs.json
 *
 * Prompt text mirrors docs/scroll-world-prompts.md — edit there and here together.
 * Connector jobs read the boundary frames written by scripts/scroll-world-frames.sh,
 * so run `extract` before emitting them.
 */
import path from 'path';

const ASSETS = '/Users/aryansingh/Developer/elevenfolks/public/world/assets';
const RAW = `${ASSETS}/vid/raw`;
const FRAMES = `${ASSETS}/frames`;
const PROJECT = { project_name: 'Curve Scroll World', campaign: 'curve-world' };

const PREAMBLE = `Isometric low-poly 3D diorama floating as a small rounded island in a deep dark violet void, plain solid #0E0A14 background, no horizon, a soft violet glow pooling beneath the island. Soft matte clay 3D render, rounded toy-model shapes, moody night lighting with warm interior glow and soft violet rim light, tilt-shift miniature look. Cohesive color palette of near-black violet #0E0A14, deep plum #150F1D, raised plum #251B33, electric violet #7B5CF0, lilac #C9B8F7, amber #F5C451, mint #A8E6D8, blush pink #F5B8D8. Highly detailed, centered composition, absolutely no text, no letters, no numbers, no logos.`;

const STYLE_TAIL = `Soft matte clay diorama at night, tilt-shift miniature, dark violet #0E0A14 void, warm interior glow and violet rim light, palette of electric violet #7B5CF0, lilac #C9B8F7, amber #F5C451, mint #A8E6D8, blush pink #F5B8D8.`;

const VERTICAL = `Vertical composition, the island centred with clear space above and below.`;

const SCENES = [
  {
    id: 'syllabus',
    subject: `A small rounded clay intake terminal island. A wide angled slot at the front where a fan of blank paper documents slides in, glowing violet along the slot edge. Inside, a short lit conveyor carries each blank page through a scanning arch, and out the far side the pages come apart into small stacked coloured bars of different heights — violet, amber, mint, blush — dropping into four tidy sorting bins. One tiny clay student stands at the slot feeding pages in. Cables and small glowing nodes around the rim.`,
    scene: 'intake terminal island',
    focal: 'the scanning arch and the conveyor beneath it',
    opening: 'the camera drops low and flies along the conveyor, following the pages through the scanning arch as they break into coloured bars',
  },
  {
    id: 'forecast',
    subject: `A rounded clay observatory island under the dark violet void. At its centre a large smooth dish-shaped instrument holding a single glowing violet arc that curves upward, like a projection rising off the dish. Around it, low clay consoles with blank dials and small coloured bar sliders in amber and mint. A tiny clay student at one console, hand on a slider, watching the glowing arc bend. Soft violet light spilling across the island floor.`,
    scene: 'observatory island',
    focal: 'the dish and the glowing violet arc rising from it',
    opening: 'the camera curves in low around the dish and settles facing the arc as it bends upward',
  },
  {
    id: 'stages',
    subject: `A ring-shaped rounded clay island split into four small connected chambers joined by short glowing walkways, seen from above and slightly to the side. Each chamber holds a different small setup: a soft lamp and a single open blank book; a workbench with small coloured blocks being fitted together; a quiet booth with a blank card rack; a small round platform with a glowing mint disc. One tiny clay student mid-walk between two chambers. Warm interior glow from each chamber against the dark violet void.`,
    scene: 'ring of four study chambers',
    focal: 'the lit walkway between the chambers',
    opening: "the camera descends into the ring and glides through each chamber's open side in turn",
  },
  {
    id: 'briefing',
    subject: `A small rounded clay control room island, front wall opened away. Inside, a tall narrow board holds a vertical stack of five rounded task cards in amber, violet and mint, the top one lifted slightly forward and glowing. A tiny clay student sits at a low desk with a blank tablet, reaching toward the top card. A small model clock with a blank face and a short row of glowing deadline pins along the side wall.`,
    scene: 'control-room island',
    focal: 'the stack of task cards on the board',
    opening: 'the remaining walls fold gently open and the camera pushes in until the top glowing card fills the frame',
  },
  {
    id: 'sprint',
    subject: `A tight rounded clay war-room island lit in blush pink and amber. A central round table with a tall thin countdown pillar rising from it, a single blush ring of light glowing partway down the pillar. Around the table, small stacks of blank paper sorted into two piles — a tall glowing pile pulled close and a dimmed pile pushed to the edge. Two tiny clay students leaning over the table. Dark violet void all around, hard rim light on the island edge.`,
    scene: 'war-room island',
    focal: 'the countdown pillar at the centre of the table',
    opening: 'the roof lifts away and the camera spirals down the pillar toward the table',
  },
  {
    id: 'gpa',
    subject: `A single oversized smooth clay arc floating alone in the dark violet #0E0A14 void, no island beneath it — a thick rounded upward-sweeping curve of polished violet clay, its leading edge glowing bright electric violet and lilac. A few small rounded clay markers sit along the curve like milestones, each softly lit in amber, mint and blush. Faint violet particles drifting around it. Deep soft glow far below.`,
    scene: 'giant floating clay curve',
    focal: 'the bright glowing leading edge of the curve',
    opening: 'the camera rises along the underside of the curve and drifts out past its glowing tip',
  },
];

const stillPrompt = (s, vertical) =>
  `${PREAMBLE}\nSubject: ${s.subject}${vertical ? ' ' + VERTICAL : ''}`;

const divePrompt = (s) =>
  `Single continuous cinematic camera move, no cuts. Begin high and far, looking down at the whole ${s.scene} from outside like a tiny model glowing in a dark violet void. The camera slowly glides forward and descends toward it, sweeping in toward ${s.focal}, as if flying inside. As the camera pushes in, ${s.opening}. ${STYLE_TAIL} Smooth, graceful, slow motion, subtle parallax. No text, no captions.`;

const connectorPrompt = (a, b, finale) =>
  finale
    ? `Single continuous cinematic camera move, no cuts. The camera smoothly pulls up and back out of the ${a.scene}, rising into the dark violet void, then glides forward as the miniature world falls away below and a single giant glowing violet clay curve sweeps into view, arriving alongside its bright leading edge. One connected miniature clay world at night, seamless flowing aerial transition. ${STYLE_TAIL} Smooth graceful slow motion. No text, no captions.`
    : `Single continuous cinematic camera move, no cuts. The camera smoothly pulls up and back out of the ${a.scene}, rising into the dark violet void above the world, then glides forward across the connected miniature clay world, past drifting violet particles, and arrives above the ${b.scene}, beginning to descend toward it. One connected miniature clay world at night, seamless flowing aerial transition. ${STYLE_TAIL} Smooth graceful slow motion. No text, no captions.`;

const mode = process.argv[2];
const jobs = [];

// Flow's image ratios are 1:1 / 16:9 / 9:16 / 4:3 / 3:4 — no 3:2 — and the stills
// double as video start frames, so desktop stills are rendered 16:9 to match the film.
if (mode === 'stills-16' || mode === 'stills-9') {
  const vertical = mode === 'stills-9';
  for (const s of SCENES) {
    jobs.push({
      tool: 'flow_generate_image',
      args: {
        prompt: stillPrompt(s, vertical),
        model: 'Nano Banana Pro',
        ratio: vertical ? '9:16' : '16:9',
        auto_confirm: true,
        ...PROJECT,
      },
      save_as: `${ASSETS}/${s.id}${vertical ? '-m' : ''}.png`,
    });
  }
} else if (mode === 'dives-16' || mode === 'dives-9') {
  const vertical = mode === 'dives-9';
  const suffix = vertical ? '-m' : '';
  for (const s of SCENES) {
    jobs.push({
      tool: 'flow_generate_video',
      args: {
        prompt: divePrompt(s),
        first_frame: `${ASSETS}/${s.id}${suffix}.png`,
        ratio: vertical ? '9:16' : '16:9',
        duration: '8s',
        quantity: 1,
        auto_confirm: true,
        output_folder: RAW,
        ...PROJECT,
      },
      save_as: `${RAW}/${s.id}${suffix}.mp4`,
    });
  }
} else if (mode === 'conns-16' || mode === 'conns-9') {
  const vertical = mode === 'conns-9';
  const suffix = vertical ? '-m' : '';
  for (let i = 0; i < SCENES.length - 1; i++) {
    const a = SCENES[i], b = SCENES[i + 1];
    jobs.push({
      tool: 'flow_generate_video',
      args: {
        prompt: connectorPrompt(a, b, i === SCENES.length - 2),
        first_frame: `${FRAMES}/${a.id}_last${suffix}.png`,
        last_frame: `${FRAMES}/${b.id}_first${suffix}.png`,
        ratio: vertical ? '9:16' : '16:9',
        duration: '8s',
        quantity: 1,
        auto_confirm: true,
        output_folder: RAW,
        ...PROJECT,
      },
      save_as: `${RAW}/conn${i + 1}${suffix}.mp4`,
    });
  }
} else {
  console.error(`unknown mode: ${mode}\nuse one of: stills-16 stills-9 dives-16 dives-9 conns-16 conns-9`);
  process.exit(2);
}

process.stdout.write(JSON.stringify({ connect: true, jobs }, null, 2) + '\n');
