import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Menu,
  X,
  BookUser,
  Crown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const navLinks = [
  { href: '/teacher', label: 'TEACHER PANEL', icon: BookUser },
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
        `flex items-center p-4 my-2 rounded-2xl border transition-all font-bold uppercase tracking-tight italic ${isActive
          ? 'bg-primary border-primary shadow-lg shadow-primary/20 text-white'
          : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <link.icon className="w-7 h-7" />
      {!isCollapsed && <span className="ml-4">{link.label}</span>}
    </NavLink>
  );

  if (loading) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900 border-r border-white/5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-40 hidden md:flex flex-col ${isCollapsed ? 'w-[5.5rem]' : 'w-80'
          }`}
      >
        <div className="flex items-center justify-between p-8 border-b border-white/5">
          {!isCollapsed && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
                <span className="text-xl font-black italic">EF</span>
              </div>
              <span className="text-xl font-black uppercase tracking-tighter text-white">TEACHER</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-3 bg-slate-950 text-slate-400 rounded-xl border border-white/5 hover:text-white transition-all shadow-xl ${isCollapsed ? 'mx-auto' : ''}`}
          >
            {isCollapsed ? <ChevronRight strokeWidth={2.5} className="w-5 h-5" /> : <ChevronLeft strokeWidth={2.5} className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 overflow-y-auto">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
          ))}
        </nav>

        <div className="p-8 border-t border-white/5 bg-slate-950/30">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-slate-300" />
              </div>
              {!isCollapsed && (
                <div className="ml-5">
                  <p className="font-black uppercase text-xs tracking-[0.2em] text-slate-500 mb-1">{fullName || 'TEACHER'}</p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center text-xs font-black uppercase text-rose-500 hover:text-rose-400 transition-colors"
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
      <header className="md:hidden fixed top-0 left-0 w-full bg-slate-900/80 backdrop-blur-xl p-4 z-50 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
            <span className="text-xl font-black italic">EF</span>
          </div>
          <span className="text-2xl font-black uppercase tracking-tighter italic text-white">TEACHER</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-slate-900 border border-white/10 rounded-xl text-slate-300"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            className="fixed top-0 left-0 h-full w-[85%] bg-slate-900 p-8 border-r border-white/5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-12 pb-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary">
                  <span className="text-2xl font-black italic">EF</span>
                </div>
                <span className="text-3xl font-black uppercase tracking-tighter italic text-white">TEACHER</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-500"
              >
                <X size={32} />
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center p-6 rounded-2.5xl border transition-all font-black uppercase text-xl italic ${isActive
                      ? 'bg-primary border-primary text-white shadow-2xl shadow-primary/20'
                      : 'bg-slate-950/50 border-white/5 text-slate-400'
                    }`
                  }
                >
                  <link.icon className="w-8 h-8 mr-6" />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-auto pt-8 border-t border-white/5">
              {user && (
                <div className="flex items-center p-6 bg-slate-950/50 rounded-[2rem] border border-white/5">
                  <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg">
                    <User className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="ml-6">
                    <p className="font-black uppercase text-lg tracking-tight text-white leading-none mb-2">{fullName || user.email.split('@')[0]}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center text-sm font-black uppercase text-rose-500"
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
