import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Sparkles,
  PenSquare,
  Search,
  Library,
  MonitorPlay,
  LayoutGrid,
  Settings2,
  Brain
} from 'lucide-react';

export const ManusSidebar = () => {
    const { user } = useAuth() as any;

    if (!user) return null;

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

                <NavLink
                    to="/plans"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <Library className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Library & Plans
                    </div>
                </NavLink>
            </div>

            {/* Bottom Icons */}
            <div className="mt-auto flex flex-col items-center gap-3 w-full">
                <NavLink
                    to="/videos"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <MonitorPlay className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Media Workspace
                    </div>
                </NavLink>

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
                    to="/my-profile"
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
                    to="/profile"
                    className={({ isActive }) =>
                        `p-2.5 rounded-xl transition-all duration-200 relative group ${isActive ? 'bg-white shadow-sm border border-[#E8E2D9] text-[#2D2A26]' : 'text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26]'}`
                    }
                >
                    <Settings2 className="w-[17px] h-[17px]" strokeWidth={2}/>
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2D2A26] text-white text-[10px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md tracking-wide">
                        Settings
                    </div>
                </NavLink>
            </div>
        </aside>
    );
};
