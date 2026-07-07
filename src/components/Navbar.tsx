import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
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
  Zap,
  ChevronRight
} from 'lucide-react';
import { getUserGamification, calculateLevel } from '../lib/gamification';

const navLinks = [
  { href: '/', label: 'Home', icon: Brain, group: 'core' },
  { href: '/atlas', label: 'Atlas Workspace', icon: LayoutDashboard, group: 'core' },
  { href: '/syow', label: 'SYOW', icon: Zap, group: 'core' },
  { href: '/sat-simulator', label: 'SAT Test', icon: FileText, group: 'practice' },
  { href: '/guided-paper', label: 'Solver', icon: HelpCircle, group: 'practice' },
  { href: '/feynman', label: 'Feynman', icon: Mic, group: 'practice' },
  { href: '/create', label: 'New Plan', icon: CalendarPlus, group: 'study' },
  { href: '/plans', label: 'My Plans', icon: BookOpen, group: 'study' },
  { href: '/tools', label: 'Tools', icon: Wrench, group: 'study' },
  { href: '/videos', label: 'Video Lessons', icon: Video, group: 'learn' },
  { href: '/progress', label: 'Progress', icon: LineChart, group: 'learn' },
  { href: '/subscription', label: 'Premium', icon: Crown, group: 'other' },
];

const groupLabels: Record<string, string> = {
  core: 'Core',
  practice: 'Practice',
  study: 'Study',
  learn: 'Learn',
  other: '',
};

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
    progress: number;
  } | null>(null);

  useEffect(() => {
    if (user?.id) loadGamification();
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
          progress: levelInfo.progress || ((data.total_xp % 500) / 500) * 100,
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

  // Group nav links
  const groups = ['core', 'practice', 'study', 'learn', 'other'];
  const grouped = groups.map(g => ({
    key: g,
    label: groupLabels[g],
    links: navLinks.filter(l => l.group === g),
  })).filter(g => g.links.length > 0);

  const NavItem = ({ link, onClick }: { link: any; onClick?: () => void }) => {
    const isActive = location.pathname === link.href;

    return (
      <NavLink
        to={link.href}
        onClick={onClick}
        className={`relative group flex items-center gap-3 px-3.5 py-2.5 transition-all duration-200 rounded-xl text-[13px]
          ${isActive
            ? 'bg-gradient-to-r from-[#00D1FF]/10 to-[#6366F1]/10 text-[#0A192F] font-bold'
            : 'text-[#64748B] hover:text-[#0A192F] hover:bg-[#0A192F]/[0.03] font-medium'
          }
        `}
      >
        {/* Active indicator */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-gradient-to-b from-[#00D1FF] to-[#6366F1]" />
        )}

        <link.icon className={`w-[18px] h-[18px] ${isActive ? 'text-[#6366F1]' : 'text-[#94A3B8] group-hover:text-[#64748B]'} transition-colors flex-shrink-0`} />
        <span className="truncate">{link.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile toggle */}
      <div className="md:hidden fixed top-4 right-4 z-[100]">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2.5 rounded-xl shadow-neo-sm text-white"
          style={{ background: 'linear-gradient(135deg, #8B7355, #2D2A26)' }}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen bg-white/80 backdrop-blur-xl border-r border-[#0A192F]/[0.06] transition-all duration-300 z-40 flex-col w-64">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-[#0A192F]/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#8B7355]/10 border border-[#8B7355]/20 shadow-sm">
              <Logo size={22} className="text-[#8B7355]" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-[#0A192F] leading-none tracking-tight font-display">Elevenfolks</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#8B7355] mt-0.5">Student</p>
            </div>
          </div>
        </div>

        {/* Gamification Stats */}
        {gamificationData && (
          <div className="px-5 py-4 border-b border-[#0A192F]/[0.04]">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F472B6]/[0.08] border border-[#F472B6]/10">
                <Flame className="w-3.5 h-3.5 text-[#F472B6]" />
                <span className="text-xs font-bold text-[#F472B6] tabular-nums">{gamificationData.streak}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00D1FF]/[0.08] border border-[#00D1FF]/10">
                <Zap className="w-3.5 h-3.5 text-[#00D1FF]" />
                <span className="text-xs font-bold text-[#00D1FF] tabular-nums">{gamificationData.totalXp}</span>
              </div>
            </div>
            {/* XP Progress bar */}
            <div className="flex items-center gap-2">
              <span className="text-base">{gamificationData.badge}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Level {gamificationData.level}</span>
                </div>
                <div className="w-full h-1.5 bg-[#0A192F]/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${gamificationData.progress}%`,
                      background: 'linear-gradient(90deg, #00D1FF, #6366F1)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {grouped.map(group => (
            <div key={group.key}>
              {group.label && (
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-3.5 mb-1.5">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <NavItem key={link.href} link={link} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-[#0A192F]/[0.04]">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                {user?.email?.[0].toUpperCase()}
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#F59E0B] text-white rounded-md flex items-center justify-center shadow-xs">
                  <Crown size={8} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0A192F] truncate leading-tight">
                {user?.user_metadata?.full_name || 'Student'}
              </p>
              <p className="text-[11px] font-medium text-[#94A3B8] truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-full p-2.5 rounded-xl bg-[#0A192F]/[0.03] hover:bg-[#0A192F]/[0.06] text-[#64748B] hover:text-[#0A192F] font-semibold text-sm transition-all gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[99] bg-white/95 backdrop-blur-xl overflow-y-auto">
          <div className="flex flex-col min-h-screen p-6 pt-20">
            <div className="flex-1 space-y-1">
              {navLinks.map((link) => (
                <NavItem
                  key={link.href}
                  link={link}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[#0A192F]/[0.06]">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-[#0A192F]/[0.04] hover:bg-[#0A192F]/[0.08] text-[#0A192F] font-semibold text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
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
