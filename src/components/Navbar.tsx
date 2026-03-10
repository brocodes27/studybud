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
  HelpCircle,
  FileText,
  Mic,
  Flame,
  Zap
} from 'lucide-react';
import { getUserGamification, calculateLevel } from '../lib/gamification';

const navLinks = [
  { href: '/', label: 'HOME', icon: Brain, color: 'text-white' },
  { href: '/atlas', label: 'ATLAS WORKSPACE', icon: LayoutDashboard, color: 'text-white' },
  { href: '/syow', label: 'SYOW', icon: Zap, color: 'text-white' },
  { href: '/sat-simulator', label: 'SAT TEST', icon: FileText, color: 'text-white' },
  { href: '/create', label: 'NEW PLAN', icon: CalendarPlus, color: 'text-white' },
  { href: '/plans', label: 'MY PLANS', icon: BookOpen, color: 'text-white' },
  { href: '/guided-paper', label: 'SOLVER', icon: HelpCircle, color: 'text-white' },
  { href: '/feynman', label: 'FEYNMAN', icon: Mic, color: 'text-white' },
  { href: '/tools', label: 'TOOLS', icon: Wrench, color: 'text-white' },
  { href: '/videos', label: 'VIDEO LESSONS', icon: Video, color: 'text-white' },
  { href: '/progress', label: 'PROGRESS', icon: LineChart, color: 'text-white' },
  { href: '/subscription', label: 'PREMIUM', icon: Crown, color: 'text-white' },
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
        className={`relative group flex items-center px-5 py-3.5 my-1.5 transition-all duration-300 rounded-full
          ${isActive
            ? 'bg-primary text-secondary shadow-float-cyan font-bold scale-105'
            : 'text-slate-400 hover:text-white hover:bg-white/10 font-medium'
          }
        `}
      >
        <div className={`flex items-center justify-center w-5 h-5 ${isActive ? 'scale-110 text-secondary' : 'group-hover:scale-110 text-slate-300'} transition-transform`}>
          <link.icon className={`w-5 h-5 stroke-[2.5px] ${isActive ? 'text-secondary' : ''}`} />
        </div>

        <span className={`ml-4 text-[13px] tracking-wide whitespace-nowrap ${isActive ? 'text-secondary' : ''}`}>
          {link.label}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      <div className="md:hidden fixed top-4 right-4 z-[100]">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-primary text-secondary rounded-full shadow-float-cyan"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6 stroke-[3px]" /> : <Menu className="w-6 h-6 stroke-[3px]" />}
        </button>
      </div>

      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen bg-secondary border-r border-[#112240] transition-all duration-300 z-40 flex-col w-64 shadow-2xl rounded-r-[40px]"
      >
        <div className="h-24 flex items-center px-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary text-secondary rounded-full flex items-center justify-center shadow-float-cyan font-extrabold text-lg">
              EF
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white leading-none tracking-tight">Elevenfolks</h1>
              <p className="text-[10px] font-bold text-primary uppercase mt-1">Student App</p>
            </div>
          </div>
        </div>

        {/* Gamification Stats */}
        {gamificationData && (
          <div className="flex flex-col gap-3 px-8 py-6 border-b border-white/5 bg-[#112240]/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-accent" />
                <span className="text-sm font-bold text-white">{gamificationData.streak} DAYS</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-white">{gamificationData.totalXp} XP</span>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/20 rounded-full mt-2">
              <span className="text-xl">{gamificationData.badge}</span>
              <span className="text-xs font-bold uppercase tracking-wide text-primary">Level {gamificationData.level} Learner</span>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-2">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-[#112240]/80 rounded-br-[40px]">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary text-secondary flex items-center justify-center font-extrabold text-lg shadow-float-cyan">
                {user?.email?.[0].toUpperCase()}
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-playful-gold text-secondary rounded-full flex items-center justify-center shadow-md">
                  <Crown size={10} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user?.user_metadata?.full_name || 'STUDENT'}
              </p>
              <p className="text-xs font-medium text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-full p-3.5 rounded-full bg-white/10 hover:bg-accent text-white font-bold transition-all gap-2"
          >
            <LogOut className="w-5 h-5 stroke-[2.5px]" />
            Sign Out
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-secondary overflow-y-auto no-scrollbar">
          <div className="flex flex-col min-h-screen p-6">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary text-secondary rounded-full flex items-center justify-center shadow-float-cyan font-extrabold text-xl">
                  EF
                </div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">Elevenfolks</h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X className="w-6 h-6 stroke-[3px]" />
              </button>
            </div>

            <div className="flex-1 space-y-3 px-2">
              {navLinks.map((link) => (
                <NavItem
                  key={link.href}
                  link={link}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 px-2 pb-6">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-full bg-white/10 hover:bg-accent text-white font-bold text-base transition-colors"
              >
                <LogOut className="w-5 h-5 stroke-[3px]" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
