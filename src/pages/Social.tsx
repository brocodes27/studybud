import { SocialFeatures } from '../components/SocialFeatures';
import { Users } from 'lucide-react';

export function Social() {
  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>

      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-neon-blue to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-neon-blue/20">
            <Users className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-black">
            Social <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-blue-400">Learning</span>
          </h1>
        </div>
        <p className="text-xl text-black max-w-3xl mx-auto leading-relaxed">
          Connect with fellow students, share knowledge, and learn together in a supportive community environment.
        </p>
      </div>

      {/* Main Social Component */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
        <SocialFeatures />
      </div>

    </div>
  );
}