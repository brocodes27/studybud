import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CTASceneProps {
  ctaText: string;
  url: string;
}

export const CTAScene: React.FC<CTASceneProps> = ({ ctaText, url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.7 },
  });

  const ctaProgress = spring({
    frame: frame - 40,
    fps,
    config: { damping: 20, stiffness: 110, mass: 0.6 },
  });

  const shimmerX = interpolate(frame, [0, 90], [-200, 2200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#2D2A26",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Playfair Display', Georgia, serif",
        overflow: "hidden",
      }}
    >
      {/* Subtle texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle, #FFF 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Large background brand mark */}
      <div
        style={{
          position: "absolute",
          fontSize: 400,
          fontWeight: 700,
          color: "rgba(255,255,255,0.02)",
          letterSpacing: "-0.04em",
          userSelect: "none",
          bottom: -80,
          right: -40,
        }}
      >
        elevenfolks
      </div>

      <div
        style={{
          textAlign: "center",
          zIndex: 1,
          transform: `translateY(${(1 - headlineProgress) * -40}px)`,
        }}
      >
        <h2
          style={{
            fontSize: 80,
            fontWeight: 600,
            color: "#FAF8F5",
            lineHeight: 1.15,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Ready to think clearly?
        </h2>
        <p
          style={{
            fontSize: 28,
            color: "#C4A882",
            margin: 0,
            marginBottom: 64,
            fontFamily: "Inter, ui-sans-serif, system-ui",
            fontWeight: 400,
          }}
        >
          Join thousands of students already using elevenfolks.
        </p>
      </div>

      {/* CTA Button */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          transform: `scale(${0.9 + ctaProgress * 0.1}) translateY(${(1 - ctaProgress) * 30}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: "#FAF8F5",
            color: "#2D2A26",
            fontSize: 24,
            fontWeight: 600,
            padding: "24px 56px",
            borderRadius: 60,
            fontFamily: "Inter, ui-sans-serif, system-ui",
            letterSpacing: "0.02em",
            cursor: "default",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          {/* Shimmer effect */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: shimmerX,
              width: 200,
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
              transform: "skewX(-20deg)",
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>{ctaText}</span>
        </div>
      </div>

      {/* URL */}
      <p
        style={{
          fontSize: 20,
          color: "#8A8279",
          margin: 0,
          marginTop: 32,
          opacity: interpolate(frame, [50, 75], [0, 0.8], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          fontFamily: "Inter, ui-sans-serif, system-ui",
          letterSpacing: "0.05em",
        }}
      >
        {url}
      </p>

      {/* Logo mark small */}
      <div
        style={{
          marginTop: 48,
          opacity: interpolate(frame, [60, 85], [0, 0.5], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <svg width="32" height="32" viewBox="0 0 40 40" fill="none" style={{ color: "#8B7355" }}>
          <path
            d="M20 4C12 4 6 10 6 18c0 5 2.5 9.5 6.5 12.5L20 38l7.5-7.5C31.5 27.5 34 23 34 18c0-8-6-14-14-14z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M14 18c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5-2.5 5.5-6 5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M20 12.5v-3M20 28.5v-3M12.5 20h-3M30.5 20h-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
