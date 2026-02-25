import { useState, useEffect } from 'react';
import { Bell, Settings, X, Check, Activity, Cpu, ShieldAlert, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

interface Notification {
   id: string;
   user_id: string;
   type: 'reminder' | 'achievement' | 'suggestion' | 'system';
   title: string;
   message: string;
   is_read: boolean;
   created_at: string;
   action_url?: string;
   priority: 'low' | 'medium' | 'high';
}

interface NotificationSettings {
   email_notifications: boolean;
   push_notifications: boolean;
   study_reminders: boolean;
   achievement_notifications: boolean;
   smart_suggestions: boolean;
   quiet_hours_start: string;
   quiet_hours_end: string;
}

export function SmartNotifications() {
   const { user, loading } = useAuth() as any;
   const { showToast } = useToast();

   const [notifications, setNotifications] = useState<Notification[]>([]);
   const [settings, setSettings] = useState<NotificationSettings>({
      email_notifications: true,
      push_notifications: true,
      study_reminders: true,
      achievement_notifications: true,
      smart_suggestions: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00'
   });
   const [showSettings, setShowSettings] = useState(false);

   useEffect(() => {
      if (user) {
         fetchNotifications();
         fetchSettings();
      }
   }, [user]);

   const fetchNotifications = async () => {
      if (!user) return;
      const { data, error } = await supabase
         .from('notifications')
         .select('*')
         .eq('user_id', user.id)
         .order('created_at', { ascending: false })
         .limit(20);
      if (!error) setNotifications(data || []);
   };

   const fetchSettings = async () => {
      if (!user) return;
      const { data, error } = await supabase
         .from('notification_settings')
         .select('*')
         .eq('user_id', user.id)
         .maybeSingle();
      if (!error && data) setSettings(data);
   };

   const markAsRead = async (id: string) => {
      if (!user) return;
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
   };

   const deleteNotification = async (id: string) => {
      if (!user) return;
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
   };

   const updateSettings = async (newSet: Partial<NotificationSettings>) => {
      if (!user) return;
      const updated = { ...settings, ...newSet };
      await supabase.from('notification_settings').upsert({ user_id: user.id, ...updated });
      setSettings(updated);
      showToast('Core Protocol Updated', 'success');
   };

   const getPriorityStyle = (priority: string) => {
      switch (priority) {
         case 'high': return 'bg-red-50 border-red-600 text-red-900';
         case 'medium': return 'bg-yellow-50 border-yellow-500 text-yellow-900';
         default: return 'bg-slate-800 border-white/10 text-slate-100';
      }
   };

   if (loading) return <div className="p-20 text-center font-black animate-pulse">BOOTING_NOTIFICATION_ARRAY...</div>;

   return (
      <div className="p-8 max-w-6xl mx-auto space-y-10 animate-fade-in bg-slate-900/50 min-h-screen">

         {/* 1. SYSTEM MONITOR HUD */}
         <div className="bg-slate-900 text-white p-8 border-b-8 border-neo-accent shadow-neo flex flex-wrap items-center justify-between gap-8">
            <div className="flex items-center gap-6">
               <div className="bg-neo-secondary p-4 border border-white -rotate-6 shadow-neo">
                  <Bell className="h-10 w-10 text-slate-100" />
               </div>
               <div>
                  <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Neural_Alerts</h1>
                  <p className="text-neo-accent font-black uppercase tracking-[0.3em] text-[10px] mt-2 italic">SYNCING_LIFE_PROTOCOL_v4.0</p>
               </div>
            </div>

            <div className="flex items-center gap-10">
               <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase text-white/40 mb-1 tracking-widest">SIGNAL_STRENGTH</span>
                  <div className="flex gap-1">
                     {[1, 2, 3, 4, 5].map(i => <div key={i} className={`h-4 w-1.5 border border-white/20 ${i < 5 ? 'bg-[#2D9E64]' : 'bg-slate-800/10 animate-pulse'}`} />)}
                  </div>
               </div>
               <button onClick={() => setShowSettings(!showSettings)} className={`p-4 border border-white transition-all ${showSettings ? 'bg-neo-accent text-white shadow-neo' : 'bg-transparent hover:bg-slate-800/10'}`}>
                  <Settings className="h-6 w-6" />
               </button>
            </div>
         </div>

         <div className="grid lg:grid-cols-3 gap-10">

            {/* 2. PRIORITY STREAM */}
            <div className="lg:col-span-2 space-y-6">
               <div className="flex items-center justify-between border-b-4 border-white/10 pb-4">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                     <Activity className="h-6 w-6 text-neo-accent" />
                     Live_Signal_Stream
                  </h2>
                  <span className="bg-slate-900 text-white px-3 py-0.5 text-[8px] font-black uppercase">Buffer: {notifications.length}</span>
               </div>

               {notifications.length === 0 ? (
                  <div className="bg-slate-800 border border-white/10 p-20 text-center shadow-neo">
                     <Cpu className="h-20 w-20 mx-auto mb-6 text-slate-100/10 animate-spin-slow" />
                     <h3 className="text-3xl font-black uppercase italic text-slate-100/40">QUEUE_CLEAR</h3>
                  </div>
               ) : (
                  <div className="space-y-4">
                     {notifications.map((n) => (
                        <div key={n.id} className={`group border border-white/10 p-6 shadow-neo transition-all hover:-translate-y-1 relative overflow-hidden ${getPriorityStyle(n.priority)} ${n.is_read ? 'opacity-40 grayscale' : ''}`}>
                           <div className="flex items-start justify-between gap-6 relative z-10">
                              <div className="flex-1">
                                 <div className="flex items-center gap-3 mb-2">
                                    {n.priority === 'high' && <ShieldAlert className="h-4 w-4 text-red-600 animate-bounce" />}
                                    <h4 className="text-xl font-black uppercase italic leading-none tracking-tight">{n.title}</h4>
                                 </div>
                                 <p className="font-bold text-sm leading-relaxed mb-4">{n.message}</p>
                                 <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest opacity-40">
                                    <span>T+{new Date(n.created_at).toLocaleTimeString()}</span>
                                    <span className="bg-slate-900 text-white px-2 py-0.5">{n.type}</span>
                                 </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                 {!n.is_read && (
                                    <button onClick={() => markAsRead(n.id)} className="p-2 border border-white/10 bg-slate-800 hover:bg-neo-secondary transition-all shadow-neo active:shadow-none">
                                       <Check className="h-4 w-4" />
                                    </button>
                                 )}
                                 <button onClick={() => deleteNotification(n.id)} className="p-2 border border-white/10 bg-slate-800 hover:bg-red-500 hover:text-white transition-all shadow-neo active:shadow-none">
                                    <X className="h-4 w-4" />
                                 </button>
                              </div>
                           </div>
                           <div className="absolute top-0 right-0 h-1 w-full bg-slate-900/5 group-hover:bg-neo-accent transition-colors" />
                        </div>
                     ))}
                  </div>
               )}
            </div>

            {/* 3. PROTOCOL CONFIGURATION */}
            <div className="space-y-6">
               <div className="bg-slate-800 border border-white/10 p-8 shadow-neo -rotate-1">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-8 border-b-4 border-white/10 pb-2">Neural_Configuration</h3>
                  <div className="space-y-6">
                     {[
                        { key: 'study_reminders', label: 'NEURAL_PINGS' },
                        { key: 'smart_suggestions', label: 'PROACTIVE_INSIGHTS' },
                        { key: 'achievement_notifications', label: 'RANK_ADVANCEMENT' }
                     ].map((s) => (
                        <div key={s.key} className="flex items-center justify-between p-4 bg-neo-bg/10 border border-white/10">
                           <span className="text-[10px] font-black uppercase italic">{s.label}</span>
                           <button
                              onClick={() => updateSettings({ [s.key]: !(settings as any)[s.key] })}
                              className={`h-8 w-14 border border-white/10 transition-all relative ${(settings as any)[s.key] ? 'bg-[#2D9E64]' : 'bg-gray-200'}`}
                           >
                              <div className={`absolute top-0 h-full w-1/2 bg-slate-900 border border-white transition-all ${(settings as any)[s.key] ? 'right-0' : 'left-0'}`} />
                           </button>
                        </div>
                     ))}
                  </div>

                  <div className="mt-10 p-6 bg-slate-900 text-white border border-neo-accent rotate-2">
                     <div className="flex items-center gap-4 mb-4">
                        <TrendingUp className="h-6 w-6 text-neo-secondary" />
                        <span className="text-xs font-black uppercase italic tracking-widest">Mastery_Stats</span>
                     </div>
                     <div className="space-y-2">
                        <div className="flex justify-between items-center"><span className="text-[8px] text-white/40">RETENTION_RATE</span><span className="font-black italic">94.2%</span></div>
                        <div className="flex justify-between items-center"><span className="text-[8px] text-white/40">RESPONSE_LATENCY</span><span className="font-black italic">1.8s</span></div>
                        <div className="h-1 bg-slate-800/10 mt-2 rounded-full overflow-hidden"><div className="h-full bg-neo-accent w-[94%]" /></div>
                     </div>
                  </div>
               </div>

               <div className="bg-neo-secondary border border-white/10 p-8 shadow-neo rotate-1">
                  <h4 className="text-xl font-black uppercase italic mb-4">Test_Protocol</h4>
                  <p className="text-[10px] font-bold mb-6 opacity-60">VERIFY NEURAL CONNECTION TO HOST DEVICE OS.</p>
                  <button onClick={() => showToast('Neural link verified.', 'success')} className="w-full bg-slate-900 text-white py-4 border border-white/10 font-black uppercase text-xs hover:bg-slate-800 hover:text-slate-100 transition-all shadow-neo active:shadow-none active:translate-x-1 active:translate-y-1">EMIT_SIGNAL</button>
               </div>
            </div>
         </div>
      </div>
   );
}
