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
  Mic,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navLinks = [
  { href: '/teacher', label: 'Teacher Panel', icon: BookUser },
  { href: '/cbse-simulator', label: 'CBSE Simulator', icon: FileText },
  { href: '/cuet-simulator', label: 'CUET Simulator', icon: FileText },
  { href: '/ai-study-buddy', label: 'AI Study Buddy', icon: Mic },
];

const TeacherNavbar = () => {
  const { user, signOut, loading, fullName } = useAuth() as any;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync collapsed state to document for global layout adjustments
  useEffect(() => {
    try {
      const width = isCollapsed ? '5rem' : '16rem'; // w-20 vs w-64
      document.documentElement.style.setProperty('--sidebar-width', width);
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    } catch {}
    return () => {
      try {
        document.documentElement.style.setProperty('--sidebar-width', '18rem'); // reset to app default
        document.body.classList.remove('sidebar-collapsed');
      } catch {}
    };
  }, [isCollapsed]);

  const handleSignOut = async () => {
    await signOut();
  };

  const NavItem = ({ link, isCollapsed }: { link: any, isCollapsed: boolean }) => (
    <NavLink
      to={link.href}
      className={({ isActive }) =>
        `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
          isActive ? 'bg-primary-600 text-white' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
        }`
      }
    >
      <link.icon className="w-6 h-6" />
      {!isCollapsed && <span className="ml-4 font-semibold">{link.label}</span>}
    </NavLink>
  );

  const MobileNavItem = ({ link }: { link: any }) => (
    <NavLink
      to={link.href}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) =>
        `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
          isActive ? 'bg-primary-600 text-white' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
        }`
      }
    >
      <link.icon className="w-6 h-6" />
      <span className="ml-4 font-semibold">{link.label}</span>
    </NavLink>
  );

  if (loading) {
    return null; // or a loading spinner
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-card text-foreground transition-all duration-300 ease-in-out z-40 hidden md:flex flex-col border-r border-border ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!isCollapsed && <span className="text-2xl font-bold">elevenfolks Teacher</span>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-full hover:bg-foreground/5">
            {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navLinks.map((link) => (
            <NavItem key={link.href} link={link} isCollapsed={isCollapsed} />
          ))}
        </nav>

        <div className="p-4 border-t border-border">
           {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <User className="w-10 h-10 rounded-full bg-foreground/10 p-2" />
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="font-semibold text-sm">{fullName || user.email}</p>
                   <button
                    onClick={handleSignOut}
                    className="flex items-center text-sm text-foreground/60 hover:text-red-500 transition-colors"
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
      <header className="md:hidden fixed top-0 left-0 w-full bg-card text-foreground p-4 z-50 flex items-center justify-between border-b border-border">
         <span className="text-2xl font-bold">elevenfolks Teacher</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900/90 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <nav className="fixed top-0 left-0 h-full w-64 bg-card text-foreground p-6 animate-slide-in border-r border-border">
             <div className="flex justify-between items-center mb-6">
                <span className="text-2xl font-bold">elevenfolks Teacher</span>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X size={24} />
                </button>
              </div>

            <div className="flex-1 overflow-y-auto">
              {navLinks.map((link) => (
                <MobileNavItem key={link.href} link={link} />
              ))}
            </div>

            <div className="mt-auto">
               {user && (
                <div className="flex items-center">
                  <User className="w-10 h-10 rounded-full bg-foreground/10 p-2" />
                  <div className="ml-3">
                    <p className="font-semibold text-sm">{fullName || user.email}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center text-sm text-foreground/60 hover:text-red-500 transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
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

export default TeacherNavbar; 