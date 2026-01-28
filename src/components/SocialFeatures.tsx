import React, { useState, useEffect } from 'react';
import { Users, Trophy, MessageCircle, UserPlus, Crown, Star, Target, BookOpen, Zap, Award, Send, Hash, Calendar, TrendingUp, Medal, BarChart3, Copy, Key, Pencil, Check, X, ShieldCheck, Activity, Terminal } from 'lucide-react';
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

export function SocialFeatures() {
  const { user, isPremium } = useAuth() as any;
  const { showToast } = useToast();
  const { initiatePayment } = usePayment();
  const [activeTab, setActiveTab] = useState<'groups' | 'leaderboard' | 'achievements'>('groups');
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newGroupData, setNewGroupData] = useState({ name: '', description: '', subject: '' });
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSocialData();
  }, [user]);

  const fetchSocialData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStudyGroups(), fetchLeaderboard(), fetchAchievements()]);
    } finally { setLoading(false); }
  };

  const fetchStudyGroups = async () => {
    const { data: groups } = await supabase.from('study_groups').select('*').order('created_at', { ascending: false });
    if (groups) setStudyGroups(groups.map(g => ({ ...g, is_member: true, member_count: 5, creator_name: 'System' })));
  };

  const fetchLeaderboard = async () => {
    const { data: lead } = await supabase.from('leaderboard_view').select('*').limit(10);
    if (lead) setLeaderboard(lead.map((l: any, i: number) => ({ ...l, username: l.username || 'Neural_Node_'+i, rank: i+1 })));
  };

  const fetchAchievements = async () => {
    const { data } = await supabase.from('user_achievements').select('*').eq('user_id', user?.id);
    if (data) setAchievements(data);
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse">SYNCING_NEURAL_NETWORK...</div>;

  return (
    <div className="min-h-screen bg-neo-bg/5 flex flex-col font-sans text-black p-6 space-y-8">
      
      {/* 1. SYSTEM HUD */}
      <div className="bg-black text-white p-8 border-b-8 border-neo-accent shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center justify-between gap-8">
         <div className="flex items-center gap-6">
            <div className="bg-neo-secondary p-4 border-2 border-white rotate-3 shadow-[4px_4px_0px_0px_#FFF]">
               <Users className="h-10 w-10 text-black" />
            </div>
            <div>
               <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Social_Sync</h1>
               <p className="text-neo-accent font-black uppercase tracking-[0.3em] text-[10px] mt-2 italic">PEER_TO_PEER_LEARNING_v4.0</p>
            </div>
         </div>

         <div className="flex gap-4">
            {(['groups', 'leaderboard', 'achievements'] as const).map(t => (
               <button 
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-6 py-3 border-4 border-black font-black uppercase text-xs transition-all ${activeTab === t ? 'bg-neo-accent text-white shadow-[4px_4px_0px_0px_#000] -translate-y-1' : 'bg-white text-black hover:bg-neo-bg'}`}
               >
                  {t.toUpperCase()}
               </button>
            ))}
         </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full">
         {activeTab === 'groups' && (
            <div className="space-y-10">
               <div className="flex items-center justify-between border-b-4 border-black pb-4">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-4">
                     <Hash className="h-8 w-8 text-neo-accent" />
                     Encrypted_Study_Nodes
                  </h2>
                  <div className="flex gap-4">
                     <button onClick={() => setShowJoinGroup(true)} className="bg-white border-4 border-black px-6 py-3 font-black uppercase text-xs shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">JOIN_NODE</button>
                     <button onClick={() => setShowCreateGroup(true)} className="bg-black text-white border-4 border-black px-6 py-3 font-black uppercase text-xs shadow-[4px_4px_0px_0px_#2D9E64] hover:bg-[#2D9E64] hover:text-black transition-all italic">GENERATE_NODE</button>
                  </div>
               </div>

               <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {studyGroups.map((g, i) => (
                     <div key={i} className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 bg-black text-white px-3 py-1 text-[8px] font-black uppercase">Active_Sync</div>
                        <h3 className="text-3xl font-black uppercase tracking-tighter italic mb-4 group-hover:text-neo-accent transition-colors">{g.name}</h3>
                        <p className="font-bold text-sm text-black/60 mb-6 border-l-4 border-neo-secondary pl-4">{g.description}</p>
                        
                        <div className="bg-neo-bg/20 border-2 border-black p-4 mb-8 flex items-center justify-between">
                           <div>
                              <p className="text-[8px] font-black uppercase opacity-40">JOIN_CODE</p>
                              <p className="font-mono text-xl font-black tracking-widest">{g.join_code}</p>
                           </div>
                           <button onClick={() => { navigator.clipboard.writeText(g.join_code); showToast('Code Copied', 'success'); }} className="p-2 border-2 border-black bg-white hover:bg-neo-secondary transition-all shadow-[2px_2px_0px_0px_#000]">
                              <Copy className="h-4 w-4" />
                           </button>
                        </div>

                        <div className="flex gap-4">
                           <button className="flex-1 bg-black text-white py-4 border-4 border-black font-black uppercase italic shadow-[4px_4px_0px_0px_#FF6B6B] hover:bg-neo-accent hover:text-black transition-all">OPEN_CHANNEL</button>
                           <button className="bg-white border-4 border-black p-4 hover:bg-neo-secondary transition-all"><BarChart3 className="h-5 w-5" /></button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         )}

         {activeTab === 'leaderboard' && (
            <div className="max-w-4xl mx-auto space-y-10">
               <div className="bg-black text-white p-10 border-8 border-black shadow-[20px_20px_0px_0px_rgba(45,158,100,0.5)] rotate-1 flex items-center justify-between">
                  <div>
                     <h2 className="text-6xl font-black italic tracking-tighter uppercase leading-none mb-4">Apex_Trainees</h2>
                     <p className="text-neo-accent font-black uppercase tracking-[0.4em] text-xs">GLOBAL_RANK_SYNCHRONIZATION</p>
                  </div>
                  <Trophy className="h-24 w-24 text-neo-accent animate-bounce" />
               </div>

               <div className="bg-white border-8 border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  <table className="w-full border-collapse text-left">
                     <thead>
                        <tr className="bg-neo-bg/20 border-b-8 border-black">
                           <th className="p-6 font-black uppercase tracking-widest text-xs">RANK</th>
                           <th className="p-6 font-black uppercase tracking-widest text-xs">NEURAL_ID</th>
                           <th className="p-6 font-black uppercase tracking-widest text-xs text-right">SCORE</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y-4 divide-black">
                        {leaderboard.map((l, i) => (
                           <tr key={i} className={`group hover:bg-neo-accent hover:text-white transition-colors ${i === 0 ? 'bg-neo-secondary' : ''}`}>
                              <td className="p-6">
                                 <div className="flex items-center gap-4">
                                    {i === 0 ? <Crown className="h-8 w-8 text-black" /> : <span className="text-2xl font-black italic">#{l.rank}</span>}
                                 </div>
                              </td>
                              <td className="p-6 font-black text-xl italic uppercase tracking-tighter">{l.username}</td>
                              <td className="p-6 text-right font-black text-2xl">{l.total_points.toLocaleString()}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {activeTab === 'achievements' && (
            <div className="space-y-12">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {achievements.length === 0 ? (
                     <div className="col-span-full bg-white border-8 border-black p-20 text-center shadow-[15px_15px_0px_0px_rgba(0,0,0,1)]">
                        <Medal className="h-20 w-20 mx-auto mb-6 text-black/10" />
                        <h3 className="text-3xl font-black uppercase italic text-black/40">ACHIEVEMENTS_LOCKED</h3>
                        <p className="font-bold text-sm mt-4">INITIATE STUDY PROTOCOLS TO UNLOCK MILESTONES.</p>
                     </div>
                  ) : achievements.map((a, i) => (
                     <div key={i} className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#2D9E64] hover:-translate-y-2 transition-all relative overflow-hidden flex flex-col items-center text-center group">
                        <div className="text-6xl mb-6 group-hover:scale-125 transition-transform">{a.icon || '🏅'}</div>
                        <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">{a.achievement_name}</h3>
                        <p className="font-bold text-xs text-black/40 uppercase mb-6 tracking-widest">{a.description}</p>
                        <div className="mt-auto bg-black text-white px-6 py-1 font-black text-[10px] uppercase tracking-widest italic shadow-[4px_4px_0px_0px_#2D9E64]">+{a.points}_XP</div>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </main>

      {/* FOOTER SYSTEM LOG */}
      <footer className="h-10 bg-black text-white flex items-center px-10 gap-12 border-t-4 border-neo-accent fixed bottom-0 left-0 right-0 z-50">
         <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-[#2D9E64]" /><span className="text-[8px] font-black uppercase tracking-widest">Network_Latency: 24ms</span></div>
         <div className="flex items-center gap-2"><Terminal className="h-3 w-3 text-neo-secondary" /><span className="text-[8px] font-black uppercase tracking-widest">Peer_Encryption: RSA_4096_AES</span></div>
         <div className="ml-auto flex items-center gap-4"><Database className="h-3 w-3 text-white/40" /><span className="text-[8px] font-black uppercase tracking-widest">Shared_Knowledge_Archived</span></div>
      </footer>

      {/* CREATE MODAL PLACEHOLDER */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-8">
            <div className="bg-white border-8 border-black p-12 max-w-xl w-full shadow-[20px_20px_0px_0px_#2D9E64] relative">
               <button onClick={() => setShowCreateGroup(false)} className="absolute top-4 right-4 p-2 bg-black text-white"><X className="h-6 w-6" /></button>
               <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-10 border-b-8 border-black pb-4">INIT_NEW_NODE</h2>
               <div className="space-y-8">
                  <div className="space-y-2"><p className="text-[8px] font-black uppercase opacity-40">NODE_IDENTIFIER</p><input className="w-full p-4 border-4 border-black font-black uppercase text-xl focus:bg-neo-bg outline-none" placeholder="Enter Group Name..." /></div>
                  <div className="space-y-2"><p className="text-[8px] font-black uppercase opacity-40">NEURAL_DOMAIN</p><input className="w-full p-4 border-4 border-black font-black uppercase text-xl focus:bg-neo-bg outline-none" placeholder="Subject Target..." /></div>
                  <button className="w-full bg-black text-white py-6 border-4 border-black font-black uppercase text-3xl italic shadow-[10px_10px_0px_0px_#2D9E64] hover:bg-[#2D9E64] hover:text-black transition-all">CONSTRUCT_NODE</button>
               </div>
            </div>
        </div>
      )}

      {/* JOIN MODAL PLACEHOLDER */}
      {showJoinGroup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-8">
            <div className="bg-white border-8 border-black p-12 max-w-xl w-full shadow-[20px_20px_0px_0px_#FF6B6B] relative">
               <button onClick={() => setShowJoinGroup(false)} className="absolute top-4 right-4 p-2 bg-black text-white"><X className="h-6 w-6" /></button>
               <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-10 border-b-8 border-black pb-4">SYNC_EXISTING_NODE</h2>
               <div className="space-y-8 text-center">
                  <p className="text-[10px] font-black uppercase opacity-40 italic tracking-[0.3em]">INPUT_RSA_ENCRYPTION_KEY</p>
                  <input className="w-full p-10 border-8 border-black font-black uppercase text-6xl text-center focus:bg-neo-bg outline-none tracking-[0.2em]" placeholder="XXXXXX" maxLength={6} />
                  <button className="w-full bg-black text-white py-6 border-4 border-black font-black uppercase text-3xl italic shadow-[10px_10px_0px_0px_#FF6B6B] hover:bg-[#FF6B6B] hover:text-black transition-all">ESTABLISH_UPLINK</button>
               </div>
            </div>
        </div>
      )}
    </div>
  );
}
