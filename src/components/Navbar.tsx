import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CalendarPlus,
  BookOpen,
  Wrench,
  LineChart,
  LogOut,
  Menu,
  X,
  Crown,
  Brain,
  Video,
  Users,
  HelpCircle,
  FileText,
  Mic,
  Flame,
  Zap
} from 'lucide-react';
import { getUserGamification, calculateLevel } from '../lib/gamification';

const navLinks = [
  { href: '/', label: 'HOME', icon: Brain, color: 'text-primary' },
  { href: '/atlas', label: 'ATLAS WORKSPACE', icon: LayoutDashboard, color: 'text-blue-400' },
  { href: '/syow', label: 'SYOW', icon: Zap, color: 'text-amber-400' },
  { href: '/sat-simulator', label: 'SAT TEST', icon: FileText, color: 'text-indigo-400' },
  { href: '/create', label: 'NEW PLAN', icon: CalendarPlus, color: 'text-emerald-400' },
  { href: '/plans', label: 'MY PLANS', icon: BookOpen, color: 'text-slate-400' },
  { href: '/guided-paper', label: 'SOLVER', icon: HelpCircle, color: 'text-sky-400' },
  { href: '/feynman', label: 'FEYNMAN', icon: Mic, color: 'text-rose-400' },
  { href: '/tools', label: 'TOOLS', icon: Wrench, color: 'text-slate-400' },
  { href: '/videos', label: 'VIDEO LESSONS', icon: Video, color: 'text-violet-400' },
  { href: '/social', label: 'SOCIAL HUB', icon: Users, color: 'text-blue-400' },
  { href: '/progress', label: 'PROGRESS', icon: LineChart, color: 'text-amber-400' },
  { href: '/subscription', label: 'PREMIUM', icon: Crown, color: 'text-primary' },
];

const Navbar = () => {
  const { signOut, user, isPremium } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [gamificationData, setGamificationData] = useState<{
    streak: number;
    totalXp: number;
    level: number;
    badge: string;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadGamification();
    }
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', '16rem');
  }, []);

  const loadGamification = async () => {
    try {
      const data = await getUserGamification(user.id);
      if (data) {
        const levelInfo = calculateLevel(data.total_xp);
        setGamificationData({
          streak: data.current_streak,
          totalXp: data.total_xp,
          level: levelInfo.level,
          badge: levelInfo.badge,
        });
      }
    } catch (error) {
      console.error('Error loading gamification:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const NavItem = ({ link, onClick }: { link: any, onClick?: () => void }) => {
    const isActive = location.pathname === link.href;

    return (
      <NavLink
        to={link.href}
        onClick={onClick}
        className={`relative group flex items-center px-4 py-3 my-1 transition-all duration-200 rounded-xl
          ${isActive
            ? 'bg-primary/10 border border-primary/20 text-white shadow-lg'
            : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }
        `}
      >
        <div className={`flex items-center justify-center w-5 h-5 ${isActive ? 'scale-110' : 'group-hover:scale-110 text-slate-500'} transition-transform`}>
          <link.icon className={`w-5 h-5 stroke-[2px] ${isActive ? link.color : ''}`} />
        </div>

        <span className={`ml-4 font-black text-[10px] tracking-[0.1em] uppercase whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
          {link.label}
        </span>

        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
        )}
      </NavLink>
    );
  };

  return (
    <>
      <div className="md:hidden fixed top-4 right-4 z-[100]">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-primary text-white rounded-xl shadow-lg ring-1 ring-primary/20"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen bg-card-dark border-r border-white/5 transition-all duration-300 z-40 flex-col w-64 shadow-2xl"
      >
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center">
              <span className="text-sm font-black text-primary">EF</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none uppercase tracking-tighter italic">StudyBud</h1>
              <p className="text-[8px] font-black tracking-[0.3em] text-slate-500 uppercase mt-1">ElevenFolks</p>
            </div>
          </div>
        </div>

        {/* Gamification Stats */}
        {gamificationData && (
          <div className="flex flex-col gap-3 px-6 py-5 border-b border-white/5 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-neo-accent" />
                <span className="text-sm font-black text-white">{gamificationData.streak} DAYS</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-black text-white">{gamificationData.totalXp} XP</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="text-lg">{gamificationData.badge}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Level {gamificationData.level} Learner</span>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 py-6 space-y-1">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-slate-800 flex items-center justify-center text-white font-black">
                {user?.email?.[0].toUpperCase()}
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-[8px] border border-card-dark">
                  <Crown size={8} fill="white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate uppercase tracking-tight">
                {user?.user_metadata?.full_name || 'STUDENT'}
              </p>
              <p className="text-[9px] font-bold text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black uppercase tracking-widest text-[9px] transition-all gap-2 border border-white/5 shadow-lg shadow-black/20"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-slate-950 overflow-y-auto no-scrollbar">
          <div className="flex flex-col min-h-screen p-6">
            <div className="flex items-center justify-between mb-8 border-b-4 border-white/10 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neo-accent border border-white/10 shadow-neo flex items-center justify-center">
                  <span className="text-xl font-black text-slate-100">EF</span>
                </div>
                <h1 className="text-2xl font-black text-slate-100 uppercase">StudyBud</h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 bg-slate-800 border border-white/10 shadow-neo"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 space-y-3">
              {navLinks.map((link) => (
                <NavItem
                  key={link.href}
                  link={link}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>

            <div className="mt-8 pt-8 border-t-4 border-white/10 pb-6 text-slate-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-4 p-4 border border-white/10 bg-slate-800 hover:bg-red-400 font-black uppercase tracking-widest text-sm"
              >
                <LogOut className="w-5 h-5 stroke-[3px]" />
                SIGN OUT
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
