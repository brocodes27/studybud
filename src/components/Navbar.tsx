import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CalendarPlus,
  BookOpen,
  ListChecks,
  Wrench,
  LineChart,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Crown,
  Brain,
  Video,
  HelpCircle,
  FileText,
  Mic
} from 'lucide-react';

const navLinks = [
  { href: '/', label: 'RANJAN SIR', icon: Brain, color: 'bg-neo-accent' },
  { href: '/my-classes', label: 'MY CLASSES', icon: Users, color: 'bg-neo-secondary' },
  { href: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard, color: 'bg-neo-muted' },
  { href: '/cbse-simulator', label: 'CBSE SIM', icon: FileText, color: 'bg-neo-accent' },
  { href: '/create', label: 'CREATE PLAN', icon: CalendarPlus, color: 'bg-neo-secondary' },
  { href: '/plans', label: 'STUDY PLANS', icon: BookOpen, color: 'bg-neo-muted' },
  { href: '/guided-paper', label: 'PAPER SOLVER', icon: HelpCircle, color: 'bg-neo-accent' },
  { href: '/feynman', label: 'FEYNMAN BOARD', icon: Mic, color: 'bg-neo-muted' },
  { href: '/curriculum', label: 'CURRICULUM', icon: ListChecks, color: 'bg-neo-secondary' },
  { href: '/tools', label: 'STUDY TOOLS', icon: Wrench, color: 'bg-neo-muted' },
  { href: '/videos', label: 'VIDEO LESSONS', icon: Video, color: 'bg-neo-accent' },
  { href: '/progress', label: 'PROGRESS', icon: LineChart, color: 'bg-neo-secondary' },
  { href: '/social', label: 'SOCIAL', icon: Users, color: 'bg-neo-muted' },
];

const Navbar = () => {
  const { signOut, user, isPremium } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isCollapsed]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const NavItem = ({ link }: { link: any }) => {
    const isActive = location.pathname === link.href;

    return (
      <NavLink
        to={link.href}
        className={`relative group flex items-center px-4 py-2 my-1 border-2 transition-all duration-100
          ${isActive
            ? `${link.color} border-black shadow-[4px_4px_0px_0px_#000] translate-x-[-2px] translate-y-[-2px]`
            : 'border-transparent hover:border-black hover:bg-black/5'
          }
        `}
      >
        <div className={`flex items-center justify-center w-8 h-8 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
          <link.icon className="w-6 h-6 stroke-[2.5px] text-black" />
        </div>

        {!isCollapsed ? (
          <span className="ml-3 font-black text-sm tracking-widest text-black whitespace-nowrap">
            {link.label}
          </span>
        ) : (
          <div className="absolute left-20 ml-4 pointer-events-none z-[100] opacity-0 group-hover:opacity-100 transition-opacity bg-neo-secondary border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_#000]">
            <span className="font-black text-xs uppercase tracking-widest text-black whitespace-nowrap">
              {link.label}
            </span>
          </div>
        )}
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
        className={`hidden md:flex fixed left-0 top-0 h-screen bg-neo-bg border-r-4 border-black transition-all duration-300 z-40 flex-col
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
      >
        <div className="h-24 flex items-center px-6 border-b-4 border-black bg-neo-secondary">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-neo-accent border-4 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center">
              <span className="text-2xl font-black text-black">EF</span>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-black text-black leading-none">STUDYBUD</h1>
                <p className="text-[10px] font-black tracking-[0.2em] text-black/60">BY ELEVENFOLKS</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-visible pt-6 px-4 space-y-1">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </div>

        <div className="p-4 border-t-4 border-black bg-white">
          <div className={`relative group flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} mb-4`}>
            <div className="relative">
              <div className="w-12 h-12 border-4 border-black bg-neo-muted flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
                <span className="text-black font-black text-lg">{user?.email?.[0].toUpperCase()}</span>
              </div>
              {isPremium && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-neo-secondary border-2 border-black rounded-full flex items-center justify-center">
                  <Crown className="w-3 h-3 text-black" />
                </div>
              )}
            </div>
            {!isCollapsed ? (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-black truncate uppercase">
                  {user?.user_metadata?.full_name || 'STUDENT'}
                </p>
                <p className="text-[10px] font-bold text-black truncate opacity-70">{user?.email}</p>
              </div>
            ) : (
              <div className="absolute left-20 ml-2 pointer-events-none z-[100] opacity-0 group-hover:opacity-100 transition-opacity bg-neo-secondary border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_#000]">
                <span className="font-black text-xs uppercase tracking-widest text-black whitespace-nowrap">
                  PROFILE
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className={`relative group flex items-center justify-center w-full p-3 border-4 border-black bg-neo-white hover:bg-red-400 font-bold uppercase tracking-widest transition-all
              ${isCollapsed ? '' : 'gap-2'}
            `}
          >
            <LogOut className="w-5 h-5 stroke-[3px]" />
            {!isCollapsed ? (
              <span className="text-xs">SIGN OUT</span>
            ) : (
              <div className="absolute left-20 ml-2 pointer-events-none z-[100] opacity-0 group-hover:opacity-100 transition-opacity bg-red-400 border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_#000]">
                <span className="font-black text-xs uppercase tracking-widest text-black whitespace-nowrap">
                  SIGN OUT
                </span>
              </div>
            )}
          </button>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-12 top-24 w-10 h-10 bg-white border-4 border-black flex items-center justify-center text-black shadow-[4px_4px_0px_0px_#000] hover:bg-neo-secondary transition-all z-50 group active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {isCollapsed ? <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" /> : <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />}
        </button>
      </aside>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-neo-bg">
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-12 border-b-4 border-black pb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-neo-accent border-4 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center">
                  <span className="text-2xl font-black text-black">EF</span>
                </div>
                <h1 className="text-3xl font-black text-black">STUDYBUD</h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-4 p-5 border-4 border-black font-black tracking-widest uppercase transition-all
                    ${isActive
                      ? `${link.color} shadow-[6px_6px_0px_0px_#000] -translate-x-1 -translate-y-1`
                      : 'bg-white hover:bg-black/5'
                    }
                  `}
                >
                  <link.icon className="w-6 h-6 stroke-[3px]" />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t-4 border-black">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-4 p-6 border-4 border-black bg-neo-white hover:bg-red-400 font-black uppercase tracking-widest"
              >
                <LogOut className="w-6 h-6 stroke-[3px]" />
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
