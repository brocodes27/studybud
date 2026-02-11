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
  { href: '/', label: 'HOME', icon: Brain, color: 'bg-neo-accent' },
  { href: '/atlas', label: 'ATLAS WORKSPACE', icon: LayoutDashboard, color: 'bg-neo-secondary' },
  { href: '/syow', label: 'SYOW', icon: Zap, color: 'bg-neo-accent' },
  { href: '/sat-simulator', label: 'SAT TEST', icon: FileText, color: 'bg-neo-accent' },
  { href: '/create', label: 'NEW PLAN', icon: CalendarPlus, color: 'bg-neo-secondary' },
  { href: '/plans', label: 'MY PLANS', icon: BookOpen, color: 'bg-neo-muted' },
  { href: '/guided-paper', label: 'SOLVER', icon: HelpCircle, color: 'bg-neo-accent' },
  { href: '/feynman', label: 'FEYNMAN', icon: Mic, color: 'bg-neo-muted' },
  { href: '/tools', label: 'TOOLS', icon: Wrench, color: 'bg-neo-muted' },
  { href: '/videos', label: 'VIDEO LESSONS', icon: Video, color: 'bg-neo-accent' },
  { href: '/social', label: 'SOCIAL HUB', icon: Users, color: 'bg-neo-secondary' },
  { href: '/progress', label: 'PROGRESS', icon: LineChart, color: 'bg-neo-secondary' },
  { href: '/subscription', label: 'PREMIUM', icon: Crown, color: 'bg-neo-accent' },
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

  // Load gamification data
  useEffect(() => {
    if (user?.id) {
      loadGamification();
    }
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', '16rem');
    return () => {
      // document.documentElement.style.setProperty('--sidebar-width', '0px');
    };
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
        className={`relative group flex items-center px-3 py-1.5 my-0.5 border-2 transition-all duration-100
          ${isActive
            ? `${link.color} border-black shadow-[2px_2px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]`
            : 'border-transparent hover:border-black hover:bg-black/5'
          }
        `}
      >
        <div className={`flex items-center justify-center w-6 h-6 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
          <link.icon className="w-5 h-5 stroke-[2px] text-black" />
        </div>

        <span className="ml-3 font-black text-xs tracking-tight text-black whitespace-nowrap">
          {link.label}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-neo-accent border-4 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen bg-neo-bg border-r-2 border-black transition-all duration-300 z-40 flex-col w-64"
      >
        <div className="h-16 flex items-center px-5 border-b-2 border-black bg-neo-secondary">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-neo-accent border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center">
              <span className="text-sm font-black text-black">EF</span>
            </div>
            <div>
              <h1 className="text-base font-black text-black leading-none uppercase tracking-tight">StudyBud</h1>
              <p className="text-[7px] font-black tracking-[0.1em] text-black/60">BY ELEVENFOLKS</p>
            </div>
          </div>
        </div>

        {/* Gamification Stats */}
        {gamificationData && (
          <div className="flex gap-3 px-4 py-3 border-b-2 border-black/10 bg-white">
            {/* Streak */}
            <div className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-1 bg-orange-100 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_#000]">
                <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                <span className="text-xs font-black">{gamificationData.streak}d</span>
              </div>
            </div>

            {/* XP */}
            <div className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-1 bg-green-100 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_#000]">
                <Zap className="w-3 h-3 text-green-600" />
                <span className="text-xs font-black">{gamificationData.totalXp}</span>
              </div>
            </div>

            {/* Level */}
            <div className="flex items-center gap-1 bg-purple-100 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_#000]">
              <span className="text-sm">{gamificationData.badge}</span>
              <span className="text-xs font-black">L{gamificationData.level}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar pt-6 px-4 space-y-1">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </div>

        <div className="p-3 border-t-2 border-black bg-white">
          <div className="relative group flex items-center gap-2 mb-3">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-black bg-neo-muted flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
                <span className="text-black font-black text-sm">{user?.email?.[0].toUpperCase()}</span>
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-neo-secondary border border-black rounded-full flex items-center justify-center">
                  <Crown className="w-2 w-2 text-black" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-black truncate uppercase">
                {user?.user_metadata?.full_name || 'STUDENT'}
              </p>
              <p className="text-[8px] font-bold text-black truncate opacity-70">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="relative group flex items-center justify-center w-full p-2 border-2 border-black bg-neo-white hover:bg-red-400 font-bold uppercase tracking-wider transition-all gap-2"
          >
            <LogOut className="w-4 h-4 stroke-[2px]" />
            <span className="text-[10px] text-black">SIGN OUT</span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-neo-bg overflow-y-auto no-scrollbar">
          <div className="flex flex-col min-h-screen p-6">
            <div className="flex items-center justify-between mb-8 border-b-4 border-black pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neo-accent border-4 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center">
                  <span className="text-xl font-black text-black">EF</span>
                </div>
                <h1 className="text-2xl font-black text-black uppercase">StudyBud</h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000]"
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

            <div className="mt-8 pt-8 border-t-4 border-black pb-6 text-black">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-4 p-4 border-4 border-black bg-white hover:bg-red-400 font-black uppercase tracking-widest text-sm"
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
