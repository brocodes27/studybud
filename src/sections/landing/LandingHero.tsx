import { useRef, useMemo, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { useAnalytics } from '../../hooks/useAnalytics';

function FloatingObject({
  children,
  position,
  speed = 1,
  floatIntensity = 1.5,
  scale = 1,
}: {
  children: React.ReactNode;
  position: [number, number, number];
  speed?: number;
  floatIntensity?: number;
  scale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * speed * 0.15) * 0.08 + state.clock.elapsedTime * speed * 0.02;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.12) * 0.04;
  });

  return (
    <Float speed={speed} rotationIntensity={0.3} floatIntensity={floatIntensity} floatingRange={[-0.25, 0.25]}>
      <group ref={groupRef} position={position} scale={scale}>
        {children}
      </group>
    </Float>
  );
}

function GraduationCap() {
  const boardColor = '#1E1B18';
  const capColor = '#2D2A26';
  const goldColor = '#C4A882';
  return (
    <group rotation={[0.15, 0.3, 0.05]}>
      {/* Mortarboard (flat square) */}
      <mesh position={[0, 0.34, 0]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[1.2, 0.04, 1.2]} />
        <meshStandardMaterial color={boardColor} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Cap base (skullcap) */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.28, 32]} />
        <meshStandardMaterial color={capColor} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Tassel button */}
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color={goldColor} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Tassel string */}
      <mesh position={[0.32, 0.22, 0.32]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.012, 0.012, 0.48, 8]} />
        <meshStandardMaterial color={goldColor} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Tassel strands */}
      <mesh position={[0.42, -0.02, 0.42]}>
        <cylinderGeometry args={[0.04, 0.04, 0.18, 12]} />
        <meshStandardMaterial color={goldColor} roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
}

function Globe() {
  const oceanColor = '#7A9BAB';
  const landColor = '#8B7355';
  const standColor = '#C4A882';
  const axisColor = '#B8A080';
  return (
    <group rotation={[0.2, 0.5, 0.1]}>
      {/* Globe sphere */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.52, 48, 48]} />
        <meshStandardMaterial color={oceanColor} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Simple continent patches (abstract) */}
      <mesh position={[0.18, 0.55, 0.38]} rotation={[0.3, 0.5, 0.1]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={landColor} roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[-0.25, 0.35, 0.42]} rotation={[0.1, -0.4, 0.2]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color={landColor} roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0.05, 0.25, 0.48]} rotation={[0.4, 0.2, -0.1]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color={landColor} roughness={0.8} metalness={0} />
      </mesh>
      {/* Meridian ring */}
      <mesh position={[0, 0.42, 0]} rotation={[0, 0, 0.25]}>
        <torusGeometry args={[0.56, 0.018, 12, 48]} />
        <meshStandardMaterial color={axisColor} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Stand arch */}
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0.25]}>
        <torusGeometry args={[0.38, 0.022, 12, 32, Math.PI]} />
        <meshStandardMaterial color={standColor} roughness={0.4} metalness={0.25} />
      </mesh>
      {/* Stand base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.06, 32]} />
        <meshStandardMaterial color={standColor} roughness={0.4} metalness={0.25} />
      </mesh>
    </group>
  );
}

function Lightbulb() {
  const glassColor = '#F5ECD7';
  const baseColor = '#B8A080';
  const filamentColor = '#E8D5B7';
  return (
    <group rotation={[0.05, -0.4, 0.08]}>
      {/* Bulb glass */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.38, 48, 48]} />
        <meshStandardMaterial color={glassColor} roughness={0.15} metalness={0.05} transparent opacity={0.9} />
      </mesh>
      {/* Inner glow hint */}
      <mesh position={[0, 0.30, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#FFF5E0" roughness={0.2} metalness={0} emissive="#FFE8C0" emissiveIntensity={0.3} />
      </mesh>
      {/* Filament loop */}
      <mesh position={[0, 0.38, 0]}>
        <torusGeometry args={[0.08, 0.008, 8, 24]} />
        <meshStandardMaterial color={filamentColor} roughness={0.3} metalness={0.5} emissive="#FFF0D0" emissiveIntensity={0.15} />
      </mesh>
      {/* Screw base top ring */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.08, 24]} />
        <meshStandardMaterial color={baseColor} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Screw base middle */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.12, 24]} />
        <meshStandardMaterial color={baseColor} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Screw base bottom */}
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.06, 24]} />
        <meshStandardMaterial color="#A08B6A" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Bottom contact */}
      <mesh position={[0, -0.22, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#D4C4A8" roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Particles() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 40;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += Math.sin(state.clock.elapsedTime * 0.2 + i) * 0.001;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.01;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#C4A882"
        size={0.035}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} color="#FFF5E6" />
      <directionalLight position={[4, 6, 4]} intensity={0.8} color="#FFE4C4" />
      <directionalLight position={[-3, -2, -2]} intensity={0.3} color="#D4A76A" />
      <pointLight position={[0, 2, 3]} intensity={0.5} color="#E8C9A0" distance={15} />

      {/* Graduation cap upper-left */}
      <FloatingObject position={[-3.0, 1.6, -2.5]} speed={0.7} floatIntensity={1.2} scale={1.4}>
        <GraduationCap />
      </FloatingObject>
      {/* Globe upper-right */}
      <FloatingObject position={[3.2, 1.4, -2.8]} speed={0.9} floatIntensity={1.0} scale={1.5}>
        <Globe />
      </FloatingObject>
      {/* Lightbulb lower-right */}
      <FloatingObject position={[2.8, -2.0, -1.8]} speed={0.8} floatIntensity={1.3} scale={1.4}>
        <Lightbulb />
      </FloatingObject>

      <Particles />

      <fog attach="fog" args={['#FAF8F5', 15, 30]} />
    </>
  );
}

