import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { LogoScene } from "./scenes/LogoScene";
import { HookScene } from "./scenes/HookScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { CTAScene } from "./scenes/CTAScene";

export type SaasPromoProps = {
  brandName: string;
  tagline: string;
  ctaText: string;
  url: string;
};

const CROSSFADE = 20;
const TOTAL_FRAMES = 600;

const SCENES = [
  { from: 0, duration: 90, end: 90 },
  { from: 70, duration: 140, end: 210 },
  { from: 190, duration: 180, end: 370 },
  { from: 350, duration: 250, end: 600 },
];

export const SaasPromo: React.FC<SaasPromoProps> = ({
  brandName,
  tagline,
  ctaText,
  url,
}) => {
  const frame = useCurrentFrame();
  const progress = frame / TOTAL_FRAMES;

  const volume = interpolate(
    frame,
    [0, 60, TOTAL_FRAMES - 60, TOTAL_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const sceneOpacity = (index: number) => {
    const { from, end } = SCENES[index];
    if (frame < from || frame >= end) return 0;
    // Fade in during first CROSSFADE frames
    const fadeIn = Math.min(1, (frame - from) / CROSSFADE);
    // Fade out during last CROSSFADE frames
    const fadeOut = Math.min(1, (end - frame) / CROSSFADE);
    return Math.min(fadeIn, fadeOut);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#FAF8F5" }}>
      <Audio
        src={staticFile("leberch-uplifting-strings-248026.mp3")}
        volume={volume}
      />

      {/* Scene 1: Logo Intro */}
      <Sequence from={0} durationInFrames={90}>
        <div style={{ opacity: sceneOpacity(0) }}>
          <LogoScene brandName={brandName} tagline={tagline} />
        </div>
      </Sequence>

      {/* Scene 2: Hook / Problem */}
      <Sequence from={70} durationInFrames={140}>
        <div style={{ opacity: sceneOpacity(1) }}>
          <HookScene />
        </div>
      </Sequence>

      {/* Scene 3: Features */}
      <Sequence from={190} durationInFrames={180}>
        <div style={{ opacity: sceneOpacity(2) }}>
          <FeaturesScene />
        </div>
      </Sequence>

      {/* Scene 4: CTA */}
      <Sequence from={350} durationInFrames={250}>
        <div style={{ opacity: sceneOpacity(3) }}>
          <CTAScene ctaText={ctaText} url={url} />
        </div>
      </Sequence>

      {/* Bottom progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 3,
          backgroundColor: "rgba(139,115,85,0.15)",
          borderRadius: 3,
          zIndex: 100,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: "#8B7355",
            borderRadius: 3,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
