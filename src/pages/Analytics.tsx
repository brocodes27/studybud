import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { BarChart3 } from 'lucide-react';

export function Analytics() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center glow-blue">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Advanced <span className="gradient-text">Analytics</span>
          </h1>
        </div>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          AI-powered insights into your learning journey. Discover patterns, optimize your study habits, and accelerate your progress with data-driven recommendations.
        </p>
      </div>

      {/* Main Analytics Component */}
      <div className="card-elevated">
        <AdvancedAnalytics />
      </div>

    </div>
  );
}