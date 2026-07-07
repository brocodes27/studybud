import { useRef, useMemo, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Calendar, ChevronDown } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { useAnalytics } from '../../hooks/useAnalytics';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import SplitType from 'split-type';
import { Logo } from '../../components/Logo';

gsap.registerPlugin(useGSAP);

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
    
    // Smooth floating animation
    const floatY = Math.sin(state.clock.elapsedTime * speed) * 0.15;
    
    // Parallax displacement based on pointer coordinates (-1 to 1)
    const targetX = position[0] + state.pointer.x * 1.2;
    const targetY = position[1] + floatY + state.pointer.y * 1.2;
    
    // LERP smoothing
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.05);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.05);
    
    // Tilt rotation based on pointer
    const targetRotX = Math.sin(state.clock.elapsedTime * speed * 0.12) * 0.04 - state.pointer.y * 0.3;
    const targetRotY = state.clock.elapsedTime * speed * 0.02 + state.pointer.x * 0.3;
    
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const ctaContainerRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    track('landing_view');
  }, [track]);

  useGSAP((context, contextSafe) => {
    if (prefersReducedMotion || !contextSafe) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Logo entrance
    tl.from('.brand-logo', {
      opacity: 0,
      y: -25,
      duration: 1.0,
      ease: 'back.out(1.5)',
    });

    // Heading character split & reveal
    let split: SplitType | null = null;
    if (headingRef.current) {
      split = new SplitType(headingRef.current, { types: 'words,chars' });
      tl.from(split.chars, {
        opacity: 0,
        y: 60,
        rotateX: -70,
        stagger: 0.015,
        duration: 1.0,
        ease: 'back.out(1.4)',
      }, '-=0.8');
    }

    // Subtitle description
    tl.from('.hero-desc', {
      opacity: 0,
      y: 20,
      duration: 0.9,
    }, '-=0.6');

    // Search bar container
    tl.from('.search-container', {
      opacity: 0,
      y: 25,
      duration: 0.9,
    }, '-=0.7');

    // CTA button container
    tl.from('.cta-container', {
      opacity: 0,
      y: 25,
      duration: 0.9,
    }, '-=0.7');

    // Feature cards stagger reveal
    tl.from('.feature-card', {
      opacity: 0,
      y: 45,
      stagger: 0.12,
      duration: 1.2,
      ease: 'back.out(1.2)',
    }, '-=0.7');

    // Social proof text & scroll cue
    tl.from('.social-proof, .scroll-cue', {
      opacity: 0,
      y: 10,
      duration: 0.9,
      stagger: 0.1,
    }, '-=0.6');

    // MAGNETIC EFFECTS FOR SEARCH BAR & CTA BUTTON
    const makeMagnetic = (el: HTMLElement, strength = 0.3) => {
      const onMouseMove = contextSafe((e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        
        gsap.to(el, {
          x: x * strength,
          y: y * strength,
          scale: 1.03,
          duration: 0.4,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });

      const onMouseLeave = contextSafe(() => {
        gsap.to(el, {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: 'elastic.out(1.2, 0.4)',
          overwrite: 'auto',
        });
      });

      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);

      return () => {
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseleave', onMouseLeave);
      };
    };

    if (searchContainerRef.current) makeMagnetic(searchContainerRef.current, 0.22);
    if (ctaContainerRef.current) makeMagnetic(ctaContainerRef.current, 0.32);

    // 3D TILT EFFECT FOR FEATURE CARDS
    const makeTiltCard = (el: HTMLElement) => {
      const onMouseMove = contextSafe((e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xc = (x / rect.width) - 0.5;
        const yc = (y / rect.height) - 0.5;

        gsap.to(el, {
          rotateY: xc * 16,
          rotateX: -yc * 16,
          scale: 1.02,
          boxShadow: '0 20px 40px rgba(45, 42, 38, 0.12)',
          duration: 0.4,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });

      const onMouseLeave = contextSafe(() => {
        gsap.to(el, {
          rotateY: 0,
          rotateX: 0,
          scale: 1,
          boxShadow: '0 2px 8px rgba(45, 42, 38, 0.06)',
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });

      el.addEventListener('mousemove', onMouseMove);
      el.addEventListener('mouseleave', onMouseLeave);

      return () => {
        el.removeEventListener('mousemove', onMouseMove);
        el.removeEventListener('mouseleave', onMouseLeave);
      };
    };

    const cards = containerRef.current.querySelectorAll('.feature-card');
    const cleanupFns = Array.from(cards).map(card => makeTiltCard(card as HTMLElement));

    return () => {
      if (split) {
        split.revert();
      }
      cleanupFns.forEach(fn => fn());
    };
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative min-h-[92vh] flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
      {/* 3D Background Canvas (static gradient fallback for reduced motion) */}
      <div className="absolute inset-0 z-0">
        {prefersReducedMotion ? (
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(ellipse at 30% 20%, rgba(196,168,130,0.12) 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(139,115,85,0.08) 0%, transparent 50%), #FAF8F5',
            }}
          />
        ) : (
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
        )}
      </div>

      {/* Soft edge fade for depth */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(250,248,245,0.45) 100%)`,
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center animate-fade-in">
        {/* Logo / Brand */}
        <div className="mb-10 brand-logo">
            <Logo size={48} className="text-[#8B7355] mx-auto hover:text-[#2D2A26] transition-colors" />
          <h1
            ref={headingRef}
            className="text-6xl md:text-7xl lg:text-8xl font-semibold text-[#2D2A26] tracking-tight leading-[0.95] mb-6"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Stop pretending
            <br />
            <span className="italic text-[#8B7355]">you know</span> JEE.
          </h1>
          <p className="text-[16px] md:text-[17px] text-[#8A8279] font-medium tracking-wide max-w-lg mx-auto leading-relaxed hero-desc">
            ATLAS grills you on Physics, Chemistry & Maths until you actually prove mastery. No hints. No shortcuts. Just a shareable credential when you pass.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 search-container" ref={searchContainerRef}>
          <div className="relative max-w-lg mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8279]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <input
              type="text"
              aria-label="Search a JEE topic to get started"
              placeholder="Try Rotational Dynamics, Electrochemistry, Limits..."
              className="w-full pl-11 pr-5 py-3.5 bg-white/80 backdrop-blur-md border border-[#E8E2D9] rounded-full text-sm text-[#2D2A26] placeholder:text-[#B5AEA5] focus:outline-none focus:border-[#8B7355]/40 focus:ring-2 focus:ring-[#8B7355]/10 transition-colors shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = e.currentTarget.value.trim();
                  navigate(query ? `/signup?topic=${encodeURIComponent(query)}` : '/signup');
                }
              }}
            />
          </div>
        </div>

        {/* Start Button */}
        <div className="mb-16 cta-container" ref={ctaContainerRef}>
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#2D2A26] text-white text-sm font-extrabold rounded-full transition-shadow duration-300 shadow-neo-lg"
          >
            Prove it — free, no signup
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-16" style={{ perspective: 1000 }}>
          {[
            {
              icon: ShieldCheck,
              color: '#8B7355',
              title: 'Prove-It Mode',
              text: 'ATLAS grills you with follow-ups until you truly master a topic. No hints. No guessing.',
            },
            {
              icon: BookOpen,
              color: '#6B8E6B',
              title: 'Daily JEE Prescriptions',
              text: 'Based on your weak areas and backlog, get one prioritized task every morning. No decision fatigue.',
            },
            {
              icon: Calendar,
              color: '#7A6B8A',
              title: 'Squad Accountability',
              text: 'Form a Prove-It squad with friends. Weekly topic, shared streak, and real rigor scores.',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="feature-card group flex flex-col items-center text-center p-6 bg-white/60 backdrop-blur-md border border-[#2D2A26]/[0.05] shadow-neo-sm rounded-2xl transition-shadow duration-300"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div
                className="w-12 h-12 mb-4 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300"
                style={{ backgroundColor: card.color }}
              >
                <card.icon className="w-6 h-6 text-white" strokeWidth={1.6} />
              </div>
              <h3
                className="text-sm font-semibold text-[#2D2A26] mb-1.5"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {card.title}
              </h3>
              <p className="text-xs text-[#8A8279] leading-relaxed max-w-[200px]">{card.text}</p>
            </div>
          ))}
        </div>

        {/* Social proof placeholder */}
        <div className="max-w-md mx-auto text-center social-proof">
          <p className="text-xs text-[#8A8279] font-medium">
            Built for JEE. No AI cheating. Only mastery.
          </p>
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#demo"
        aria-label="Scroll to the live demo"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-[#8A8279] hover:text-[#8B7355] transition-colors scroll-cue"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest">Try the demo</span>
        <ChevronDown className={`w-5 h-5 ${prefersReducedMotion ? '' : 'animate-float'}`} />
      </a>
    </section>
  );
}
