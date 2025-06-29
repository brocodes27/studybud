import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, BookOpen, BarChart2, Users, Bell, Menu, X, Compass, TrendingUp, Brain, Calendar, Pencil, MessageCircle, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: Home, path: '/' },
    { name: 'Create Plan', icon: PlusCircle, path: '/create' },
    { name: 'Study Plans', icon: BookOpen, path: '/plans' },
    { name: 'AI Study Buddy', icon: MessageCircle, path: '/ai-study-buddy' },
    { name: 'Progress', icon: TrendingUp, path: '/progress' },
    { name: 'Analytics', icon: BarChart2, path: '/analytics' },
    { name: 'Study Tools', icon: Compass, path: '/tools' },
    { name: 'Calendar', icon: Calendar, path: '/calendar' },
    { name: 'Social', icon: Users, path: '/social' },
    { name: 'Notifications', icon: Bell, path: '/notifications' },
    { name: 'Live Meeting Notes', icon: Pencil, path: '/live-notes' },
    { name: 'My Meeting Notes', icon: BookOpen, path: '/my-notes' },
    { name: 'Profile', icon: User, path: '/profile' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (<>
    <nav className="bg-gray-800 p-4 shadow-lg md:hidden">
      <div className="container mx-auto flex items-center">
        <Link to="/" className="text-2xl font-bold flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
            <Brain className="text-white" size={20} />
          </div>
          <span className="gradient-text">STUBUD</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6 ml-8 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${isActive(item.path) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          ))}
        </div>
        <button
          onClick={signOut}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex-shrink-0 ml-4"
        >
          Sign Out
        </button>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center">
          <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 hover:text-white focus:outline-none">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden mt-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium transition-colors
                ${isActive(item.path) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:flex flex-col w-64 h-screen bg-gray-800 shadow-lg p-6 left-0 top-0">
        <Link to="/" className="text-2xl font-bold flex items-center gap-2 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
            <Brain className="text-white" size={20} />
          </div>
          <span className="gradient-text">STUBUD</span>
        </Link>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          ))}
        </div>
        <button
          onClick={signOut}
          className="mt-6 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </aside></>
  );
}