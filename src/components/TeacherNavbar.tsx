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
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const navLinks = [
  { href: '/teacher', label: 'TEACHER PANEL', icon: BookUser },
  { href: '/cbse-simulator', label: 'CBSE SIMULATOR', icon: FileText },
  { href: '/cuet-simulator', label: 'CUET SIMULATOR', icon: FileText },
];

const TeacherNavbar = () => {
  const { user, signOut, loading, fullName } = useAuth() as any;
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const width = isCollapsed ? '5rem' : '18rem';
      document.documentElement.style.setProperty('--sidebar-width', width);
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    } catch { }
    return () => {
      try {
        document.documentElement.style.setProperty('--sidebar-width', '18rem');
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
        `flex items-center p-4 my-2 border-4 border-transparent transition-all font-black uppercase tracking-tight italic ${isActive
          ? 'bg-neo-accent border-black shadow-[4px_4px_0px_0px_#000] text-white translate-x-[-2px] translate-y-[-2px]'
          : 'text-black hover:bg-black/5 hover:border-black/10'
        }`
      }
    >
      <link.icon className="w-7 h-7 stroke-[2.5px]" />
      {!isCollapsed && <span className="ml-4">{link.label}</span>}
    </NavLink>
  );

  if (loading) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-neo-bg transition-all duration-300 ease-in-out z-40 hidden md:flex flex-col border-r-4 border-black ${isCollapsed ? 'w-20' : 'w-72'
          }`}
      >
        <div className="flex items-center justify-between p-6 border-b-4 border-black bg-black text-white">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neo-accent border-2 border-white flex items-center justify-center -rotate-3">
                <span className="text-xl font-black italic">EF</span>
              </div>
              <span className="text-xl font-black uppercase tracking-tighter">TEACHER</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all ${isCollapsed ? 'mx-auto' : ''}`}
          >
            {isCollapsed ? <ChevronRight strokeWidth={3} /> : <ChevronLeft strokeWidth={3} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 overflow-y-auto">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
          ))}
        </nav>

        <div className="p-6 border-t-4 border-black bg-white">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <div className="w-12 h-12 bg-neo-secondary border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] -rotate-2">
                <User className="w-7 h-7 text-black stroke-[2.5px]" />
              </div>
              {!isCollapsed && (
                <div className="ml-5">
                  <p className="font-black uppercase text-xs tracking-widest text-black mb-1">{fullName || 'TEACHER'}</p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center text-xs font-black uppercase text-black hover:text-neo-accent transition-colors underline decoration-2 underline-offset-4"
                  >
                    <LogOut className="w-4 h-4 mr-2 stroke-[3px]" />
                    LOGOUT
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 w-full bg-neo-bg p-4 z-50 flex items-center justify-between border-b-4 border-black shadow-[0_4px_0px_0px_#000]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neo-accent border-4 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
            <span className="text-xl font-black italic text-white">EF</span>
          </div>
          <span className="text-2xl font-black uppercase tracking-tighter italic">TEACHER</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 border-4 border-black shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] bg-neo-secondary"
        >
          {isMobileMenuOpen ? <X size={28} strokeWidth={3} /> : <Menu size={28} strokeWidth={3} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <motion.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            className="fixed top-0 left-0 h-full w-4/5 bg-neo-bg p-8 border-r-8 border-black flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-10 pb-6 border-b-4 border-black">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neo-accent border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
                  <span className="text-2xl font-black text-white italic">EF</span>
                </div>
                <span className="text-3xl font-black uppercase tracking-tighter italic">TEACHER</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X size={32} strokeWidth={4} />
              </button>
            </div>

            <div className="flex-1 space-y-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center p-5 border-4 border-black transition-all font-black uppercase text-xl italic ${isActive
                      ? 'bg-neo-accent shadow-[4px_4px_0px_0px_#000] text-white'
                      : 'bg-white hover:bg-black/5'
                    }`
                  }
                >
                  <link.icon className="w-8 h-8 mr-6 stroke-[3px]" />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-auto pt-8 border-t-4 border-black">
              {user && (
                <div className="flex items-center p-4 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000]">
                  <div className="w-16 h-16 bg-neo-secondary border-4 border-black flex items-center justify-center -rotate-3">
                    <User className="w-8 h-8 text-black stroke-[2.5px]" />
                  </div>
                  <div className="ml-6">
                    <p className="font-black uppercase text-lg tracking-tight text-black">{fullName || user.email.split('@')[0]}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center text-sm font-black uppercase text-neo-accent underline underline-offset-4 decoration-4"
                    >
                      <LogOut className="w-5 h-5 mr-2 stroke-[3px]" />
                      LOGOUT
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
