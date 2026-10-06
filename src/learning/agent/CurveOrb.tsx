import { useEffect, useRef } from 'react';
import type { VoiceState } from './useVoice';

interface CurveOrbProps {
  state: VoiceState;
  isMuted?: boolean;
  onClick?: () => void;
  size?: number;
}

/**
 * Curve Advanced Voice Orb
 * Recreates the exact OpenAI Advanced Voice Mode fluid volumetric cloud orb:
 * - Crisp, razor-sharp circular silhouette
 * - Saturated deep foundation at the bottom
 * - Billowing, cloudy turbulent mist transition in the center
 * - Radiant off-white / champagne highlight at the upper core
 * - Fluid organic motion responding to voice states in Curve's warm palette
 */
export function CurveOrb({
  state,
  isMuted = false,
  onClick,
  size = 150,
}: CurveOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let running = true;

    // Fluid cloud simulation nodes
    const nodes = [
      { baseAngle: 0, dist: 0.22, speed: 0.8, r: 0.55, phase: 0 },
      { baseAngle: 2.1, dist: 0.35, speed: -0.6, r: 0.65, phase: 1.2 },
      { baseAngle: 4.2, dist: 0.28, speed: 0.7, r: 0.6, phase: 2.5 },
      { baseAngle: 1.1, dist: 0.45, speed: -0.9, r: 0.7, phase: 3.8 },
      { baseAngle: 3.4, dist: 0.38, speed: 0.5, r: 0.65, phase: 4.9 },
    ];

    const render = () => {
      if (!running) return;

      let speedFactor = 0.016;
      let turbulence = 1.0;
      let coreIntensity = 0.9;

      if (state === 'listening') {
        speedFactor = 0.035;
        turbulence = 1.6;
        coreIntensity = 1.05;
      } else if (state === 'working') {
        speedFactor = 0.06;
        turbulence = 2.2;
        coreIntensity = 1.2;
      } else if (state === 'speaking') {
        speedFactor = 0.045;
        turbulence = 1.9;
        coreIntensity = 1.3;
      } else if (state === 'muted' || isMuted) {
        speedFactor = 0.008;
        turbulence = 0.4;
        coreIntensity = 0.6;
      }

      timeRef.current += speedFactor;
      const t = timeRef.current;

      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 2;

      ctx.save();

      // 1. Precise circular clipping mask (razor-sharp edge, matching the reference image)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // 2. Base foundation layer: Deep saturated ink/violet at the bottom,
      // transitioning softly upward to lavender mist and pale cream at top.
      const baseGrad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
      if (state === 'muted' || isMuted) {
        baseGrad.addColorStop(0, '#e8ece5');
        baseGrad.addColorStop(0.45, '#a49f96');
        baseGrad.addColorStop(0.75, '#5c574c');
        baseGrad.addColorStop(1, '#252824');
      } else {
        // Curve Landing Page palette foundation:
        // Top: pale cream / lavender mist (#f5f8f5 -> #e2defa)
        // Mid: signature muted violet accent (#7770ba)
        // Bottom: deep rich charcoal-indigo (#252824 -> #1e1a38)
        baseGrad.addColorStop(0, '#f2f0fc');
        baseGrad.addColorStop(0.35, '#8c84d4');
        baseGrad.addColorStop(0.7, '#3b3566');
        baseGrad.addColorStop(1, '#1e1a38');
      }

      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // 3. Volumetric fluid cloud layers (screen blend mode for authentic luminous plasma)
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const angle = node.baseAngle + t * node.speed;
        const wobble = Math.sin(t * 1.5 + node.phase) * (0.08 * turbulence);
        const dist = (node.dist + wobble) * radius;

        const nx = cx + Math.cos(angle) * dist;
        const ny = cy + Math.sin(angle) * (dist * 0.7) + radius * 0.12;
        const nr = node.r * radius * (1 + Math.sin(t * 2 + i) * 0.08 * turbulence);

        const cloudGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(1, nr));

        if (state === 'muted' || isMuted) {
          cloudGrad.addColorStop(0, 'rgba(235, 230, 218, 0.45)');
          cloudGrad.addColorStop(0.5, 'rgba(170, 160, 142, 0.25)');
          cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          // Luminous lavender, sky-blue, and soft mint fluid clouds
          cloudGrad.addColorStop(0, 'rgba(226, 222, 250, 0.75)');
          cloudGrad.addColorStop(0.4, 'rgba(180, 172, 235, 0.5)');
          cloudGrad.addColorStop(0.75, 'rgba(220, 239, 249, 0.22)');
          cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Central / Upper Cloudy Highlight:
      // The diffuse, warm off-white/cream center radiating outward like in the reference image
      const coreY = cy - radius * 0.22 + Math.sin(t * 1.2) * (radius * 0.05 * turbulence);
      const coreX = cx + Math.cos(t * 0.9) * (radius * 0.06 * turbulence);
      const coreR = radius * (0.8 + Math.sin(t * 1.8) * 0.05 * turbulence);

      const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.96 * coreIntensity})`);
      coreGrad.addColorStop(0.22, `rgba(250, 249, 255, ${0.88 * coreIntensity})`);
      coreGrad.addColorStop(0.48, `rgba(226, 222, 250, ${0.6 * coreIntensity})`);
      coreGrad.addColorStop(0.75, 'rgba(228, 245, 207, 0.22)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
      ctx.fill();

      // 5. Secondary Lower Ambient Reflection (gives volumetric sphere depth)
      ctx.globalCompositeOperation = 'overlay';
      const bottomGlowY = cy + radius * 0.55;
      const bottomGlow = ctx.createRadialGradient(
        cx,
        bottomGlowY,
        0,
        cx,
        bottomGlowY,
        radius * 0.75
      );
      bottomGlow.addColorStop(0, 'rgba(25, 20, 48, 0.75)');
      bottomGlow.addColorStop(0.6, 'rgba(59, 53, 102, 0.4)');
      bottomGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = bottomGlow;
      ctx.beginPath();
      ctx.arc(cx, bottomGlowY, radius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // 6. Internal rim shadow / glass vignette (keeps the edge razor-sharp & spherical)
      ctx.globalCompositeOperation = 'source-over';
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius);
      rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      rimGrad.addColorStop(0.88, 'rgba(37, 40, 36, 0.18)');
      rimGrad.addColorStop(1, 'rgba(30, 26, 56, 0.5)');

      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 7. Subtle external boundary stroke (ultra-clean hairline border)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle =
        state === 'speaking' || state === 'listening'
          ? 'rgba(119, 112, 186, 0.55)'
          : 'rgba(232, 236, 229, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, isMuted, size]);

  return (
    <div
      className={`curve-advanced-orb-container state-${state}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={
        state === 'disconnected'
          ? 'Tap to start voice session'
          : `Curve is ${state}. Tap to toggle.`
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}

export default CurveOrb;
