import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function AdminPanel() {
  const { isAdmin, user } = useAuth() as any;
  const [userCount, setUserCount] = useState<number | null>(null);
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [emailExtensions, setEmailExtensions] = useState<string[]>([]);
  const [newExtension, setNewExtension] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
      fetchEmailExtensions();
    }
  }, [isAdmin]);

  const fetchAdminStats = async () => {
    setLoading(true);
    // Fetch user count
    const { count: userCount } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });
    // Fetch study plan count
    const { count: planCount } = await supabase
      .from('exam_plans')
      .select('id', { count: 'exact', head: true });
    // Fetch recent users
    const { data: recentUsers } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(10);
    setUserCount(userCount ?? null);
    setPlanCount(planCount ?? null);
    setRecentUsers(recentUsers ?? []);
    setLoading(false);
  };

  // Fetch allowed email extensions
  const fetchEmailExtensions = async () => {
    setExtLoading(true);
    const { data, error } = await supabase
      .from('premium_email_extensions')
      .select('extension')
      .order('extension', { ascending: true });
    setEmailExtensions(data ? data.map((row: any) => row.extension) : []);
    setExtLoading(false);
  };

  // Add a new email extension
  const handleAddExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtension.trim()) return;
    setExtLoading(true);
    const ext = newExtension.trim();
    await supabase.from('premium_email_extensions').insert({ extension: ext });
    setNewExtension('');
    fetchEmailExtensions();
    setExtLoading(false);
  };

  // Debounced search effect
  useEffect(() => {
    if (!isAdmin) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!search) {
      // If search is cleared, show recent users
      fetchAdminStats();
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, created_at, is_admin')
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentUsers(data ?? []);
      setSearching(false);
    }, 300);
    // Cleanup
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, isAdmin]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-red-500 font-bold">Access denied. Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Admin Panel</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800/70 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-blue-400">{userCount ?? '-'}</div>
            <div className="text-gray-300 mt-2">Total Users</div>
          </div>
          <div className="bg-gray-800/70 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-green-400">{planCount ?? '-'}</div>
            <div className="text-gray-300 mt-2">Total Study Plans</div>
          </div>
        </div>
        <div className="mb-4 flex justify-end">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search users by name or email..."
            className="px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 w-full md:w-80"
            disabled={searching}
          />
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Allowed Email Extensions for Premium Access</h2>
          <form onSubmit={handleAddExtension} className="flex flex-col md:flex-row gap-2 mb-4">
            <input
              type="text"
              value={newExtension}
              onChange={e => setNewExtension(e.target.value)}
              placeholder="e.g. *.stteresaschool.in"
              className="px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 w-full md:w-80"
              disabled={extLoading}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              disabled={extLoading || !newExtension.trim()}
            >
              Add Extension
            </button>
          </form>
          {extLoading ? (
            <div className="text-gray-300">Loading...</div>
          ) : (
            <ul className="list-disc list-inside text-gray-200">
              {emailExtensions.length === 0 && <li>No extensions added yet.</li>}
              {emailExtensions.map((ext, idx) => (
                <li key={idx}>{ext}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Users</h2>
          {(loading || searching) ? (
            <div className="text-gray-300">Loading...</div>
          ) : (
            <table className="w-full text-left text-gray-300">
              <thead>
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Admin</th>
                  <th className="py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-700 last:border-0">
                    <td className="py-2">{u.full_name || 'N/A'}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.is_admin ? 'Yes' : 'No'}</td>
                    <td className="py-2">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
} 