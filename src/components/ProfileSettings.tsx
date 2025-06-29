import React, { useState, useEffect } from 'react';
import { User, Mail, GraduationCap, School, Save, Edit, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  grade: string | null;
  school: string | null;
  updated_at: string;
}

export function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    grade: '',
    school: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        showToast('Failed to load profile', 'error');
        return;
      }

      setProfile(data);
      setFormData({
        full_name: data?.full_name || '',
        grade: data?.grade || '',
        school: data?.school || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateProfile({
        full_name: formData.full_name,
        grade: formData.grade,
        school: formData.school
      });

      await fetchProfile(); // Refresh the profile data
      setEditing(false);
      showToast('Profile updated successfully!', 'success');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      grade: profile?.grade || '',
      school: profile?.school || ''
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 border border-gray-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="h-6 w-6 text-blue-400" />
          Profile Settings
        </h3>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Email (Read-only) */}
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="h-5 w-5 text-blue-400" />
            <label className="text-sm font-medium text-gray-300">Email</label>
          </div>
          <p className="text-white font-medium">{profile?.email || user?.email || 'Not set'}</p>
          <p className="text-xs text-gray-400 mt-1">Email is managed through your account settings</p>
        </div>

        {/* Full Name */}
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <User className="h-5 w-5 text-green-400" />
            <label className="text-sm font-medium text-gray-300">Full Name</label>
          </div>
          {editing ? (
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="Enter your full name"
            />
          ) : (
            <p className="text-white font-medium">{profile?.full_name || 'Not set'}</p>
          )}
        </div>

        {/* Grade */}
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="h-5 w-5 text-purple-400" />
            <label className="text-sm font-medium text-gray-300">Grade/Class</label>
          </div>
          {editing ? (
            <input
              type="text"
              value={formData.grade}
              onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 12th Grade, Class 12, etc."
            />
          ) : (
            <p className="text-white font-medium">{profile?.grade || 'Not set'}</p>
          )}
        </div>

        {/* School */}
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <School className="h-5 w-5 text-orange-400" />
            <label className="text-sm font-medium text-gray-300">School</label>
          </div>
          {editing ? (
            <input
              type="text"
              value={formData.school}
              onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="Enter your school name"
            />
          ) : (
            <p className="text-white font-medium">{profile?.school || 'Not set'}</p>
          )}
        </div>

        {/* Last Updated */}
        {profile?.updated_at && (
          <div className="text-xs text-gray-500 text-center">
            Last updated: {new Date(profile.updated_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
} 