import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface LogoSceneProps {
  brandName: string;
  tagline: string;
}

export const LogoScene: React.FC<LogoSceneProps> = ({ brandName, tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoY = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 },
  });

  const taglineOpacity = interpolate(frame, [25, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineY = interpolate(frame, [25, 50], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineWidth = interpolate(frame, [50, 80], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
      {/* Decorative circle behind logo */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,115,85,0.08) 0%, transparent 70%)",
          transform: `scale(${interpolate(frame, [0, 60], [0.8, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
        }}
      />

      {/* Logo mark */}
      <div
        style={{
          transform: `translateY(${(1 - logoY) * -30}px)`,
          marginBottom: 32,
        }}
      >
        <svg width="80" height="80" viewBox="0 0 40 40" fill="none" style={{ color: "#8B7355" }}>
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

      {/* Brand name */}
      <h1
        style={{
          fontSize: 96,
          fontWeight: 600,
          color: "#2D2A26",
          letterSpacing: "-0.02em",
          margin: 0,
          transform: `translateY(${(1 - logoY) * -20}px)`,
        }}
      >
        {brandName}
      </h1>

      {/* Decorative line */}
      <div
        style={{
          width: lineWidth,
          height: 2,
          backgroundColor: "#C4A882",
          marginTop: 24,
          marginBottom: 24,
          borderRadius: 1,
        }}
      />

      {/* Tagline */}
      <p
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "#8A8279",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: 0,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: "Inter, ui-sans-serif, system-ui",
        }}
      >
        {tagline}
      </p>
    </AbsoluteFill>
  );
};
