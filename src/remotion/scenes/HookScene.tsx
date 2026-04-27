import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.7 },
  });

  const sublineOpacity = interpolate(frame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sublineY = interpolate(frame, [30, 55], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cardsOpacity = interpolate(frame, [55, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cards = [
    { emoji: "📚", label: "Overwhelmed by notes?" },
    { emoji: "📅", label: "Lost in schedules?" },
    { emoji: "🤯", label: "Studying alone?" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FAF8F5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Playfair Display', Georgia, serif",
      }}
    >
      {/* Background subtle pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.4,
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(196,168,130,0.06) 0%, transparent 50%),
                            radial-gradient(circle at 80% 50%, rgba(139,115,85,0.04) 0%, transparent 50%)`,
        }}
      />

      <div
        style={{
          transform: `translateY(${(1 - headlineProgress) * -40}px)`,
          textAlign: "center",
          zIndex: 1,
        }}
      >
        <h2
          style={{
            fontSize: 72,
            fontWeight: 600,
            color: "#2D2A26",
            lineHeight: 1.15,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Studying doesn&apos;t have to
          <br />
          be lonely.
        </h2>
      </div>

      <p
        style={{
          fontSize: 28,
          color: "#8A8279",
          margin: 0,
          marginBottom: 64,
          opacity: sublineOpacity,
          transform: `translateY(${sublineY}px)`,
          fontFamily: "Inter, ui-sans-serif, system-ui",
          fontWeight: 400,
        }}
      >
        Meet the AI that understands your curriculum.
      </p>

      {/* Pain point cards */}
      <div
        style={{
          display: "flex",
          gap: 32,
          opacity: cardsOpacity,
          zIndex: 1,
        }}
      >
        {cards.map((card, i) => {
          const cardDelay = i * 8;
          const cardY = interpolate(frame, [55 + cardDelay, 75 + cardDelay], [40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const cardOpacity = interpolate(frame, [55 + cardDelay, 75 + cardDelay], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                backgroundColor: "#FFF",
                border: "1px solid #E8E2D9",
                borderRadius: 20,
                padding: "28px 36px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                boxShadow: "0 4px 24px rgba(45,42,38,0.06)",
                transform: `translateY(${cardY}px)`,
                opacity: cardOpacity,
              }}
            >
              <span style={{ fontSize: 36 }}>{card.emoji}</span>
              <span
                style={{
                  fontSize: 20,
                  color: "#2D2A26",
                  fontWeight: 500,
                  fontFamily: "Inter, ui-sans-serif, system-ui",
                }}
              >
                {card.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
