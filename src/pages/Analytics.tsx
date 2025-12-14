import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { BarChart3 } from 'lucide-react';

export function Analytics() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-neon-purple to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-neon-purple/20">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Advanced <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-pink-500">Analytics</span>
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
          AI-powered insights into your learning journey. Discover patterns, optimize your study habits, and accelerate your progress with data-driven recommendations.
        </p>
      </div>

      {/* Main Analytics Component */}
      <div className="glass-card border border-white/10 p-1 rounded-3xl overflow-hidden">
        <AdvancedAnalytics />
      </div>

    </div>
  );
}