export default function LandingHero() {
  const navigate = useNavigate();
  const { track } = useAnalytics();

  useEffect(() => {
    track('landing_view');
  }, [track]);

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-16 overflow-hidden">
      {/* 3D Background Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 7], fov: 55, near: 0.1, far: 50 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={['#FAF8F5']} />
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* Soft edge fade for depth */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(250,248,245,0.45) 100%)`,
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-[#8B7355]">
              <path d="M20 4C12 4 6 10 6 18c0 5 2.5 9.5 6.5 12.5L20 38l7.5-7.5C31.5 27.5 34 23 34 18c0-8-6-14-14-14z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M14 18c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5-2.5 5.5-6 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M20 12.5v-3M20 28.5v-3M12.5 20h-3M30.5 20h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold text-[#2D2A26] tracking-tight mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Stop pretending you know JEE.
          </h1>
          <p className="text-[15px] text-[#8A8279] font-medium tracking-wide max-w-md mx-auto leading-relaxed">
            ATLAS grills you on Physics, Chemistry & Maths until you actually prove mastery. No hints. No shortcuts. Just a shareable credential when you pass.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <div className="relative max-w-lg mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8279]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Try Rotational Dynamics, Electrochemistry, Limits..."
              className="w-full pl-11 pr-5 py-3.5 bg-white/80 backdrop-blur-md border border-[#E8E2D9] rounded-full text-sm text-[#2D2A26] placeholder:text-[#B5AEA5] focus:outline-none focus:border-[#8B7355]/40 focus:ring-2 focus:ring-[#8B7355]/10 transition-all shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate('/signup');
                }
              }}
            />
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <a
            href="#demo"
            className="inline-flex items-center gap-2 px-7 py-3 bg-[#2D2A26] text-white text-sm font-extrabold rounded-full hover:bg-[#3D3833] transition-colors shadow-md"
          >
            Prove it — free, no signup
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-16"
        >
          <div className="flex flex-col items-center text-center p-5 bg-white/40 backdrop-blur-sm rounded-xl">
            <div className="w-14 h-14 mb-4 text-[#8B7355]">
              <ShieldCheck className="w-full h-full" strokeWidth={1.2} />
            </div>
            <h3 className="text-sm font-semibold text-[#2D2A26] mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Prove-It Mode
            </h3>
            <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">
              ATLAS grills you with follow-ups until you truly master a topic. No hints. No guessing.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-5 bg-white/40 backdrop-blur-sm rounded-xl">
            <div className="w-14 h-14 mb-4 text-[#8B7355]">
              <BookOpen className="w-full h-full" strokeWidth={1.2} />
            </div>
            <h3 className="text-sm font-semibold text-[#2D2A26] mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Daily JEE Prescriptions
            </h3>
            <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">
              Based on your weak areas and backlog, get one prioritized task every morning. No decision fatigue.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-5 bg-white/40 backdrop-blur-sm rounded-xl">
            <div className="w-14 h-14 mb-4 text-[#8B7355]">
              <Calendar className="w-full h-full" strokeWidth={1.2} />
            </div>
            <h3 className="text-sm font-semibold text-[#2D2A26] mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Squad Accountability
            </h3>
            <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">
              Form a Prove-It squad with friends. Weekly topic, shared streak, and real rigor scores.
            </p>
          </div>
        </motion.div>

        {/* Social proof placeholder — replace with real screenshots or student count once you have them */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md mx-auto text-center"
        >
          <p className="text-xs text-[#8A8279] font-medium">
            Built for JEE. No AI cheating. Only mastery.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
