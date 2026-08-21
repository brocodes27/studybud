import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------
const INK = "#2D2A26";
const CREAM = "#FAF8F5";
const BRONZE = "#8B7355";
const SAND = "#C4A882";
const MUTED = "#8A8279";

const SANS = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";
const SERIF = "'Playfair Display', Georgia, serif";

// ---------------------------------------------------------------------------
// Timeline (30 fps)
// ---------------------------------------------------------------------------
const COLD_OPEN = 96; // hyperframe word burst
const QUESTION = 105; // "what if homework could teach?"
const BRAND_SLAM = 80; // logo punch
const CH1 = 150; // assign in one tap
const CH2 = 150; // AI that never gives answers
const CH3 = 150; // checked instantly
const STATS = 105; // strobe stats
const CTA = 170; // final burst + hold

export const HYPER_PROMO_DURATION =
  COLD_OPEN + QUESTION + BRAND_SLAM + CH1 + CH2 + CH3 + STATS + CTA; // 1006

export type HyperPromoProps = {
  /** File in public/ to use as the soundtrack. */
  musicSrc: string;
  /** Seconds to skip into the track so playback starts at its high-energy section. */
  musicStartFromSeconds: number;
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
type BurstWord = {
  text: string;
  frames: number;
  bg?: string;
  color?: string;
  size?: number;
};

/**
 * The "hyperframe" engine: one word per handful of frames, slamming in with a
 * punch-zoom, background color strobing between brand tones.
 */
const WordBurst: React.FC<{ words: BurstWord[]; seed: string }> = ({
  words,
  seed,
}) => {
  const frame = useCurrentFrame();

  let acc = 0;
  let index = words.length - 1;
  let localFrame = 0;
  for (let i = 0; i < words.length; i++) {
    if (frame < acc + words[i].frames) {
      index = i;
      localFrame = frame - acc;
      break;
    }
    acc += words[i].frames;
  }

  const word = words[index];
  const palette = [INK, BRONZE, CREAM];
  const bg = word.bg ?? palette[index % palette.length];
  const color = word.color ?? (bg === CREAM ? INK : CREAM);

  // Punch-zoom: word lands slightly oversized and settles fast.
  const scale = interpolate(localFrame, [0, Math.min(5, word.frames)], [1.22, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Deterministic per-word jitter so cuts feel hand-made, not templated.
  const angle = (random(`${seed}-rot-${index}`) - 0.5) * 4;
  const dx = (random(`${seed}-x-${index}`) - 0.5) * 40;
  const dy = (random(`${seed}-y-${index}`) - 0.5) * 24;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: word.size ?? 200,
          letterSpacing: "-0.04em",
          color,
          textTransform: "uppercase",
          transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(${scale})`,
          textAlign: "center",
          lineHeight: 0.95,
          padding: "0 80px",
        }}
      >
        {word.text}
      </div>
      {/* frame counter tick — tiny detail that sells the rapid-cut style */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          right: 64,
          fontFamily: SANS,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.2em",
          color: bg === CREAM ? MUTED : "rgba(250,248,245,0.4)",
        }}
      >
        {String(index + 1).padStart(2, "0")} / {String(words.length).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = Math.floor(frame / 2) % 4;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.05,
        backgroundImage:
          "radial-gradient(circle at 20% 30%, #000 0.6px, transparent 0.6px), radial-gradient(circle at 70% 60%, #000 0.5px, transparent 0.5px), radial-gradient(circle at 45% 85%, #000 0.5px, transparent 0.5px)",
        backgroundSize: "7px 7px, 11px 11px, 5px 5px",
        backgroundPosition: `${shift}px ${shift * 2}px, ${-shift}px ${shift}px, ${shift * 2}px ${-shift}px`,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Scene 1 — cold open burst
// ---------------------------------------------------------------------------
const ColdOpen: React.FC = () => (
  <WordBurst
    seed="cold"
    words={[
      { text: "Every", frames: 8 },
      { text: "night", frames: 8 },
      { text: "millions", frames: 9 },
      { text: "of kids", frames: 9 },
      { text: "copy", frames: 10, bg: BRONZE },
      { text: "homework.", frames: 30, bg: INK, size: 170 },
      { text: "Nobody learns.", frames: 22, bg: INK, size: 130, color: SAND },
    ]}
  />
);

// ---------------------------------------------------------------------------
// Scene 2 — the question (typewriter beat, deliberate contrast to the strobe)
// ---------------------------------------------------------------------------
const QuestionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "What if homework could teach?";
  const chars = Math.round(
    interpolate(frame, [8, 70], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  return (
    <AbsoluteFill
      style={{ backgroundColor: CREAM, alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 88,
          fontWeight: 600,
          color: INK,
          letterSpacing: "-0.01em",
        }}
      >
        {text.slice(0, chars)}
        <span style={{ color: BRONZE, opacity: cursorVisible ? 1 : 0 }}>|</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene 3 — brand slam
// ---------------------------------------------------------------------------
const BrandSlam: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 180, mass: 0.7 } });
  const ring = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const flash = interpolate(frame, [0, 4], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ backgroundColor: INK, alignItems: "center", justifyContent: "center" }}
    >
      {/* shockwave rings */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 300 + ring * (700 + i * 300),
            height: 300 + ring * (700 + i * 300),
            borderRadius: "50%",
            border: `2px solid rgba(196,168,130,${(1 - ring) * 0.5})`,
          }}
        />
      ))}
      <div
        style={{
          transform: `scale(${0.6 + pop * 0.4})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 150,
            fontWeight: 600,
            color: CREAM,
            letterSpacing: "-0.02em",
          }}
        >
          elevenfolks
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: SAND,
            opacity: interpolate(frame, [15, 35], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Homework that teaches back
        </div>
      </div>
      <AbsoluteFill style={{ backgroundColor: CREAM, opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Feature chapters: burst intro + product beat
// ---------------------------------------------------------------------------
const BURST_LEN = 34;

const Chapter: React.FC<{
  seed: string;
  burst: BurstWord[];
  kicker: string;
  title: string;
  lines: string[];
  accent?: string;
}> = ({ seed, burst, kicker, title, lines, accent = BRONZE }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - BURST_LEN;

  if (frame < BURST_LEN) {
    return <WordBurst seed={seed} words={burst} />;
  }

  const slide = spring({
    frame: local,
    fps,
    config: { damping: 22, stiffness: 140, mass: 0.8 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM, justifyContent: "center", padding: "0 160px" }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 28,
          opacity: slide,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 110,
          fontWeight: 600,
          color: INK,
          letterSpacing: "-0.02em",
          lineHeight: 1.02,
          marginBottom: 48,
          transform: `translateY(${(1 - slide) * 60}px)`,
          opacity: slide,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {lines.map((line, i) => {
          const p = spring({
            frame: local - 12 - i * 8,
            fps,
            config: { damping: 20, stiffness: 160, mass: 0.6 },
          });
          return (
            <div
              key={line}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: p,
                transform: `translateX(${(1 - p) * -40}px)`,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  backgroundColor: accent,
                  transform: `rotate(45deg) scale(${p})`,
                  flexShrink: 0,
                }}
              />
              <div style={{ fontFamily: SANS, fontSize: 40, fontWeight: 500, color: MUTED }}>
                {line}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ChapterOne: React.FC = () => (
  <Chapter
    seed="ch1"
    burst={[
      { text: "Pick a", frames: 8 },
      { text: "concept.", frames: 10 },
      { text: "One", frames: 7, bg: BRONZE },
      { text: "tap.", frames: 9, bg: INK, color: SAND },
    ]}
    kicker="For teachers"
    title="Assign homework in 30 seconds."
    lines={[
      "Type the concept you taught — NCERT topics autocomplete.",
      "AI drafts real, curriculum-aligned questions instantly.",
      "Send to the whole class, a gap group, or one student.",
    ]}
  />
);

const ChapterTwo: React.FC = () => (
  <Chapter
    seed="ch2"
    burst={[
      { text: "No", frames: 8 },
      { text: "answer", frames: 8 },
      { text: "keys.", frames: 9 },
      { text: "Just thinking.", frames: 9, bg: BRONZE, size: 150 },
    ]}
    kicker="For students"
    title="An AI tutor that never spoils the answer."
    lines={[
      "Guided Socratic sessions — hints, not solutions.",
      "Stuck? It asks the question that unlocks you.",
      "Every attempt builds a map of what you actually know.",
    ]}
  />
);

const ChapterThree: React.FC = () => (
  <Chapter
    seed="ch3"
    burst={[
      { text: "Submitted.", frames: 9 },
      { text: "Checked.", frames: 9, bg: BRONZE },
      { text: "Done.", frames: 16, bg: INK, color: SAND, size: 220 },
    ]}
    kicker="The closed loop"
    title="Checked before you finish your chai."
    lines={[
      "Every answer AI-checked with per-question feedback.",
      "Misconceptions surface on the teacher's command center.",
      "Tomorrow's lesson starts where today's gaps are.",
    ]}
  />
);

// ---------------------------------------------------------------------------
// Scene 7 — stats strobe
// ---------------------------------------------------------------------------
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stats = [
    { big: "6–12", small: "NCERT grades covered" },
    { big: "Every", small: "subject, topic & subtopic" },
    { big: "0 min", small: "spent grading by hand" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: INK,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 120,
      }}
    >
      {stats.map((s, i) => {
        const p = spring({
          frame: frame - i * 12,
          fps,
          config: { damping: 16, stiffness: 170, mass: 0.7 },
        });
        return (
          <div
            key={s.small}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              opacity: p,
              transform: `translateY(${(1 - p) * 80}px)`,
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 120,
                color: SAND,
                letterSpacing: "-0.03em",
              }}
            >
              {s.big}
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 30,
                fontWeight: 500,
                color: "rgba(250,248,245,0.7)",
                textAlign: "center",
                maxWidth: 340,
              }}
            >
              {s.small}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene 8 — CTA burst + hold
// ---------------------------------------------------------------------------
const CTA_BURST = 40;

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < CTA_BURST) {
    return (
      <WordBurst
        seed="cta"
        words={[
          { text: "Stop", frames: 9 },
          { text: "grading.", frames: 11 },
          { text: "Start", frames: 9, bg: BRONZE },
          { text: "teaching.", frames: 11, bg: INK, color: SAND },
        ]}
      />
    );
  }

  const local = frame - CTA_BURST;
  const pop = spring({ frame: local, fps, config: { damping: 15, stiffness: 160, mass: 0.8 } });
  const pulse = 1 + Math.sin(local / 10) * 0.015;

  return (
    <AbsoluteFill
      style={{ backgroundColor: CREAM, alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          transform: `scale(${(0.8 + pop * 0.2) * pulse})`,
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 140,
            fontWeight: 600,
            color: INK,
            letterSpacing: "-0.02em",
          }}
        >
          elevenfolks
        </div>
        <div
          style={{
            width: interpolate(local, [10, 40], [0, 160], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 3,
            backgroundColor: SAND,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: BRONZE,
            opacity: interpolate(local, [15, 35], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          elevenfolks.com
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 500,
            color: MUTED,
            opacity: interpolate(local, [25, 45], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          The closed loop for learning — for teachers, students & parents.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Root composition
// ---------------------------------------------------------------------------
export const HyperPromo: React.FC<HyperPromoProps> = ({
  musicSrc,
  musicStartFromSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hit hard immediately — only a short fade-in, longer fade-out at the end.
  const volume = interpolate(
    frame,
    [0, 8, HYPER_PROMO_DURATION - 50, HYPER_PROMO_DURATION],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  let at = 0;
  const next = (len: number) => {
    const from = at;
    at += len;
    return from;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Audio
        src={staticFile(musicSrc)}
        startFrom={Math.round(musicStartFromSeconds * fps)}
        volume={volume}
      />

      <Sequence from={next(COLD_OPEN)} durationInFrames={COLD_OPEN}>
        <ColdOpen />
      </Sequence>
      <Sequence from={next(QUESTION)} durationInFrames={QUESTION}>
        <QuestionScene />
      </Sequence>
      <Sequence from={next(BRAND_SLAM)} durationInFrames={BRAND_SLAM}>
        <BrandSlam />
      </Sequence>
      <Sequence from={next(CH1)} durationInFrames={CH1}>
        <ChapterOne />
      </Sequence>
      <Sequence from={next(CH2)} durationInFrames={CH2}>
        <ChapterTwo />
      </Sequence>
      <Sequence from={next(CH3)} durationInFrames={CH3}>
        <ChapterThree />
      </Sequence>
      <Sequence from={next(STATS)} durationInFrames={STATS}>
        <StatsScene />
      </Sequence>
      <Sequence from={next(CTA)} durationInFrames={CTA}>
        <CTAScene />
      </Sequence>

      <Grain />
    </AbsoluteFill>
  );
};
