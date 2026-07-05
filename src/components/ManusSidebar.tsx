import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Sparkles,
  PenSquare,
  Search,
  LayoutGrid,
  Settings2,
  Brain,
  ShieldCheck,
  Trophy,
  Users,
  BarChart3,
  LogOut,
  BookOpen
} from 'lucide-react';

export const ManusSidebar = () => {
    const { user, signOut, grade } = useAuth() as any;

    if (!user) return null;

    const isBelow11 = grade && ['8', '9', '10'].includes(grade.toString().trim());

    return (
        <aside className="fixed left-0 top-0 h-screen w-14 bg-[#FAF8F5] border-r border-[#E8E2D9] flex flex-col items-center py-5 z-50">
            {/* Top Icons */}
            <div className="flex flex-col items-center gap-3 w-full">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <Sparkles className="w-[17px] h-[17px]" strokeWidth={2}/>
                </NavLink>

                <div className="w-6 h-[1px] bg-[#E8E2D9] my-0.5" />

                <NavLink
                    to="/atlas"
                    onClick={() => window.dispatchEvent(new CustomEvent('trigger-atlas-chat', { detail: { message: 'Start a new study session', clear: true } }))}
                    className="p-2.5 rounded-xl text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-all duration-200 relative group"
                >
                    <PenSquare className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        New Session
                    </div>
                </NavLink>

                <NavLink
                    to="/atlas"
                    onClick={() => window.dispatchEvent(new CustomEvent('trigger-atlas-chat', { detail: { message: 'Search my knowledge base for:', clear: true } }))}
                    className="p-2.5 rounded-xl text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-all duration-200 relative group"
                >
                    <Search className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Search Knowledge Base
                    </div>
                </NavLink>

                {!isBelow11 && (
                  <>
                    <NavLink
                        to="/prove-it"
                        className={({ isActive }) =>
                            `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                        }
                    >
                        <ShieldCheck className="w-[17px] h-[17px]" strokeWidth={2}/>
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                            Prove-It Mode
                        </div>
                    </NavLink>

                    <NavLink
                        to="/mastery-tree"
                        className={({ isActive }) =>
                            `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                        }
                    >
                        <Trophy className="w-[17px] h-[17px]" strokeWidth={2}/>
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                            Mastery Tree
                        </div>
                    </NavLink>

                    <NavLink
                        to="/squad-prove-it"
                        className={({ isActive }) =>
                            `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                        }
                    >
                        <Users className="w-[17px] h-[17px]" strokeWidth={2}/>
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                            Squad Prove-It
                        </div>
                    </NavLink>

                    <NavLink
                        to="/outcomes"
                        className={({ isActive }) =>
                            `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                        }
                    >
                        <BarChart3 className="w-[17px] h-[17px]" strokeWidth={2}/>
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                            Outcomes
                        </div>
                    </NavLink>
                  </>
                )}

                <NavLink
                    to="/my-classes"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <BookOpen className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        My Classes
                    </div>
                </NavLink>

            </div>

            {/* Bottom Icons */}
            <div className="mt-auto flex flex-col items-center gap-3 w-full">
                <NavLink
                    to="/atlas"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <LayoutGrid className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Atlas
                    </div>
                </NavLink>

                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <Brain className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        My Profile
                    </div>
                </NavLink>

                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <Settings2 className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Settings
                    </div>
                </NavLink>

                <button
                    onClick={() => signOut?.()}
                    className="p-2.5 rounded-xl text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-all duration-200 relative group"
                >
                    <LogOut className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Sign Out
                    </div>
                </button>
            </div>
        </aside>
    );
};
