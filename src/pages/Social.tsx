import React from 'react';
import { SocialFeatures } from '../components/SocialFeatures';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { Toaster } from '../components/Toaster';

export function Social() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        
        
      </div>
      
      <SocialFeatures />
      <Toaster />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-white mb-6">Social Features</h1>
        <p className="text-gray-300 mb-4">Connect with other students, share study tips, and collaborate on learning.</p>
      </div>
    </div>
  );
}