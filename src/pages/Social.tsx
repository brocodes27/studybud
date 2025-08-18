import { SocialFeatures } from '../components/SocialFeatures';
import { Users } from 'lucide-react';

export function Social() {
  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center glow-blue">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Social <span className="gradient-text">Learning</span>
          </h1>
        </div>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Connect with fellow students, share knowledge, and learn together in a supportive community environment.
        </p>
      </div>

      {/* Main Social Component */}
      <div className="card-elevated">
        <SocialFeatures />
      </div>

    </div>
  );
}