import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const features = [
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    title: "AI-Assisted Notes",
    desc: "Your course materials, reviewed and organized by AI.",
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: "Structured Planning",
    desc: "A clear path forward. Outlines, not mind maps.",
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: "Knowledge Management",
    desc: "Track momentum. Build lasting understanding.",
  },
];

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

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
      {/* Section header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 80,
          transform: `translateY(${(1 - headerProgress) * -30}px)`,
        }}
      >
        <p
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#8B7355",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: 0,
            marginBottom: 20,
            fontFamily: "Inter, ui-sans-serif, system-ui",
          }}
        >
          What you get
        </p>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: "#2D2A26",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Three powerful tools.
          <br />
          One calm mind.
        </h2>
      </div>

      {/* Feature cards */}
      <div style={{ display: "flex", gap: 40, zIndex: 1 }}>
        {features.map((feature, i) => {
          const cardDelay = 20 + i * 15;
          const cardSpring = spring({
            frame: frame - cardDelay,
            fps,
            config: { damping: 18, stiffness: 90, mass: 0.8 },
          });

          const cardY = (1 - cardSpring) * 60;
          const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                width: 380,
                backgroundColor: "#FFF",
                border: "1px solid #E8E2D9",
                borderRadius: 24,
                padding: 48,
                boxShadow: "0 8px 40px rgba(45,42,38,0.06)",
                transform: `translateY(${cardY}px)`,
                opacity: cardOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  backgroundColor: "#F5F0E8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 28,
                }}
              >
                {feature.icon}
              </div>
              <h3
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#2D2A26",
                  margin: 0,
                  marginBottom: 12,
                  lineHeight: 1.3,
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 20,
                  color: "#8A8279",
                  lineHeight: 1.5,
                  margin: 0,
                  fontFamily: "Inter, ui-sans-serif, system-ui",
                }}
              >
                {feature.desc}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
