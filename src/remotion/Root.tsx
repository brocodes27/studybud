import React from "react";
import { Composition } from "remotion";
import { SaasPromo } from "./SaasPromo";

export const RemotionRoot = () => {
  return (
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
  );
};

export default RemotionRoot;
