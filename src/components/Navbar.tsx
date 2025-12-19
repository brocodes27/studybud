import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CalendarPlus,
  BookOpen,
  ListChecks,
  Wrench,
  LineChart,
  BarChart2,
  Calendar,
  Users,
  Bell,
  Mic,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Crown,
  Brain,
  Video
} from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Ranjan Sir', icon: Brain, color: 'text-neon-blue' },
  { href: '/my-classes', label: 'My Classes', icon: Users, color: 'text-indigo-500' },
  { href: '/dashboard', label: 'Stats Dashboard', icon: LayoutDashboard, color: 'text-gray-400' },
  { href: '/cbse-simulator', label: 'CBSE Simulator', icon: FileText, color: 'text-teal-400' },
  { href: '/create', label: 'Create Plan', icon: CalendarPlus, color: 'text-neon-green' },
  { href: '/plans', label: 'Study Plans', icon: BookOpen, color: 'text-neon-purple' },
  // { href: '/ai-buddy', label: 'AI Study Buddy', icon: Brain, color: 'text-pink-500' }, // Removed in favor of Ranjan Sir
  { href: '/curriculum', label: 'Curriculum', icon: ListChecks, color: 'text-yellow-400' },
  { href: '/tools', label: 'Study Tools', icon: Wrench, color: 'text-cyan-400' },
  { href: '/videos', label: 'Video Lessons', icon: Video, color: 'text-neon-green' },
  { href: '/progress', label: 'Progress', icon: LineChart, color: 'text-indigo-400' },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, color: 'text-orange-400' },
  { href: '/calendar', label: 'Calendar Sync', icon: Calendar, color: 'text-emerald-400' },
  { href: '/social', label: 'Social', icon: Users, color: 'text-blue-400' },
  { href: '/notifications', label: 'Notifications', icon: Bell, color: 'text-red-400' },
  { href: '/my-notes', label: 'My Meeting Notes', icon: Mic, color: 'text-violet-400' },

];

const Navbar = () => {
  const { signOut, user, isPremium } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Toggle body class for layout adjustment
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
        className={`relative group flex items-center px-3 py-3 my-1 rounded-xl transition-all duration-300 overflow-hidden
          ${isActive
            ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(0,243,255,0.1)] border border-white/10'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
          }
        `}
      >
        {/* Active Indicator Line */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-neon-blue rounded-r-full shadow-[0_0_10px_#00f3ff]" />
        )}

        {/* Icon */}
        <div className={`relative z-10 flex items-center justify-center w-8 h-8 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
          <link.icon className={`w-5 h-5 ${isActive ? link.color : 'text-current'} transition-colors duration-300`} />
        </div>

        {/* Label */}
        {!isCollapsed && (
          <span className={`ml-3 font-medium text-sm transition-all duration-300 ${isActive ? 'text-white' : ''}`}>
            {link.label}
          </span>
        )}

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl bg-background/80 backdrop-blur-xl border border-white/10 text-white shadow-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen bg-[#0a0b14]/90 backdrop-blur-2xl border-r border-white/5 transition-all duration-300 z-40 flex-col
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.3)]">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">ElevenFolks</h1>
                <p className="text-xs text-neon-blue font-medium tracking-wider">FUTURE LEARNING</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-hide custom-scrollbar">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} mb-4`}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center border-2 border-white/10">
                <span className="text-white font-bold">{user?.email?.[0].toUpperCase()}</span>
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border border-black shadow-lg">
                  <Crown className="w-2.5 h-2.5 text-black" />
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.user_metadata?.full_name || 'Student'}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className={`flex items-center justify-center w-full p-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200
              ${isCollapsed ? '' : 'gap-2'}
            `}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-neon-blue rounded-full flex items-center justify-center text-black shadow-[0_0_10px_#00f3ff] hover:scale-110 transition-transform duration-200 z-50"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-xl">
          <div className="flex flex-col h-full p-6 animate-slide-in-right">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-blue-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">ElevenFolks</h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-4 p-4 rounded-xl transition-all duration-200
                    ${isActive
                      ? 'bg-white/10 text-white border border-white/10 shadow-lg'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <link.icon className={`w-5 h-5 ${location.pathname === link.href ? link.color : ''}`} />
                  <span className="font-medium">{link.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{user?.user_metadata?.full_name || 'Student'}</p>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
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