import { useState, useEffect } from 'react';
import { Users, Trophy, Hash, Medal, BarChart3, Copy, X, Activity, Terminal, Database, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { usePayment } from '../hooks/usePayment';

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
   const [achievements, setAchievements] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [showCreateGroup, setShowCreateGroup] = useState(false);
   const [showJoinGroup, setShowJoinGroup] = useState(false);
   const [joinCodeInput, setJoinCodeInput] = useState('');
   const [newGroupData, setNewGroupData] = useState({
      name: '',
      description: '',
      subject: ''
   });

   useEffect(() => {
      if (user) {
         fetchStudyGroups();
         fetchLeaderboard();
         fetchAchievements();
      }
   }, [user]);

   const fetchStudyGroups = async () => {
      try {
         // First get groups user is a member of
         const { data: membershipData, error: membershipError } = await supabase
            .from('study_group_members')
            .select('group_id')
            .eq('user_id', user.id);

         if (membershipError) throw membershipError;

         if (!membershipData || membershipData.length === 0) {
            setStudyGroups([]);
            return;
         }

         const groupIds = membershipData.map(m => m.group_id);

         const { data, error } = await supabase
            .from('study_groups')
            .select('*')
            .in('id', groupIds);

         if (error) throw error;
         setStudyGroups(data || []);
      } catch (e: any) {
         console.error('Error fetching study groups:', e);
      } finally {
         setLoading(false);
      }
   };

   const fetchLeaderboard = async () => {
      try {
         const { data, error } = await supabase
            .from('profiles')
            .select('id, username, total_points, study_streak, achievement_count')
            .order('total_points', { ascending: false })
            .limit(10);

         if (error) throw error;
         if (data) {
            setLeaderboard(data.map((entry, index) => ({
               ...entry,
               rank: index + 1
            })));
         }
      } catch (e: any) {
         console.error('Error fetching leaderboard:', e);
      }
   };

   const fetchAchievements = async () => {
      try {
         const { data, error } = await supabase
            .from('user_achievements')
            .select(`
               *,
               achievements:achievement_id (*)
            `)
            .eq('user_id', user.id);

         if (error) throw error;
         setAchievements(data || []);
      } catch (e: any) {
         console.error('Error fetching achievements:', e);
      }
   };

   const handleCreateGroup = async () => {
      if (!isPremium) {
         if (confirm("Creating private nodes requires PRO access. Upgrade now?")) {
            initiatePayment();
         }
         return;
      }

      if (!newGroupData.name || !newGroupData.subject) {
         showToast('Name and Subject are required', 'error');
         return;
      }

      try {
         const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
         const { data: group, error } = await supabase
            .from('study_groups')
            .insert({
               name: newGroupData.name,
               description: newGroupData.description,
               subject: newGroupData.subject,
               created_by: user.id,
               join_code: joinCode,
               max_members: 50
            })
            .select()
            .single();

         if (error) throw error;

         // Add creator as member
         await supabase.from('study_group_members').insert({
            group_id: group.id,
            user_id: user.id,
            role: 'admin'
         });

         showToast('Group Created Successfully!', 'success');
         setShowCreateGroup(false);
         fetchStudyGroups();
      } catch (e: any) {
         showToast(e.message, 'error');
      }
   };

   const handleJoinGroup = async () => {
      if (joinCodeInput.length !== 6) {
         showToast('Invalid Join Code', 'error');
         return;
      }

      try {
         const { data: group, error: groupError } = await supabase
            .from('study_groups')
            .select('id')
            .eq('join_code', joinCodeInput.toUpperCase())
            .single();

         if (groupError || !group) throw new Error('Group not found');

         const { error: joinError } = await supabase
            .from('study_group_members')
            .insert({
               group_id: group.id,
               user_id: user.id,
               role: 'member'
            });

         if (joinError) {
            if (joinError.code === '23505') throw new Error('Already a member');
            throw joinError;
         }

         showToast('Joined successfully!', 'success');
         setShowJoinGroup(false);
         setJoinCodeInput('');
         fetchStudyGroups();
      } catch (e: any) {
         showToast(e.message, 'error');
      }
   };

   if (loading) return (
      <div className="p-12 text-center font-black animate-pulse flex flex-col items-center gap-4">
         <div className="w-12 h-12 border border-white/10 border-t-neo-accent animate-spin" />
         <span className="text-sm uppercase italic tracking-widest">SYNCING_NEURAL_NETWORK...</span>
      </div>
   );

   return (
      <div className="bg-slate-950/50 flex flex-col font-sans text-slate-100 p-4 space-y-6 pb-20">

         {/* 1. SYSTEM HUD */}
         <div className="bg-slate-900 text-white p-4 border-b-2 border-neo-accent shadow-neo flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="bg-neo-secondary p-1.5 border border-white rotate-2 shadow-neo">
                  <Users className="h-5 w-5 text-slate-100" />
               </div>
               <div>
                  <h1 className="text-2xl font-black italic tracking-tight uppercase leading-none text-white">Social_Sync</h1>
                  <p className="text-neo-accent font-black uppercase tracking-[0.2em] text-[7px] mt-0.5 italic">PEER_TO_PEER_LEARNING_v4.0</p>
               </div>
            </div>

            <div className="flex gap-2">
               {(['groups', 'leaderboard', 'achievements'] as const).map(t => (
                  <button
                     key={t}
                     onClick={() => setActiveTab(t)}
                     className={`px-4 py-2 border border-white/10 font-black uppercase text-[10px] transition-all ${activeTab === t ? 'bg-neo-accent text-white shadow-neo -translate-y-0.5' : 'bg-slate-800 text-slate-100 hover:bg-slate-900'}`}
                  >
                     {t.toUpperCase()}
                  </button>
               ))}
            </div>
         </div>

         <main className="flex-1 max-w-7xl mx-auto w-full">
            {activeTab === 'groups' && (
               <div className="space-y-6">
                  <div className="flex items-center justify-between border-b-2 border-white/10 pb-3">
                     <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                        <Hash className="h-5 w-5 text-neo-accent" />
                        Encrypted_Study_Nodes
                     </h2>
                     <div className="flex gap-2">
                        <button onClick={() => setShowJoinGroup(true)} className="bg-slate-800 border border-white/10 px-4 py-2 font-black uppercase text-[10px] shadow-neo hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">JOIN_NODE</button>
                        <button onClick={() => setShowCreateGroup(true)} className="bg-slate-900 text-white border border-white/10 px-4 py-2 font-black uppercase text-[10px] shadow-neo hover:bg-[#2D9E64] hover:text-slate-100 transition-all italic">GENERATE_NODE</button>
                     </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {studyGroups.map((g, i) => (
                        <div key={i} className="bg-slate-800 border border-white/10 p-6 shadow-neo hover:-translate-y-1 transition-all relative overflow-hidden group">
                           <div className="absolute top-0 right-0 bg-slate-900 text-white px-2 py-0.5 text-[7px] font-black uppercase">Active_Sync</div>
                           <h3 className="text-xl font-black uppercase tracking-tight italic mb-2 group-hover:text-neo-accent transition-colors">{g.name}</h3>
                           <p className="font-bold text-xs text-slate-100/60 mb-4 border-l-2 border-neo-secondary pl-2">{g.description}</p>

                           <div className="bg-slate-900/50 border border-white/10 p-3 mb-6 flex items-center justify-between">
                              <div>
                                 <p className="text-[7px] font-black uppercase opacity-40">JOIN_CODE</p>
                                 <p className="font-mono text-base font-black tracking-widest">{g.join_code}</p>
                              </div>
                              <button onClick={() => { navigator.clipboard.writeText(g.join_code); showToast('Code Copied', 'success'); }} className="p-1.5 border border-white/10 bg-slate-800 hover:bg-neo-secondary transition-all shadow-neo">
                                 <Copy className="h-3 w-3" />
                              </button>
                           </div>

                           <div className="flex gap-2">
                              <button className="flex-1 bg-slate-900 text-white py-2.5 border border-white/10 font-black uppercase italic shadow-neo hover:bg-neo-accent hover:text-slate-100 transition-all text-[10px]">OPEN_CHANNEL</button>
                              <button className="bg-slate-800 border border-white/10 p-2.5 hover:bg-neo-secondary transition-all"><BarChart3 className="h-4 w-4" /></button>
                           </div>
                        </div>
                     ))}
                     {studyGroups.length === 0 && !loading && (
                        <div className="col-span-full py-12 text-center bg-slate-800 border border-dashed border-white/10">
                           <p className="text-lg font-black uppercase italic text-slate-100/20 tracking-tight">NO_ACTIVE_NODES_FOUND</p>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {activeTab === 'leaderboard' && (
               <div className="max-w-2xl mx-auto space-y-4">
                  <div className="bg-slate-900 text-white p-4 border border-white/10 shadow-neo rotate-1 flex items-center justify-between">
                     <div>
                        <h2 className="text-2xl font-black italic tracking-tight uppercase leading-none mb-1.5">Apex_Trainees</h2>
                        <p className="text-neo-accent font-black uppercase tracking-[0.3em] text-[7px]">GLOBAL_RANK_SYNCHRONIZATION</p>
                     </div>
                     <Trophy className="h-8 w-8 text-neo-accent animate-bounce" />
                  </div>

                  <div className="bg-slate-800 border border-white/10 shadow-neo overflow-hidden">
                     <table className="w-full border-collapse text-left">
                        <thead>
                           <tr className="bg-slate-900/50 border-b-2 border-white/10 text-[9px]">
                              <th className="p-3 px-4 font-black uppercase tracking-widest">RANK</th>
                              <th className="p-3 px-4 font-black uppercase tracking-widest">NEURAL_ID</th>
                              <th className="p-3 px-4 font-black uppercase tracking-widest text-right">SCORE</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black">
                           {leaderboard.map((l, i) => (
                              <tr key={i} className={`group hover:bg-neo-accent hover:text-white transition-colors ${i === 0 ? 'bg-neo-secondary' : ''}`}>
                                 <td className="p-3 px-4">
                                    <div className="flex items-center gap-2">
                                       {i === 0 ? <Crown className="h-5 w-5 text-slate-100" /> : <span className="text-base font-black italic">#{l.rank}</span>}
                                    </div>
                                 </td>
                                 <td className="p-3 px-4 font-black text-sm italic uppercase tracking-tight">{l.username}</td>
                                 <td className="p-3 px-4 text-right font-black text-base">{l.total_points.toLocaleString()}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}

            {activeTab === 'achievements' && (
               <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {achievements.length === 0 ? (
                        <div className="col-span-full bg-slate-800 border border-dashed border-white/10 p-8 text-center">
                           <Medal className="h-8 w-8 mx-auto mb-2 text-slate-100/10" />
                           <h3 className="text-lg font-black uppercase italic text-slate-100/40 tracking-tight">ACHIEVEMENTS_LOCKED</h3>
                           <p className="font-bold text-[8px] mt-1.5 opacity-60">INITIATE STUDY PROTOCOLS TO UNLOCK MILESTONES.</p>
                        </div>
                     ) : achievements.map((a, i) => (
                        <div key={i} className="bg-slate-800 border border-white/10 p-4 shadow-neo hover:-translate-y-1 transition-all relative overflow-hidden flex flex-col items-center text-center group">
                           <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{a.achievements?.icon || '🏅'}</div>
                           <h3 className="text-base font-black uppercase italic mb-1 tracking-tight">{a.achievements?.name}</h3>
                           <p className="font-bold text-[8px] text-slate-100/40 uppercase mb-4 tracking-widest leading-relaxed">{a.achievements?.description}</p>
                           <div className="mt-auto bg-slate-900 text-white px-3 py-0.5 font-black text-[8px] uppercase tracking-widest italic border border-white/10 shadow-neo">+{a.achievements?.xp_reward || 0}_XP</div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </main>

         {/* FOOTER SYSTEM LOG */}
         <footer className="h-8 bg-slate-900 text-white flex items-center px-6 gap-8 border-t-2 border-neo-accent fixed bottom-0 left-0 right-0 z-50">
            <div className="flex items-center gap-1.5"><Activity className="h-2.5 w-2.5 text-[#2D9E64]" /><span className="text-[7px] font-black uppercase tracking-widest">Latency: 24ms</span></div>
            <div className="flex items-center gap-1.5"><Terminal className="h-2.5 w-2.5 text-neo-secondary" /><span className="text-[7px] font-black uppercase tracking-widest">RSA_4096_AES</span></div>
            <div className="ml-auto flex items-center gap-3"><Database className="h-2.5 w-2.5 text-white/40" /><span className="text-[7px] font-black uppercase tracking-widest text-white/40">DB_ARCHIVE_ACTIVE</span></div>
         </footer>

         {/* CREATE MODAL */}
         {showCreateGroup && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
               <div className="bg-slate-800 border border-white/10 p-8 max-w-md w-full shadow-neo relative">
                  <button onClick={() => setShowCreateGroup(false)} className="absolute top-2 right-2 p-1 bg-slate-900 text-white"><X className="h-4 w-4" /></button>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight mb-6 border-b-4 border-white/10 pb-2">INIT_NEW_NODE</h2>
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <p className="text-[7px] font-black uppercase opacity-40">NODE_IDENTIFIER</p>
                        <input
                           value={newGroupData.name}
                           onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                           className="w-full p-2.5 border border-white/10 bg-slate-800 font-black uppercase text-sm focus:bg-slate-900 outline-none"
                           placeholder="Enter Group Name..."
                        />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[7px] font-black uppercase opacity-40">NEURAL_DOMAIN</p>
                        <input
                           value={newGroupData.subject}
                           onChange={(e) => setNewGroupData({ ...newGroupData, subject: e.target.value })}
                           className="w-full p-2.5 border border-white/10 bg-slate-800 font-black uppercase text-sm focus:bg-slate-900 outline-none"
                           placeholder="e.g. SAT MATH"
                        />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[7px] font-black uppercase opacity-40">DECODING_MISSION</p>
                        <input
                           value={newGroupData.description}
                           onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                           className="w-full p-2.5 border border-white/10 bg-slate-800 font-black uppercase text-sm focus:bg-slate-900 outline-none"
                           placeholder="Mission goals..."
                        />
                     </div>
                     <button onClick={handleCreateGroup} className="w-full bg-slate-900 text-white py-3 border border-white/10 font-black uppercase text-xl italic shadow-neo hover:bg-[#2D9E64] hover:text-slate-100 transition-all">CONSTRUCT_NODE</button>
                  </div>
               </div>
            </div>
         )}

         {/* JOIN MODAL */}
         {showJoinGroup && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
               <div className="bg-slate-800 border border-white/10 p-8 max-w-sm w-full shadow-neo relative">
                  <button onClick={() => setShowJoinGroup(false)} className="absolute top-2 right-2 p-1 bg-slate-900 text-white"><X className="h-4 w-4" /></button>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight mb-6 border-b-4 border-white/10 pb-2">SYNC_NODE</h2>
                  <div className="space-y-6 text-center">
                     <p className="text-[8px] font-black uppercase opacity-40 italic tracking-widest">INPUT_RSA_KEY</p>
                     <input
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        className="w-full p-4 border border-white/10 bg-slate-800 font-black uppercase text-4xl text-center focus:bg-slate-900 outline-none tracking-widest"
                        placeholder="XXXXXX"
                        maxLength={6}
                     />
                     <button onClick={handleJoinGroup} className="w-full bg-slate-900 text-white py-4 border border-white/10 font-black uppercase text-xl italic shadow-neo hover:bg-[#FF6B6B] hover:text-slate-100 transition-all">ESTABLISH_UPLINK</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
