import React, { useState, useEffect } from 'react';
import { Users, Trophy, MessageCircle, UserPlus, Crown, Star, Target, BookOpen, Zap, Award, Send, Hash, Calendar, TrendingUp, Medal, BarChart3, Copy, Key, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
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
    if (rank === 2) return <Award className="h-6 w-6 text-gray-300" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
  };

  const getGroupRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-gray-400">#{rank}</span>;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-32 h-32 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-32 h-32 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin animation-delay-150"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Social Learning</h1>
          <p className="text-gray-400 mt-2">Connect, compete, and learn together in private study groups</p>
        </div>
        
        <div className="flex gap-2">
          {(['groups', 'leaderboard', 'achievements'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Private Study Groups</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinGroup(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
              >
                <Key className="h-5 w-5" />
                Join with Code
              </button>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
              >
                <UserPlus className="h-5 w-5" />
                Create Group
              </button>
            </div>
          </div>

          {/* Join Group Modal */}
          {showJoinGroup && (
            <div className="glass rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Key className="h-5 w-5 text-green-400" />
                Join Study Group
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Enter Join Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-green-500 focus:outline-none text-center text-lg font-mono tracking-wider"
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
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-xl transition-colors duration-200"
                  >
                    Join Group
                  </button>
                  <button
                    onClick={() => {
                      setShowJoinGroup(false);
                      setJoinCode('');
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-xl transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Group Modal */}
          {showCreateGroup && (
            <div className="glass rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold text-white mb-4">Create Private Study Group</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Group Name"
                  value={newGroupData.name}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={newGroupData.subject}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                />
                <textarea
                  placeholder="Description"
                  value={newGroupData.description}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none resize-none"
                />
                <div className="glass rounded-xl p-4 border border-blue-500/30 bg-blue-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-400 font-medium text-sm">Private Group</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Your group will be private and only accessible with a unique join code that will be generated automatically.
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={createStudyGroup}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl transition-colors duration-200"
                  >
                    Create Group
                  </button>
                  <button
                    onClick={() => setShowCreateGroup(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-xl transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Study Groups Grid */}
          {studyGroups.length === 0 ? (
            <div className="glass rounded-2xl p-8 border border-gray-700/50 text-center">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
                <Users className="h-16 w-16 text-gray-400 mx-auto" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">No Study Groups Yet</h4>
              <p className="text-gray-400 mb-6">Create your first private study group or join one with a code!</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowJoinGroup(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                >
                  <Key className="h-5 w-5" />
                  Join with Code
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
                >
                  <UserPlus className="h-5 w-5" />
                  Create Group
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {studyGroups.map((group) => (
                <div key={group.id} className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      {editingGroupId === group.id ? (
                         <>
                           <input
                             type="text"
                             value={newGroupName}
                             onChange={(e) => setNewGroupName(e.target.value)}
                             className="text-lg font-bold text-white mb-1 w-full bg-transparent border-b border-gray-500 focus:outline-none"
                           />
                           <div className="flex gap-1 mt-1">
                             <button
                               onClick={() => saveGroupName(group.id)}
                               className="text-green-400 p-1"
                               title="Save"
                             >
                               <Check className="h-4 w-4" />
                             </button>
                             <button
                               onClick={() => {
                                 setEditingGroupId(null);
                                 setNewGroupName('');
                               }}
                               className="text-gray-400 p-1"
                               title="Cancel"
                             >
                               <X className="h-4 w-4" />
                             </button>
                           </div>
                         </>
                       ) : (
                         <div className="flex items-center gap-2">
                           <h3 className="text-lg font-bold text-white mb-1">{group.name}</h3>
                           {group.created_by === user?.id && (
                             <button
                               onClick={() => startEditingGroup(group)}
                               className="text-gray-400 hover:text-gray-200"
                               title="Rename group"
                             >
                               <Pencil className="h-4 w-4" />
                             </button>
                           )}
                         </div>
                       )}
                       <p className="text-blue-400 text-sm">{group.subject}</p>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 text-sm">
                      <Users className="h-4 w-4" />
                      {group.member_count}
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">{group.description}</p>
                  
                  <div className="text-xs text-gray-500 mb-4">
                    Created by {group.creator_name} • {format(new Date(group.created_at), 'MMM d, yyyy')}
                  </div>

                  {/* Join Code Display */}
                  <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-600/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Join Code</p>
                        <p className="font-mono text-lg font-bold text-white tracking-wider">{group.join_code}</p>
                      </div>
                      <button
                        onClick={() => copyJoinCode(group.join_code)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors duration-200"
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
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center gap-1"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Chat
                        </button>
                        <button
                          onClick={() => openGroupLeaderboard(group)}
                          className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg transition-colors duration-200 text-sm flex items-center gap-1"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Ranks
                        </button>
                        <button
                          onClick={() => leaveGroup(group.id)}
                          className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
                        >
                          Leave
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center text-gray-400 text-sm py-2">
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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-2xl p-6 border border-gray-700/50 w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedGroup.name}</h3>
                    <p className="text-sm text-gray-400">{selectedGroup.subject} • {selectedGroup.member_count} members</p>
                  </div>
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="text-gray-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-96">
                  {groupMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-400">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    groupMessages.map((message) => (
                      <div key={message.id} className={`p-3 rounded-lg ${
                        message.user_id === user?.id 
                          ? 'bg-blue-600/20 border border-blue-500/30 ml-8' 
                          : 'bg-gray-800/50 mr-8'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold text-sm ${
                            message.user_id === user?.id ? 'text-blue-400' : 'text-gray-300'
                          }`}>
                            {message.user_id === user?.id ? 'You' : message.user_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(message.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm">{message.message}</p>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-1"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Group Leaderboard Modal */}
          {selectedGroup && showGroupLeaderboard && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="glass rounded-2xl p-6 border border-gray-700/50 w-full max-w-3xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="h-6 w-6 text-yellow-400" />
                      {selectedGroup.name} Leaderboard
                    </h3>
                    <p className="text-sm text-gray-400">Top performers in this study group</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowGroupLeaderboard(false);
                      setSelectedGroup(null);
                    }}
                    className="text-gray-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {groupLeaderboard.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-400">No activity data yet. Start studying to appear on the leaderboard!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupLeaderboard.map((entry, index) => (
                        <div
                          key={entry.user_id}
                          className={`p-4 rounded-xl border transition-all duration-200 ${
                            entry.user_id === user?.id 
                              ? 'bg-blue-500/10 border-blue-500/30 glow-blue' 
                              : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                {getGroupRankIcon(entry.rank)}
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                  entry.rank <= 3 
                                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' 
                                    : 'bg-gray-600 text-gray-300'
                                }`}>
                                  {entry.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className={`font-medium ${
                                    entry.user_id === user?.id ? 'text-blue-400' : 'text-white'
                                  }`}>
                                    {entry.username}
                                    {entry.user_id === user?.id && ' (You)'}
                                  </span>
                                  <div className="text-xs text-gray-400">
                                    {entry.tasks_completed} tasks • {formatTime(entry.study_time_minutes)} studied
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-yellow-400" />
                                <span className="font-bold text-white">{entry.total_points.toLocaleString()}</span>
                              </div>
                              <div className="text-xs text-gray-400">points</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-700/50">
                  <div className="text-center">
                    <p className="text-sm text-gray-400">
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
          <h2 className="text-xl font-bold text-white">Global Leaderboard</h2>
          
          {leaderboard.length === 0 ? (
            <div className="glass rounded-2xl p-8 border border-gray-700/50 text-center">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
                <Trophy className="h-16 w-16 text-gray-400 mx-auto" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">No Rankings Yet</h4>
              <p className="text-gray-400">Complete study tasks to appear on the leaderboard!</p>
            </div>
          ) : (
            <div className="glass rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="p-6 border-b border-gray-700/50">
                <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-400">
                  <span>Rank</span>
                  <span>Student</span>
                  <span>Points</span>
                  <span>Streak</span>
                </div>
              </div>
              
              <div className="divide-y divide-gray-700/50">
                {leaderboard.slice(0, 20).map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-6 grid grid-cols-4 gap-4 items-center hover:bg-gray-800/30 transition-colors duration-200 ${
                      entry.id === user?.id ? 'bg-blue-500/10 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getRankIcon(entry.rank)}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        entry.rank <= 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' : 'bg-gray-600 text-gray-300'
                      }`}>
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                      <span className={`font-medium ${entry.id === user?.id ? 'text-blue-400' : 'text-white'}`}>
                        {entry.username}
                        {entry.id === user?.id && ' (You)'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-400" />
                      <span className="font-bold text-white">{entry.total_points.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-400" />
                      <span className="font-bold text-white">{entry.study_streak} days</span>
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
          <h2 className="text-xl font-bold text-white">Your Achievements</h2>
          
          {achievements.length === 0 ? (
            <div className="glass rounded-2xl p-8 border border-gray-700/50 text-center">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
                <Award className="h-16 w-16 text-gray-400 mx-auto" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">No Achievements Yet</h4>
              <p className="text-gray-400 mb-6">Start studying to unlock your first achievement!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="glass rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/10 card-hover"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {achievement.icon}
                    </div>
                    <h3 className="font-bold text-yellow-400 mb-2">
                      {achievement.achievement_name}
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">{achievement.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium">
                        +{achievement.points} points
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(achievement.unlocked_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Achievement Progress */}
          <div className="glass rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-4">Achievement Progress</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <span className="font-semibold text-white">Total Achievements</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{achievements.length}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-5 w-5 text-blue-400" />
                  <span className="font-semibold text-white">Total Points</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {achievements.reduce((sum, a) => sum + a.points, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}