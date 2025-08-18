import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Brain, Check, Star, Zap, Users, BarChart3, Crown, ArrowRight, Play, Shield, Sparkles, Target, BookOpen, TrendingUp, MessageCircle, User, Rocket, Award, Clock, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { supabase } from '../lib/supabase';
import { Navigate, Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

// Enhanced Particle Background
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 0.8,
      dy: (Math.random() - 0.5) * 0.8,
      alpha: Math.random() * 0.6 + 0.2,
      color: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'][Math.floor(Math.random() * 4)]
    }));
    
    let animationId: number;
    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let p of particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
        
        p.x += p.dx;
        p.y += p.dy;
        
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full z-0 pointer-events-none" 
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }} 
    />
  );
};

const Landing: React.FC = () => {
  const { role, loading, signUp, signIn, signInWithGoogle } = useAuth() as any;
  const { showToast } = useToast();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }
  
  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }
  
  const [isSignUp, setIsSignUp] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    grade: '',
    school: ''
  });
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) {
        showToast(error.message || 'Google sign-in failed', 'error');
      }
      // On success, Supabase will redirect; no further action needed here.
    } catch (e: any) {
      showToast(e.message || 'Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.full_name,
          grade: selectedRole === 'student' ? formData.grade : undefined,
          school: formData.school,
          role: selectedRole
        });
        
        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Account created successfully! Welcome to ElevenFolks!', 'success');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        
        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Welcome back!', 'success');
        }
      }
    } catch (error: any) {
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Study Plans',
      description: 'Get personalized study schedules tailored to your learning style and exam dates.',
      color: 'from-primary-500 to-primary-600'
    },
    {
      icon: Target,
      title: 'Smart Progress Tracking',
      description: 'Monitor your learning progress with detailed analytics and performance insights.',
      color: 'from-success-500 to-success-600'
    },
    {
      icon: Users,
      title: 'Study Groups',
      description: 'Connect with peers, share notes, and study together in virtual study rooms.',
      color: 'from-accent-500 to-accent-600'
    },
    {
      icon: BookOpen,
      title: 'Interactive Flashcards',
      description: 'Create and study with AI-generated flashcards for better retention.',
      color: 'from-warning-500 to-warning-600'
    },
    {
      icon: BarChart3,
      title: 'Practice Tests',
      description: 'Take mock exams and practice tests to prepare for your actual exams.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: MessageCircle,
      title: 'AI Study Buddy',
      description: 'Get instant help and explanations from our AI-powered study assistant.',
      color: 'from-cyan-500 to-cyan-600'
    }
  ];

  const testimonials = [
    {
      name: 'Priya Sharma',
      grade: 'Class 12',
      text: 'ElevenFolks helped me improve my JEE preparation by 40%. The personalized study plans are incredible!',
      rating: 5,
      avatar: 'PS'
    },
    {
      name: 'Arjun Patel',
      grade: 'Class 10',
      text: 'The AI flashcards and practice tests made studying so much more effective. Highly recommend!',
      rating: 5,
      avatar: 'AP'
    },
    {
      name: 'Sneha Reddy',
      grade: 'Class 11',
      text: 'Study groups feature helped me connect with other students. We motivate each other every day!',
      rating: 5,
      avatar: 'SR'
    }
  ];

  const stats = [
    { number: '200+', label: 'Active Students', icon: Users },
    { number: '95%', label: 'Success Rate', icon: Award },
    { number: '24/7', label: 'AI Support', icon: Clock },
    { number: '150+', label: 'Countries', icon: Globe }
  ];

  // GSAP animation refs
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const heroHeadlineRef = useRef<HTMLHeadingElement>(null);
  const heroSubheadlineRef = useRef<HTMLParagraphElement>(null);
  const heroIconsRef = useRef<HTMLDivElement>(null);
  const bgBlob1Ref = useRef<SVGSVGElement>(null);
  const bgBlob2Ref = useRef<SVGSVGElement>(null);
  const bgBlob3Ref = useRef<SVGSVGElement>(null);
  const featureCardsRef = useRef<HTMLDivElement>(null);
  const testimonialsSectionRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLDivElement>(null);
  const heroIconsParallaxRef = useRef<HTMLDivElement>(null);
  const featureCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Hero Animation
  useEffect(() => {
    const tl = gsap.timeline();
    tl.from(heroHeadlineRef.current, { opacity: 0, y: 80, scale: 0.8, duration: 1.2, ease: 'expo.out' })
      .from(heroSubheadlineRef.current, { opacity: 0, y: 40, duration: 1, ease: 'expo.out' }, '-=0.8')
      .from(heroIconsRef.current, { opacity: 0, scale: 0.5, duration: 1, ease: 'back.out(1.7)' }, '-=0.7');
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroIconsParallaxRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      gsap.to(heroIconsParallaxRef.current, { x, y, duration: 0.5, ease: 'power3.out' });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Hero Blobs Animation
  useEffect(() => {
    [bgBlob1Ref, bgBlob2Ref, bgBlob3Ref].forEach((ref, i) => {
      if (ref.current) {
        gsap.to(ref.current, {
          y: i % 2 === 0 ? '+=60' : '-=60',
          x: i === 1 ? '+=40' : '-=40',
          scale: 1.1 + i * 0.1,
          repeat: -1,
          yoyo: true,
          duration: 8 + i * 2,
          ease: 'sine.inOut',
        });
      }
    });
  }, []);

  // Feature Cards Animation
  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      ScrollTrigger.batch('.feature-card', {
        onEnter: batch => gsap.to(batch, {
          opacity: 1,
          y: 0,
          rotateY: 0,
          scale: 1,
          stagger: 0.12,
          duration: 1.2,
          ease: 'power3.out',
        }),
        onLeaveBack: batch => gsap.set(batch, { opacity: 0, y: 80, rotateY: 30, scale: 0.8 }),
        start: 'top 80%',
        once: false,
      });
    }, featureCardsRef);
    return () => ctx.revert();
  }, []);

  // 3D Hover Effects
  useEffect(() => {
    featureCardRefs.current.forEach((card) => {
      if (!card) return;
      const handleMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(card, {
          rotateY: x / 10,
          rotateX: -y / 10,
          scale: 1.05,
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.25)',
          duration: 0.3,
          ease: 'power2.out',
        });
      };
      const handleLeave = () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, scale: 1, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)', duration: 0.4, ease: 'power2.out' });
      };
      card.addEventListener('mousemove', handleMove);
      card.addEventListener('mouseleave', handleLeave);
      return () => {
        card.removeEventListener('mousemove', handleMove);
        card.removeEventListener('mouseleave', handleLeave);
      };
    });
  }, [features.length]);

  // Testimonials Animation
  useEffect(() => {
    if (testimonialsSectionRef.current) {
      gsap.fromTo(
        testimonialsSectionRef.current.querySelectorAll('.testimonial-card'),
        { opacity: 0, y: 60, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: testimonialsSectionRef.current,
            start: 'top 80%',
          },
        }
      );
    }
  }, [testimonials.length]);

  // CTA Animation
  useEffect(() => {
    if (ctaSectionRef.current) {
      gsap.fromTo(
        ctaSectionRef.current,
        { opacity: 0, y: 60, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ctaSectionRef.current,
            start: 'top 90%',
          },
        }
      );
      gsap.to(ctaSectionRef.current, {
        boxShadow: '0 0 32px 8px #00e6ff44',
        repeat: -1,
        yoyo: true,
        duration: 2.5,
        ease: 'sine.inOut',
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 overflow-hidden">
      {/* Enhanced Particle Background */}
      <ParticleBackground />
      
      {/* Animated SVG Blobs */}
      <svg ref={bgBlob1Ref} className="absolute top-20 left-20 w-72 h-72 z-0 opacity-30" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#3b82f6" d="M44.8,-67.2C57.2,-59.2,65.7,-44.2,70.2,-28.7C74.7,-13.2,75.2,2.8,70.2,16.7C65.2,30.6,54.7,42.4,41.2,51.2C27.7,60,11.2,65.8,-4.7,68.2C-20.6,70.6,-41.2,69.6,-54.2,59.2C-67.2,48.8,-72.7,29,-71.2,11.2C-69.7,-6.7,-61.2,-22.5,-50.2,-31.7C-39.2,-40.9,-25.6,-43.5,-11.7,-51.2C2.2,-58.9,17.4,-71.2,32.7,-73.2C48,-75.2,64.7,-67.2,44.8,-67.2Z" transform="translate(100 100)" />
      </svg>
      <svg ref={bgBlob2Ref} className="absolute bottom-20 right-20 w-96 h-96 z-0 opacity-30" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#a21caf" d="M44.8,-67.2C57.2,-59.2,65.7,-44.2,70.2,-28.7C74.7,-13.2,75.2,2.8,70.2,16.7C65.2,30.6,54.7,42.4,41.2,51.2C27.7,60,11.2,65.8,-4.7,68.2C-20.6,70.6,-41.2,69.6,-54.2,59.2C-67.2,48.8,-72.7,29,-71.2,11.2C-69.7,-6.7,-61.2,-22.5,-50.2,-31.7C-39.2,-40.9,-25.6,-43.5,-11.7,-51.2C2.2,-58.9,17.4,-71.2,32.7,-73.2C48,-75.2,64.7,-67.2,44.8,-67.2Z" transform="translate(100 100)" />
      </svg>
      <svg ref={bgBlob3Ref} className="absolute top-1/2 left-1/2 w-64 h-64 z-0 opacity-30" style={{ transform: 'translate(-50%, -50%)' }} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#06b6d4" d="M44.8,-67.2C57.2,-59.2,65.7,-44.2,70.2,-28.7C74.7,-13.2,75.2,2.8,70.2,16.7C65.2,30.6,54.7,42.4,41.2,51.2C27.7,60,11.2,65.8,-4.7,68.2C-20.6,70.6,-41.2,69.6,-54.2,59.2C-67.2,48.8,-72.7,29,-71.2,11.2C-69.7,-6.7,-61.2,-22.5,-50.2,-31.7C-39.2,-40.9,-25.6,-43.5,-11.7,-51.2C2.2,-58.9,17.4,-71.2,32.7,-73.2C48,-75.2,64.7,-67.2,44.8,-67.2Z" transform="translate(100 100)" />
      </svg>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold gradient-text">ElevenFolks</span>
              </div>
              <div className="hidden md:flex items-center space-x-8">
                <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
                <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Testimonials</a>
                
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section ref={heroRef} className="pt-32 pb-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <div ref={heroIconsParallaxRef} className="flex justify-center mb-8">
              <div ref={heroIconsRef} className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center glow-blue">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div className="w-16 h-16 bg-gradient-to-r from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center glow-purple">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <div className="w-16 h-16 bg-gradient-to-r from-success-500 to-success-600 rounded-2xl flex items-center justify-center glow-green">
                  <Rocket className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
            
            <h1 ref={heroHeadlineRef} className="text-6xl md:text-7xl font-bold text-white mb-6">
              Master Your Studies with{' '}
              <span className="gradient-text">AI-Powered</span> Learning
            </h1>
            
            <p ref={heroSubheadlineRef} className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Personalized study plans, smart progress tracking, and AI-powered tools to help you excel in your academic journey.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                variant="primary"
                size="xl"
                icon={<Rocket className="w-6 h-6" />}
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Learning Free
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <stat.icon className="w-6 h-6 text-primary-400 mr-2" />
                    <span className="text-3xl font-bold text-white">{stat.number}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Auth Form */}
        <section id="auth" className="py-20 px-6 bg-gray-800/30">
          <div className="max-w-md mx-auto">
            <div className="card-elevated">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {isSignUp ? 'Join ElevenFolks Today' : 'Welcome Back'}
                </h2>
                <p className="text-gray-400">
                  {isSignUp ? 'Start your learning journey with AI-powered study tools' : 'Continue your learning journey'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {isSignUp && (
                  <>
                    <Input
                      label="Full Name"
                      placeholder="Enter your full name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                    
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">I am a:</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRole('student')}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                            selectedRole === 'student'
                              ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                              : 'border-gray-600 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          <User className="w-6 h-6 mx-auto mb-2" />
                          <span className="text-sm font-medium">Student</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRole('teacher')}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                            selectedRole === 'teacher'
                              ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                              : 'border-gray-600 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          <Shield className="w-6 h-6 mx-auto mb-2" />
                          <span className="text-sm font-medium">Teacher</span>
                        </button>
                      </div>
                    </div>

                    {selectedRole === 'student' && (
                      <Input
                        label="Grade/Class"
                        placeholder="e.g., Class 12, Grade 10"
                        value={formData.grade}
                        onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                        required
                      />
                    )}

                    <Input
                      label="School/Institution"
                      placeholder="Enter your school name"
                      value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                      required
                    />
                  </>
                )}

                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={formLoading}
                  className="w-full"
                >
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="mx-3 text-gray-400 text-sm">or</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              {/* Google Sign-In */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                loading={googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                }
              >
                Continue with Google
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" ref={featuresRef} className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Powerful Features for{' '}
                <span className="gradient-text">Modern Learning</span>
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Everything you need to excel in your studies, powered by cutting-edge AI technology.
              </p>
            </div>

            <div ref={featureCardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  ref={(el) => (featureCardRefs.current[index] = el)}
                  className="feature-card card-elevated opacity-0 transform translate-y-20 rotate-y-30 scale-90"
                >
                  <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                  <p className="text-gray-300 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" ref={testimonialsSectionRef} className="py-20 px-6 bg-gray-800/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Loved by{' '}
                <span className="gradient-text">Students Worldwide</span>
              </h2>
              <p className="text-xl text-gray-300">
                Join thousands of students who have transformed their learning experience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="testimonial-card card-elevated">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center mr-4">
                      <span className="text-white font-semibold">{testimonial.avatar}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{testimonial.name}</h4>
                      <p className="text-gray-400 text-sm">{testimonial.grade}</p>
                    </div>
                    <div className="ml-auto flex items-center">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-300 leading-relaxed italic">"{testimonial.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section ref={ctaSectionRef} className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="card-elevated bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-primary-500/30">
              <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <Rocket className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Transform Your Learning?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of students who are already achieving their academic goals with ElevenFolks.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="primary"
                  size="xl"
                  icon={<Sparkles className="w-6 h-6" />}
                  onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-gray-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-3 mb-4 md:mb-0">
                <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold gradient-text">ElevenFolks</span>
              </div>
              <div className="flex items-center space-x-6 text-gray-400"></div>

            </div>
            <div className="mt-8 pt-8 border-t border-gray-800/50 text-center text-gray-400">
              <p>&copy; 2024 ElevenFolks. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;