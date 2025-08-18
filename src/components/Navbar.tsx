import { useState, useEffect } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CalendarPlus,
  BookOpen,
  Wrench,
  LineChart,
  BarChart2,
  Calendar,
  Users,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Menu,
  X,
  BookUser,
  Mic,
  Shield,
  FileText,
  Sparkles,
  Crown,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600' },
  { href: '/create', label: 'Create Plan', icon: CalendarPlus, color: 'from-green-500 to-green-600' },
  { href: '/plans', label: 'Study Plans', icon: BookOpen, color: 'from-purple-500 to-purple-600' },
  { href: '/tools', label: 'Study Tools', icon: Wrench, color: 'from-orange-500 to-orange-600' },
  { href: '/progress', label: 'Progress', icon: LineChart, color: 'from-emerald-500 to-emerald-600' },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, color: 'from-cyan-500 to-cyan-600' },
  { href: '/calendar', label: 'Calendar Sync', icon: Calendar, color: 'from-pink-500 to-pink-600' },
  { href: '/social', label: 'Social', icon: Users, color: 'from-indigo-500 to-indigo-600' },
  { href: '/notifications', label: 'Notifications', icon: Bell, color: 'from-yellow-500 to-yellow-600' },
  { href: '/live-notes', label: 'Live Meeting Notes', icon: Mic, color: 'from-red-500 to-red-600' },
  { href: '/cbse-simulator', label: 'CBSE Simulator', icon: FileText, color: 'from-violet-500 to-violet-600' },
  { href: '/ai-study-buddy', label: 'AI Study Buddy', icon: Sparkles, color: 'from-rose-500 to-rose-600' },
];

const studentNavLinks = [
  { href: '/my-classes', label: 'My Classes', icon: BookUser, color: 'from-teal-500 to-teal-600' },
];

const adminNavLinks = [
  { href: '/admin', label: 'Admin Panel', icon: Shield, color: 'from-amber-500 to-amber-600' },
];

const Navbar = () => {
  const { user, role, signOut, loading, isAdmin, fullName, isPremium } = useAuth() as any;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync collapsed state to document for global layout adjustments
  useEffect(() => {
    try {
      const width = isCollapsed ? '5rem' : '18rem';
      document.documentElement.style.setProperty('--sidebar-width', width);
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    } catch {}
    return () => {
      try {
        document.documentElement.style.setProperty('--sidebar-width', '18rem');
        document.body.classList.remove('sidebar-collapsed');
      } catch {}
    };
  }, [isCollapsed]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    try {
      if (isMobileMenuOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    } catch {}
    return () => {
      try { document.body.style.overflow = ''; } catch {}
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
  };

  const NavItem = ({ link, isCollapsed }: { link: any, isCollapsed: boolean }) => (
    <NavLink
      to={link.href}
      className={({ isActive }) =>
        `group flex items-center p-3 my-1 rounded-xl transition-all duration-300 relative overflow-hidden ${
          isActive 
            ? `bg-gradient-to-r ${link.color} text-white shadow-lg shadow-${link.color.split('-')[1]}-500/25` 
            : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
        }`
      }
    >
      <div className={`relative z-10 flex items-center ${!isCollapsed ? 'w-full' : 'justify-center'}`}>
        <link.icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${!isCollapsed ? 'mr-3' : ''}`} />
        {!isCollapsed && (
          <span className="font-medium text-sm">{link.label}</span>
        )}
      </div>
      {!isCollapsed && (
        <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
      )}
    </NavLink>
  );

  const MobileNavItem = ({ link }: { link: any }) => (
    <NavLink
      to={link.href}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) =>
        `group flex items-center p-4 my-1 rounded-xl transition-all duration-300 relative overflow-hidden ${
          isActive 
            ? `bg-gradient-to-r ${link.color} text-white shadow-lg` 
            : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
        }`
      }
    >
      <div className="relative z-10 flex items-center w-full">
        <link.icon className="w-5 h-5 mr-3 transition-transform duration-200 group-hover:scale-110" />
        <span className="font-medium">{link.label}</span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
    </NavLink>
  );

  if (loading) {
    return (
      <div className="fixed top-0 left-0 h-full bg-gray-800/95 backdrop-blur-xl text-white z-40 hidden md:flex flex-col w-64">
        <div className="flex items-center justify-center p-4 border-b border-gray-700">
          <div className="loading-spinner w-8 h-8"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gray-800/95 backdrop-blur-xl text-white transition-all duration-300 ease-in-out z-40 hidden md:flex flex-col border-r border-gray-700/50 ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text">ElevenFolks</span>
            </div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors duration-200 focus-ring"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="space-y-2">
            {navLinks.map((link) => (
              <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
            ))}

            {role === 'student' && (
              <>
                <div className="my-6 border-t border-gray-700/50"></div>
                <div className="px-3 mb-3">
                  {!isCollapsed && <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</span>}
                </div>
                {studentNavLinks.map((link) => (
                  <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
                ))}
              </>
            )}

            {isAdmin && (
              <>
                <div className="my-6 border-t border-gray-700/50"></div>
                <div className="px-3 mb-3">
                  {!isCollapsed && <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</span>}
                </div>
                {adminNavLinks.map((link) => (
                  <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
                ))}
              </>
            )}
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700/50">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                {isPremium && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                    <Crown className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <div className="ml-3 flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{fullName || user.email}</p>
                  <p className="text-xs text-gray-400 truncate">{isPremium ? 'Premium User' : 'Free User'}</p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center text-xs text-gray-400 hover:text-red-400 transition-colors mt-1 group"
                  >
                    <LogOut className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50 safe-top safe-x">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">ElevenFolks</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors duration-200 focus-ring"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="student-mobile-menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <nav id="student-mobile-menu" className="fixed top-0 left-0 h-full w-80 bg-gray-800/95 backdrop-blur-xl text-white p-6 animate-slide-in-right safe-top safe-x safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold gradient-text">ElevenFolks</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors duration-200 focus-ring"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {navLinks.map((link) => (
                <MobileNavItem key={link.href} link={link} />
              ))}
              
              {role === 'student' && (
                <>
                  <div className="my-6 border-t border-gray-700/50"></div>
                  <div className="px-4 mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</span>
                  </div>
                  {studentNavLinks.map((link) => (
                    <MobileNavItem key={link.href} link={link} />
                  ))}
                </>
              )}
              
              {isAdmin && (
                <>
                  <div className="my-6 border-t border-gray-700/50"></div>
                  <div className="px-4 mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</span>
                  </div>
                  {adminNavLinks.map((link) => (
                    <MobileNavItem key={link.href} link={link} />
                  ))}
                </>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700/50">
              {user && (
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
                      <User className="w-7 h-7 text-white" />
                    </div>
                    {isPremium && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                        <Crown className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{fullName || user.email}</p>
                    <p className="text-xs text-gray-400 truncate">{isPremium ? 'Premium User' : 'Free User'}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center text-xs text-gray-400 hover:text-red-400 transition-colors mt-2 group"
                    >
                      <LogOut className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
};

export default Navbar;