import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Menu,
  X,
  BookUser,
  Crown,
  School
} from 'lucide-react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const navLinks = [
  { href: '/my-classes', label: 'CLASSES', icon: BookUser },
  { href: '/school-admin', label: 'SCHOOL', icon: School },
  { href: '/subscription', label: 'PREMIUM', icon: Crown },
];

const TeacherNavbar = () => {
  const { user, signOut, loading, fullName } = useAuth() as any;
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const width = isCollapsed ? '5.5rem' : '20rem';
      document.documentElement.style.setProperty('--sidebar-width', width);
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    } catch { }
    return () => {
      try {
        document.documentElement.style.setProperty('--sidebar-width', '20rem');
        document.body.classList.remove('sidebar-collapsed');
      } catch { }
    };
  }, [isCollapsed]);

  const handleSignOut = async () => {
    await signOut();
  };

  const NavItem = ({ link, isCollapsed }: { link: any; isCollapsed: boolean }) => (
    <NavLink
      to={link.href}
      className={({ isActive }) =>
        `flex items-center p-4 my-2 rounded-xl border transition-all font-bold uppercase tracking-tight ${isActive
          ? 'bg-white border-[#E8E2D9] shadow-sm text-[#2D2A26]'
          : 'text-[#8A8279] border-transparent hover:bg-[#F5F0E8] hover:text-[#2D2A26]'
        }`
      }
    >
      <link.icon className="w-5 h-5" />
      {!isCollapsed && <span className="ml-4 text-xs font-semibold tracking-wider">{link.label}</span>}
    </NavLink>
  );

  if (loading) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#FAF8F5] border-r border-[#E8E2D9] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-40 hidden md:flex flex-col ${isCollapsed ? 'w-[5.5rem]' : 'w-80'
          }`}
      >
        <div className="flex items-center justify-between p-8 border-b border-[#E8E2D9]">
          {!isCollapsed && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#8B7355]/10 border border-[#8B7355]/20 rounded-xl flex items-center justify-center text-[#8B7355]">
                <Logo size={24} className="text-[#8B7355]" />
              </div>
              <span className="text-xl font-black uppercase tracking-tighter text-[#2D2A26]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>TEACHER</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-3 bg-[#FAF8F5] text-[#8A8279] rounded-xl border border-[#E8E2D9] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-all shadow-sm ${isCollapsed ? 'mx-auto' : ''}`}
          >
            {isCollapsed ? <ChevronRight strokeWidth={2.5} className="w-5 h-5" /> : <ChevronLeft strokeWidth={2.5} className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 overflow-y-auto">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
          ))}
        </nav>

        <div className="p-8 border-t border-[#E8E2D9] bg-[#F5F0E8]/50">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <div className="w-12 h-12 bg-white border border-[#E8E2D9] rounded-2xl flex items-center justify-center shadow-sm">
                <User className="w-6 h-6 text-[#8B7355]" />
              </div>
              {!isCollapsed && (
                <div className="ml-5">
                  <p className="font-black uppercase text-xs tracking-[0.2em] text-[#8A8279] mb-1">{fullName || 'TEACHER'}</p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center text-xs font-black uppercase text-rose-600 hover:text-rose-500 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 w-full bg-[#FAF8F5]/80 backdrop-blur-xl p-4 z-50 flex items-center justify-between border-b border-[#E8E2D9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#8B7355]/10 border border-[#8B7355]/20 rounded-xl flex items-center justify-center text-[#8B7355]">
            <Logo size={24} className="text-[#8B7355]" />
          </div>
          <span className="text-2xl font-black uppercase tracking-tighter italic text-[#2D2A26]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>TEACHER</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl text-[#8A8279] hover:text-[#2D2A26] transition-colors"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-[#2D2A26]/40 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            className="fixed top-0 left-0 h-full w-[85%] bg-[#FAF8F5] p-8 border-r border-[#E8E2D9] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-12 pb-6 border-b border-[#E8E2D9]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#8B7355]/10 border border-[#8B7355]/20 rounded-2xl flex items-center justify-center text-[#8B7355]">
                  <span className="text-2xl font-black italic">EF</span>
                </div>
                <span className="text-3xl font-black uppercase tracking-tighter italic text-[#2D2A26]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>TEACHER</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-[#8A8279] hover:text-[#2D2A26]"
              >
                <X size={28} />
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center p-6 rounded-2xl border transition-all font-bold uppercase text-lg ${isActive
                      ? 'bg-white border-[#E8E2D9] text-[#2D2A26] shadow-sm'
                      : 'bg-[#F5F0E8]/50 border-transparent text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'
                    }`
                  }
                >
                  <link.icon className="w-6 h-6 mr-6" />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-auto pt-8 border-t border-[#E8E2D9]">
              {user && (
                <div className="flex items-center p-6 bg-[#F5F0E8]/50 rounded-[2rem] border border-[#E8E2D9]">
                  <div className="w-16 h-16 bg-white border border-[#E8E2D9] rounded-2xl flex items-center justify-center shadow-sm">
                    <User className="w-8 h-8 text-[#8B7355]" />
                  </div>
                  <div className="ml-6">
                    <p className="font-black uppercase text-lg tracking-tight text-[#2D2A26] leading-none mb-2">{fullName || user.email.split('@')[0]}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center text-sm font-black uppercase text-rose-600"
                    >
                      <LogOut className="w-5 h-5 mr-2" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.nav>
        </div>
      )}
    </>
  );
};

export default TeacherNavbar;
