import React, { useState, useEffect } from 'react';
import { Users, Trophy, MessageCircle, UserPlus, Crown, Star, Target, BookOpen, Zap, Award, Send, Hash, Calendar, TrendingUp, Medal, BarChart3, Copy, Key, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { usePayment } from '../hooks/usePayment';
import { format } from 'date-fns';

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string;
  created_by: string;
  join_code: string;
  max_members: number;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
  creator_name?: string;
}

interface LeaderboardEntry {
  id: string;
  username: string;
  total_points: number;
  study_streak: number;
  achievement_count: number;
  rank: number;
}

interface GroupLeaderboardEntry {
  user_id: string;
  username: string;
  total_points: number;
  tasks_completed: number;
  study_time_minutes: number;
  rank: number;
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name?: string;
}

interface Achievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  description: string;
  icon: string;
  points: number;
  unlocked_at: string;
}

export function SocialFeatures() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { paymentData, initiatePayment } = usePayment();
  const [activeTab, setActiveTab] = useState<'groups' | 'leaderboard' | 'achievements'>('groups');
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState<GroupLeaderboardEntry[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showGroupLeaderboard, setShowGroupLeaderboard] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: '',
    subject: ''
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(true); // Subscription always true for now
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSocialData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMessages();
      // Set up real-time subscription for messages
      const subscription = supabase
        .channel(`group_messages:${selectedGroup.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${selectedGroup.id}`
        }, (payload) => {
          fetchGroupMessages(); // Refresh messages when new ones arrive
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [selectedGroup]);

  useEffect(() => {
    setShowPaywall(false); // Never show paywall
  }, []);

  const ensureUserProfile = async () => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        const fallbackName = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Student';
        await supabase.from('user_profiles').insert({ id: user.id, full_name: fallbackName });
      }
    } catch (e) {
      console.error('ensureUserProfile error', e);
    }
  };

  const fetchSocialData = async () => {
    try {
      setLoading(true);
      await ensureUserProfile();
      await Promise.all([
        fetchStudyGroups(),
        fetchLeaderboard(),
        fetchAchievements()
      ]);
    } catch (error) {
      console.error('Error fetching social data:', error);
      showToast('Failed to load social features', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudyGroups = async () => {
    try {
      // Fetch only groups user is a member of or created
      const { data: groups, error } = await supabase
        .from('study_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process groups to add member count, membership status, and creator name
      const processedGroups = await Promise.all(
        groups?.map(async (group) => {
          // Get member count
          const { count: memberCount } = await supabase
            .from('study_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          // Check if current user is a member - use limit(1) instead of single()
          const { data: membership } = await supabase
            .from('study_group_members')
            .select('id')
            .eq('group_id', group.id)
            .eq('user_id', user?.id)
            .limit(1);

          // Get creator name from user_profiles
          const { data: creator } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', group.created_by)
            .single();

          return {
            ...group,
            member_count: memberCount || 0,
            is_member: membership && membership.length > 0,
            creator_name: creator?.full_name || 'Unknown'
          };
        }) || []
      );

      // Show only private groups the user belongs to or created
      const visibleGroups = processedGroups.filter((g) => g.is_member || g.created_by === user?.id);
      setStudyGroups(visibleGroups);
    } catch (error) {
      console.error('Error fetching study groups:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data: leaderboardRows, error } = await supabase
        .from('leaderboard_view')
        .select('*')
        .order('rank', { ascending: true })
        .limit(50);

      if (error) throw error;

      // attach usernames from user_profiles (fallback to id)
      const withNames = await Promise.all(
        (leaderboardRows || []).map(async (row) => {
          const userId: string = (row as any).user_id ?? (row as any).id;
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
          return {
            ...row,
            id: userId,
            username: profile?.full_name || 'Unknown'
          } as LeaderboardEntry;
        })
      );
      setLeaderboard(withNames);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchGroupLeaderboard = async (groupId: string) => {
    try {
      // Get all members of the group first
      const { data: members, error: membersError } = await supabase
        .from('study_group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setGroupLeaderboard([]);
        return;
      }

      // Get user profiles for each member separately
      const leaderboardData = await Promise.all(
        members.map(async (member) => {
          // Get user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', member.user_id)
            .single();

          // Get task completions
          const { data: tasks } = await supabase
            .from('task_completions')
            .select('*')
            .eq('user_id', member.user_id);

          // Get study sessions
          const { data: sessions } = await supabase
            .from('study_sessions')
            .select('*')
            .eq('user_id', member.user_id);

          // Get practice test attempts
          const { data: tests } = await supabase
            .from('practice_test_attempts')
            .select('*')
            .eq('user_id', member.user_id);

          // Get achievements
          const { data: userAchievements } = await supabase
            .from('user_achievements')
            .select('points')
            .eq('user_id', member.user_id);

          const tasksCompleted = tasks?.length || 0;
          const studyTimeMinutes = sessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
          const testPoints = tests?.length * 15 || 0;
          const achievementPoints = userAchievements?.reduce((sum, a) => sum + (a.points || 0), 0) || 0;

          const totalPoints = (tasksCompleted * 10) + (sessions?.length * 5 || 0) + testPoints + achievementPoints;

          return {
            user_id: member.user_id,
            username: profile?.full_name || 'Unknown',
            total_points: totalPoints,
            tasks_completed: tasksCompleted,
            study_time_minutes: studyTimeMinutes,
            rank: 0 // Will be set after sorting
          };
        })
      );

      // Sort by total points and assign ranks
      const sortedData = leaderboardData
        .sort((a, b) => b.total_points - a.total_points)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      setGroupLeaderboard(sortedData);
    } catch (error) {
      console.error('Error fetching group leaderboard:', error);
      showToast('Failed to load group leaderboard', 'error');
    }
  };

  const fetchAchievements = async () => {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user?.id)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchGroupMessages = async () => {
    if (!selectedGroup) return;

    try {
      // First get the messages
      const { data: messages, error: messagesError } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', selectedGroup.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (messagesError) throw messagesError;

      // Then get user profiles for each unique user_id
      const userIds = [...new Set(messages?.map(msg => msg.user_id) || [])];
      const userProfiles = await Promise.all(
        userIds.map(async (userId) => {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .eq('id', userId)
            .single();
          return profile;
        })
      );

      // Create a map of user_id to full_name
      const userMap = userProfiles.reduce((acc, profile) => {
        if (profile) {
          acc[profile.id] = profile.full_name;
        }
        return acc;
      }, {} as Record<string, string>);

      // Add user names to messages
      const messagesWithNames = messages?.map(msg => ({
        ...msg,
        user_name: userMap[msg.user_id] || 'Unknown User'
      })) || [];

      setGroupMessages(messagesWithNames);
    } catch (error) {
      console.error('Error fetching group messages:', error);
    }
  };

  const createStudyGroup = async () => {
    if (!newGroupData.name.trim() || !newGroupData.subject.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      // Create the group (join_code will be auto-generated by trigger)
      const { data: group, error: groupError } = await supabase
        .from('study_groups')
        .insert({
          name: newGroupData.name,
          description: newGroupData.description,
          subject: newGroupData.subject,
          created_by: user?.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('study_group_members')
        .insert({
          group_id: group.id,
          user_id: user?.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      setShowCreateGroup(false);
      setNewGroupData({ name: '', description: '', subject: '' });
      fetchStudyGroups();
      showToast(`Study group created! Join code: ${group.join_code}`, 'success');
    } catch (error) {
      console.error('Error creating study group:', error);
      showToast('Failed to create study group', 'error');
    }
  };

  const startEditingGroup = (group: StudyGroup) => {
    setEditingGroupId(group.id);
    setNewGroupName(group.name);
  };

  const saveGroupName = async (groupId: string) => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      showToast('Group name cannot be empty', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('study_groups')
        .update({ name: trimmed })
        .eq('id', groupId);
      if (error) throw error;
      setEditingGroupId(null);
      fetchStudyGroups();
      showToast('Group name updated', 'success');
    } catch (e) {
      console.error('saveGroupName error', e);
      showToast('Failed to update group name', 'error');
    }
  };

  const joinGroupByCode = async () => {
    if (!joinCode.trim()) {
      showToast('Please enter a join code', 'error');
      return;
    }

    try {
      // Find group by join code
      const { data: group, error: groupError } = await supabase
        .from('study_groups')
        .select('*')
        .eq('join_code', joinCode.trim().toUpperCase())
        .single();

      if (groupError || !group) {
        showToast('Invalid join code', 'error');
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('study_group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user?.id)
        .limit(1);

      if (existingMember && existingMember.length > 0) {
        showToast('You are already a member of this group', 'error');
        setShowJoinGroup(false);
        setJoinCode('');
        return;
      }

      // Check member limit
      const { count: memberCount } = await supabase
        .from('study_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      if (memberCount && memberCount >= group.max_members) {
        showToast('This group is full', 'error');
        return;
      }

      // Join the group
      const { error: joinError } = await supabase
        .from('study_group_members')
        .insert({
          group_id: group.id,
          user_id: user?.id,
          role: 'member'
        });

      if (joinError) throw joinError;

      setShowJoinGroup(false);
      setJoinCode('');
      fetchStudyGroups();
      showToast(`Successfully joined "${group.name}"!`, 'success');
    } catch (error) {
      console.error('Error joining group:', error);
      showToast('Failed to join group', 'error');
    }
  };

  const leaveGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user?.id);

      if (error) throw error;

      fetchStudyGroups();
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
      }
      showToast('Left study group', 'success');
    } catch (error) {
      console.error('Error leaving group:', error);
      showToast('Failed to leave study group', 'error');
    }
  };

  const copyJoinCode = async (joinCode: string) => {
    try {
      await navigator.clipboard.writeText(joinCode);
      showToast('Join code copied to clipboard!', 'success');
    } catch (error) {
      showToast('Failed to copy join code', 'error');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup) return;

    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: selectedGroup.id,
          user_id: user?.id,
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      // Messages will be updated via real-time subscription
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message', 'error');
    }
  };

  const openGroupLeaderboard = (group: StudyGroup) => {
    setSelectedGroup(group);
    setShowGroupLeaderboard(true);
    fetchGroupLeaderboard(group.id);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-400" />;
    if (rank === 2) return <Award className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="text-lg font-bold text-gray-500">#{rank}</span>;
  };

  const getGroupRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const handleSubscribe = async () => {
    try {
      await initiatePayment();
    } catch (error) {
      console.error('Payment error:', error);
      showToast('Failed to start payment. Please try again.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Razorpay Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 shadow-xl text-center max-w-sm w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-4 text-black">Unlock All Features</h2>
            <p className="mb-6 text-black">Subscribe for <span className="font-bold text-neon-blue">₹199</span> to access all features.</p>
            <button
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-neon-purple to-pink-600 text-black px-6 py-3 rounded-xl font-semibold text-lg hover:from-neon-purple/80 hover:to-pink-600/80 transition-all duration-200 shadow-lg shadow-neon-purple/20"
            >
              Go to Subscription
            </button>
          </div>
        </div>
      )}
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-black">Social Learning</h1>
            <p className="text-black mt-2 font-medium">Connect, compete, and learn together in private study groups</p>
          </div>

          <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
            {(['groups', 'leaderboard', 'achievements'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === tab
                  ? 'bg-neon-blue text-black shadow-lg shadow-neon-blue/20'
                  : 'text-black/60 hover:text-black hover:bg-white/5'
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'groups' && (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold text-black">Private Study Groups</h2>
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={() => setShowJoinGroup(true)}
                  className="flex-1 md:flex-none bg-gradient-to-r from-neon-green to-emerald-600 text-black px-6 py-3 rounded-xl hover:from-neon-green/80 hover:to-emerald-600/80 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-neon-green/20"
                >
                  <Key className="h-5 w-5" />
                  Join with Code
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="flex-1 md:flex-none bg-gradient-to-r from-neon-blue to-blue-600 text-black px-6 py-3 rounded-xl hover:from-neon-blue/80 hover:to-blue-600/80 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-neon-blue/20"
                >
                  <UserPlus className="h-5 w-5" />
                  Create Group
                </button>
              </div>
            </div>

            {/* Join Group Modal */}
            {showJoinGroup && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-md">
                  <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <Key className="h-5 w-5 text-neon-green" />
                    Join Study Group
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-black text-black mb-2">
                        Enter Join Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., ABC123"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-black focus:border-neon-green focus:outline-none text-center text-lg font-mono tracking-wider placeholder-gray-600"
                        maxLength={6}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Ask a group member for the 6-character join code
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={joinGroupByCode}
                        disabled={!joinCode.trim()}
                        className="flex-1 bg-neon-green hover:bg-neon-green/80 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
                      >
                        Join Group
                      </button>
                      <button
                        onClick={() => {
                          setShowJoinGroup(false);
                          setJoinCode('');
                        }}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-black py-3 px-6 rounded-xl transition-colors duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create Group Modal */}
            {showCreateGroup && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-md">
                  <h3 className="text-lg font-bold text-black mb-4">Create Private Study Group</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Group Name"
                      value={newGroupData.name}
                      onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-black focus:border-neon-blue focus:outline-none placeholder-gray-600"
                    />
                    <input
                      type="text"
                      placeholder="Subject"
                      value={newGroupData.subject}
                      onChange={(e) => setNewGroupData(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-black focus:border-neon-blue focus:outline-none placeholder-gray-600"
                    />
                    <textarea
                      placeholder="Description"
                      value={newGroupData.description}
                      onChange={(e) => setNewGroupData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-black focus:border-neon-blue focus:outline-none resize-none placeholder-gray-600"
                    />
                    <div className="glass-card rounded-xl p-4 border border-neon-blue/30 bg-neon-blue/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4 text-neon-blue" />
                        <span className="text-neon-blue font-black text-sm uppercase">Private Group</span>
                      </div>
                      <p className="text-black text-sm">
                        Your group will be private and only accessible with a unique join code that will be generated automatically.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={createStudyGroup}
                        className="flex-1 bg-neon-blue hover:bg-neon-blue/80 text-black font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
                      >
                        Create Group
                      </button>
                      <button
                        onClick={() => setShowCreateGroup(false)}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-black py-3 px-6 rounded-xl transition-colors duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Study Groups Grid */}
            {studyGroups.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 border border-white/10 text-center">
                <div className="bg-white/5 p-6 rounded-2xl mb-6 inline-block border border-white/10">
                  <Users className="h-16 w-16 text-black mx-auto" />
                </div>
                <h4 className="text-xl font-black text-black mb-2">No Study Groups Yet</h4>
                <p className="text-black mb-6">Create your first private study group or join one with a code!</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => setShowJoinGroup(true)}
                    className="bg-gradient-to-r from-neon-green to-emerald-600 text-black px-6 py-3 rounded-xl hover:from-neon-green/80 hover:to-emerald-600/80 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-neon-green/20"
                  >
                    <Key className="h-5 w-5" />
                    Join with Code
                  </button>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="bg-gradient-to-r from-neon-blue to-blue-600 text-black px-6 py-3 rounded-xl hover:from-neon-blue/80 hover:to-blue-600/80 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-neon-blue/20"
                  >
                    <UserPlus className="h-5 w-5" />
                    Create Group
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {studyGroups.map((group) => (
                  <div key={group.id} className="glass-card rounded-2xl p-6 border border-white/10 hover:border-neon-blue/30 transition-all duration-300 group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        {editingGroupId === group.id ? (
                          <>
                            <input
                              type="text"
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              className="text-lg font-bold text-black mb-1 w-full bg-transparent border-b border-white/30 focus:outline-none focus:border-neon-blue"
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => saveGroupName(group.id)}
                                className="text-neon-green p-1 hover:bg-white/10 rounded"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingGroupId(null);
                                  setNewGroupName('');
                                }}
                                className="text-gray-400 p-1 hover:bg-white/10 rounded"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-black mb-1 group-hover:text-neon-blue transition-colors">{group.name}</h3>
                            {group.created_by === user?.id && (
                              <button
                                onClick={() => startEditingGroup(group)}
                                className="text-gray-500 hover:text-black transition-colors"
                                title="Rename group"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-neon-blue text-sm font-black uppercase tracking-wider">{group.subject}</p>
                      </div>
                      <div className="flex items-center gap-1 text-black font-black text-sm bg-white/5 px-2 py-1 rounded-lg">
                        <Users className="h-4 w-4" />
                        {group.member_count}
                      </div>
                    </div>

                    <p className="text-black text-sm mb-3 line-clamp-2 font-medium">{group.description}</p>

                    <div className="text-xs text-black/60 font-black uppercase tracking-widest mb-4">
                      Created by {group.creator_name} • {format(new Date(group.created_at), 'MMM d, yyyy')}
                    </div>

                    {/* Join Code Display */}
                    <div className="bg-black/40 rounded-lg p-3 mb-4 border border-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Join Code</p>
                          <p className="font-mono text-lg font-bold text-black tracking-wider">{group.join_code}</p>
                        </div>
                        <button
                          onClick={() => copyJoinCode(group.join_code)}
                          className="bg-white/10 hover:bg-white/20 text-black p-2 rounded-lg transition-colors duration-200"
                          title="Copy join code"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {group.is_member ? (
                        <>
                          <button
                            onClick={() => setSelectedGroup(group)}
                            className="flex-1 bg-neon-blue hover:bg-neon-blue/80 text-black py-2 px-3 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center gap-1 shadow-lg shadow-neon-blue/20"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Chat
                          </button>
                          <button
                            onClick={() => openGroupLeaderboard(group)}
                            className="bg-neon-purple hover:bg-neon-purple/80 text-black py-2 px-3 rounded-lg transition-colors duration-200 text-sm flex items-center gap-1 shadow-lg shadow-neon-purple/20"
                          >
                            <BarChart3 className="h-4 w-4" />
                            Ranks
                          </button>
                          <button
                            onClick={() => leaveGroup(group.id)}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 px-3 rounded-lg transition-colors duration-200 text-sm border border-red-500/30"
                          >
                            Leave
                          </button>
                        </>
                      ) : (
                        <div className="w-full text-center text-gray-500 text-sm py-2 bg-white/5 rounded-lg">
                          Not a member
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Group Chat Modal */}
            {selectedGroup && !showGroupLeaderboard && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-2xl h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-black">{selectedGroup.name}</h3>
                      <p className="text-sm text-gray-400">{selectedGroup.subject} • {selectedGroup.member_count} members</p>
                    </div>
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className="text-gray-400 hover:text-black text-xl p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto mb-4 space-y-3 custom-scrollbar pr-2">
                    {groupMessages.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageCircle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      groupMessages.map((message) => (
                        <div key={message.id} className={`p-3 rounded-xl max-w-[80%] ${message.user_id === user?.id
                          ? 'bg-neon-blue/20 border border-neon-blue/30 ml-auto text-black'
                          : 'bg-white/5 border border-white/10 mr-auto text-gray-200'
                          }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold text-xs ${message.user_id === user?.id ? 'text-neon-blue' : 'text-gray-400'
                              }`}>
                              {message.user_id === user?.id ? 'You' : message.user_name}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {format(new Date(message.created_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-white/10">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-black focus:border-neon-blue focus:outline-none placeholder-gray-600"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-neon-blue hover:bg-neon-blue/80 disabled:bg-gray-700 disabled:text-gray-500 text-black px-4 py-2 rounded-xl transition-colors duration-200 flex items-center gap-1 shadow-lg shadow-neon-blue/20"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Group Leaderboard Modal */}
            {selectedGroup && showGroupLeaderboard && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 w-full max-w-3xl h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-black flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-neon-yellow" />
                        {selectedGroup.name} Leaderboard
                      </h3>
                      <p className="text-sm text-gray-400">Top performers in this study group</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowGroupLeaderboard(false);
                        setSelectedGroup(null);
                      }}
                      className="text-gray-400 hover:text-black text-xl p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {groupLeaderboard.length === 0 ? (
                      <div className="text-center py-8">
                        <Trophy className="h-12 w-12 text-black/40 mx-auto mb-3" />
                        <p className="text-black font-medium">No activity data yet. Start studying to appear on the leaderboard!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {groupLeaderboard.map((entry, index) => (
                          <div
                            key={entry.user_id}
                            className={`p-4 rounded-xl border transition-all duration-200 ${entry.user_id === user?.id
                              ? 'bg-neon-blue/10 border-neon-blue/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                              : 'bg-white/5 border-white/5 hover:bg-white/10'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 w-8 justify-center">
                                  {getGroupRankIcon(entry.rank)}
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${entry.rank <= 3
                                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg'
                                    : 'bg-gray-700 text-black'
                                    }`}>
                                    {entry.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className={`font-medium ${entry.user_id === user?.id ? 'text-neon-blue' : 'text-black'
                                      }`}>
                                      {entry.username}
                                      {entry.user_id === user?.id && ' (You)'}
                                    </span>
                                    <div className="text-xs text-black/60 font-black uppercase tracking-wider">
                                      {entry.tasks_completed} tasks • {formatTime(entry.study_time_minutes)} studied
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <Star className="h-4 w-4 text-neon-yellow" />
                                  <span className="font-bold text-black">{entry.total_points.toLocaleString()}</span>
                                </div>
                                <div className="text-xs text-black/60 font-black uppercase">points</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="text-center">
                      <p className="text-sm text-black font-medium">
                        Points are calculated from completed tasks, study time, practice tests, and achievements
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-black">Global Leaderboard</h2>

            {leaderboard.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 border border-white/10 text-center">
                <div className="bg-white/5 p-6 rounded-2xl mb-6 inline-block border border-white/10">
                  <Trophy className="h-16 w-16 text-black/40 mx-auto" />
                </div>
                <h4 className="text-xl font-black text-black mb-2">No Rankings Yet</h4>
                <p className="text-black font-medium">Complete study tasks to appear on the leaderboard!</p>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10 bg-white/5">
                  <div className="grid grid-cols-4 gap-4 text-sm font-black text-black uppercase tracking-wider">
                    <span>Rank</span>
                    <span>Student</span>
                    <span>Points</span>
                    <span>Streak</span>
                  </div>
                </div>

                <div className="divide-y divide-white/5">
                  {leaderboard.slice(0, 20).map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-6 grid grid-cols-4 gap-4 items-center hover:bg-white/5 transition-colors duration-200 ${entry.id === user?.id ? 'bg-neon-blue/10 border-l-4 border-neon-blue' : ''
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {getRankIcon(entry.rank)}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${entry.rank <= 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg' : 'bg-gray-700 text-black'
                          }`}>
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                        <span className={`font-medium ${entry.id === user?.id ? 'text-neon-blue' : 'text-black'}`}>
                          {entry.username}
                          {entry.id === user?.id && ' (You)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-neon-yellow" />
                        <span className="font-bold text-black">{entry.total_points.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-400" />
                        <span className="font-bold text-black">{entry.study_streak} days</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-black">Your Achievements</h2>

            {achievements.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 border border-white/10 text-center">
                <div className="bg-white/5 p-6 rounded-2xl mb-6 inline-block border border-white/10">
                  <Award className="h-16 w-16 text-black/40 mx-auto" />
                </div>
                <h4 className="text-xl font-black text-black mb-2">No Achievements Yet</h4>
                <p className="text-black font-medium">Start studying to unlock your first achievement!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="glass-card rounded-2xl p-6 border border-neon-yellow/30 bg-neon-yellow/5 hover:bg-neon-yellow/10 transition-all duration-300"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-3 filter drop-shadow-lg">
                        {achievement.icon}
                      </div>
                      <h3 className="font-bold text-neon-yellow mb-2 text-lg">
                        {achievement.achievement_name}
                      </h3>
                      <p className="text-black text-sm mb-4 font-medium">{achievement.description}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-neon-yellow/20">
                        <div className="bg-neon-yellow/20 text-black px-3 py-1 rounded-full text-xs font-black">
                          +{achievement.points} points
                        </div>
                        <div className="text-xs text-black/60 font-black">
                          {format(new Date(achievement.unlocked_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Achievement Progress */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-black mb-4">Achievement Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-neon-yellow" />
                    <span className="font-black text-black/60 uppercase text-xs tracking-widest">Total Achievements</span>
                  </div>
                  <p className="text-2xl font-black text-black">{achievements.length}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-neon-blue" />
                    <span className="font-black text-black/60 uppercase text-xs tracking-widest">Total Points</span>
                  </div>
                  <p className="text-2xl font-black text-black">
                    {achievements.reduce((sum, a) => sum + a.points, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}