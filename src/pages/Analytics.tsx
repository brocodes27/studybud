import React from 'react';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { Toaster } from '../components/Toaster';

export function Analytics() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Advanced Analytics</h1>
        <p className="text-gray-400 mt-2">AI-powered insights into your learning journey</p>
      </div>
      
      <AdvancedAnalytics />
      <Toaster />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-white mb-6">Advanced Analytics</h1>
        <p className="text-gray-300 mb-4">Gain deeper insights into your study habits and progress.</p>
      </div>
    </div>
  );
}