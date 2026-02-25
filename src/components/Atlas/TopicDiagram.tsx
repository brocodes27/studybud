
import { Box } from 'lucide-react';

export function TopicDiagram() {
    return (
        <div className="my-10 bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group">
            {/* Wavy Background Pattern */}
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-700">
                <svg viewBox="0 0 1000 400" className="w-full h-full">
                    <path
                        d="M 0 200 Q 250 50 500 200 T 1000 200"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        className="text-blue-500 animate-pulse"
                    />
                    <path
                        d="M 0 220 Q 250 70 500 220 T 1000 220"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        className="text-blue-400"
                    />
                    <path
                        d="M 0 180 Q 250 30 500 180 T 1000 180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        className="text-cyan-400"
                    />
                </svg>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center py-12">
                <div className="bg-blue-600/20 p-6 rounded-3xl border border-blue-500/30 shadow-2xl shadow-blue-500/20 mb-6 group-hover:scale-110 transition-transform duration-500">
                    <Box className="w-12 h-12 text-blue-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium tracking-wide italic">
                    Diagram: Visualizing Magnetic Flux ($\Phi_B$) through a conducting loop moving in a uniform field.
                </p>
            </div>
        </div>
    );
}
