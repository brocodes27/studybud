import React from "react";
import { Composition } from "remotion";
import { SaasPromo } from "./SaasPromo";
import { HyperPromo, HYPER_PROMO_DURATION } from "./HyperPromo";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="SaasPromo"
        component={SaasPromo}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          brandName: "elevenfolks",
          tagline: "Your AI study companion",
          ctaText: "Start thinking",
          url: "elevenfolks.com",
        }}
      />
      <Composition
        id="HyperPromo"
        component={HyperPromo}
        durationInFrames={HYPER_PROMO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          // Mixkit "Games Music" (Grigoriy Nuzhny) — free trailer track.
          // Skip the soft open so cuts land on the impact section.
          musicSrc: "mixkit-games-music-706.mp3",
          musicStartFromSeconds: 12,
        }}
      />
    </>
  );
};

export default RemotionRoot;
