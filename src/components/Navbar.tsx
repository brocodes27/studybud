import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, Home, Plus, BookOpen, TrendingUp, LogOut, Sparkles, Zap, BarChart3, Users, Bell, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';

export function Navbar() {
  const { user, signOut } = useAuth();
  const { isPremiumUser } = useSubscription();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/create', icon: Plus, label: 'Create Plan' },
    { path: '/plans', icon: BookOpen, label: 'My Plans' },
    { path: '/tools', icon: Zap, label: 'AI Tools' },
    { path: '/progress', icon: TrendingUp, label: 'Progress' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/social', icon: Users, label: 'Social' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/subscription', icon: Crown, label: 'Premium' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="glass border-b border-gray-700/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl glow-blue group-hover:glow-purple transition-all duration-300">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-pulse" />
            </div>
            <span className="text-xl font-bold gradient-text">
              AI Study Planner
            </span>
          </Link>

          {/* Navigation Items */}
          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isPremiumFeature = ['analytics', 'social'].includes(item.path.slice(1));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 relative ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 font-semibold glow-blue'
                      : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.path === '/subscription' && isPremiumUser() && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></div>
                  )}
                  {isPremiumFeature && !isPremiumUser() && (
                    <Crown className="h-3 w-3 text-yellow-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                {user?.user_metadata?.full_name || user?.email}
                {isPremiumUser() && (
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-2 py-1 rounded-full">
                    <span className="text-white text-xs font-medium">Premium</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {isPremiumUser() ? 'Premium Member' : 'Free Plan'}
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-red-400 transition-colors duration-200 rounded-lg hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden border-t border-gray-700/50">
          <div className="grid grid-cols-4 gap-1 py-2">
            {navItems.slice(0, 8).map((item) => {
              const Icon = item.icon;
              const isPremiumFeature = ['analytics', 'social'].includes(item.path.slice(1));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors duration-200 relative ${
                    isActive(item.path)
                      ? 'text-blue-400'
                      : 'text-gray-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{item.label}</span>
                  {isPremiumFeature && !isPremiumUser() && (
                    <Crown className="h-2 w-2 text-yellow-400 absolute -top-1 -right-1" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}