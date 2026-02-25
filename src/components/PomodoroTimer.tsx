import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, Volume2, VolumeX } from 'lucide-react';

interface PomodoroSettings {
    work: number;
    shortBreak: number;
    longBreak: number;
    sessionsUntilLongBreak: number;
}

export function PomodoroTimer() {
    const [settings, setSettings] = useState<PomodoroSettings>({
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4,
    });

    const [mode, setMode] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
    const [timeLeft, setTimeLeft] = useState(settings.work * 60);
    const [isActive, setIsActive] = useState(false);
    const [sessionCount, setSessionCount] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            handleTimerComplete();
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, timeLeft]);

    const handleTimerComplete = () => {
        setIsActive(false);
        if (!isMuted) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => { });
        }

        if (mode === 'work') {
            const newSessionCount = sessionCount + 1;
            setSessionCount(newSessionCount);
            if (newSessionCount % settings.sessionsUntilLongBreak === 0) {
                setMode('longBreak');
                setTimeLeft(settings.longBreak * 60);
            } else {
                setMode('shortBreak');
                setTimeLeft(settings.shortBreak * 60);
            }
        } else {
            setMode('work');
            setTimeLeft(settings.work * 60);
        }
    };

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        if (mode === 'work') setTimeLeft(settings.work * 60);
        else if (mode === 'shortBreak') setTimeLeft(settings.shortBreak * 60);
        else setTimeLeft(settings.longBreak * 60);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = (timeLeft / (
        mode === 'work' ? settings.work * 60 :
            mode === 'shortBreak' ? settings.shortBreak * 60 : settings.longBreak * 60
    )) * 100;

    return (
        <div className="p-10 text-slate-100 max-w-3xl mx-auto bg-slate-800 border-r-8 border-white/10 min-h-full">
            <div className="flex justify-between items-center mb-12">
                <h2 className="text-3xl font-black flex items-center gap-4 uppercase tracking-tighter italic">
                    <div className={`p-2 border border-white/10 shadow-neo ${mode === 'work' ? 'bg-neo-accent text-white' : 'bg-neo-secondary text-slate-100'}`}>
                        {mode === 'work' ? <Brain className="w-8 h-8 stroke-[3px]" /> : <Coffee className="w-8 h-8 stroke-[3px]" />}
                    </div>
                    {mode === 'work' ? 'DEEP FOCUS' : mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK'}
                </h2>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-3 border border-white/10 bg-slate-800 shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-neo transition-all"
                    >
                        {isMuted ? <VolumeX className="w-6 h-6 stroke-[3px]" /> : <Volume2 className="w-6 h-6 stroke-[3px]" />}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-3 border border-white/10 bg-neo-muted shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-neo transition-all"
                    >
                        <Settings className="w-6 h-6 stroke-[3px]" />
                    </button>
                </div>
            </div>

            <div className="relative flex flex-col items-center mb-16">
                {/* Massive Timer Box */}
                <div className={`
                    w-full py-16 px-8 border border-white/10 shadow-neo text-center relative overflow-hidden
                    ${mode === 'work' ? 'bg-slate-800' : 'bg-slate-900'}
                `}>
                    <div className="relative z-10">
                        <span className="text-9xl md:text-[10rem] font-black tracking-tighter italic tabular-nums leading-none">
                            {formatTime(timeLeft)}
                        </span>
                        <div className="mt-4 flex flex-col items-center gap-2">
                            <div className="bg-slate-900 text-white px-4 py-1 font-black uppercase text-sm tracking-[0.2em] -rotate-1 shadow-neo">
                                SESSION #{sessionCount + 1}
                            </div>
                            <p className="text-[10px] font-black text-slate-100/40 uppercase tracking-widest mt-2 italic">
                                STATUS: {isActive ? 'ACTIVE_TRANSMISSION' : 'WAITING_FOR_COMMAND'}
                            </p>
                        </div>
                    </div>

                    {/* Industrial Progress Bar */}
                    <div className="absolute bottom-0 left-0 w-full h-6 bg-slate-900/5 border-t-4 border-white/10">
                        <div
                            className={`h-full transition-all duration-1000 border-r-4 border-white/10 ${mode === 'work' ? 'bg-neo-accent' : 'bg-neo-secondary'}`}
                            style={{ width: `${100 - progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-center gap-10 mb-16">
                <button
                    onClick={toggleTimer}
                    className={`
                        group w-28 h-28 border border-white/10 flex items-center justify-center transition-all duration-200 
                        shadow-neo hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-neo
                        active:translate-x-0 active:translate-y-0 active:shadow-none
                        ${isActive ? 'bg-neo-muted rotate-3' : 'bg-neo-accent -rotate-3'}
                    `}
                >
                    {isActive
                        ? <Pause className="w-12 h-12 fill-black stroke-black stroke-[3px]" />
                        : <Play className="w-12 h-12 fill-white text-white ml-2 stroke-[3px]" />
                    }
                </button>
                <button
                    onClick={resetTimer}
                    className="w-28 h-28 border border-white/10 bg-slate-800 flex items-center justify-center shadow-neo hover:bg-neo-secondary hover:rotate-12 transition-all group active:shadow-none active:translate-x-2 active:translate-y-2"
                >
                    <RotateCcw className="w-12 h-12 stroke-[4px] group-hover:rotate-180 transition-transform duration-500" />
                </button>
            </div>

            {showSettings && (
                <div className="bg-slate-900 border border-white/10 p-8 shadow-neo mb-12 relative animate-in slide-in-from-top-4">
                    <div className="absolute -top-4 left-6 bg-slate-900 text-white px-4 py-1 font-black uppercase text-xs tracking-widest">
                        SYSTEM_CONFIG
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                        {[
                            { label: 'FOCUS INTERVAL', key: 'work', value: settings.work },
                            { label: 'SHORT INTERMISSION', key: 'shortBreak', value: settings.shortBreak },
                            { label: 'LONG INTERMISSION', key: 'longBreak', value: settings.longBreak },
                            { label: 'SESSION CYCLE', key: 'sessionsUntilLongBreak', value: settings.sessionsUntilLongBreak }
                        ].map((item) => (
                            <div key={item.key}>
                                <label className="block text-[10px] font-black text-slate-100 uppercase tracking-widest mb-2">{item.label}</label>
                                <input
                                    type="number"
                                    value={item.value}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        setSettings({ ...settings, [item.key]: val });
                                        if (mode === item.key) setTimeLeft(val * 60);
                                    }}
                                    className="w-full bg-slate-800 border border-white/10 px-4 py-3 font-black text-xl italic focus:bg-neo-secondary outline-none transition-colors shadow-neo"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Industrial Stats Grid */}
            <div className="grid grid-cols-3 gap-6">
                {[
                    { label: 'SESSIONS', value: sessionCount, color: 'bg-neo-accent', text: 'text-white' },
                    { label: 'FOCUS_MINS', value: `${sessionCount * settings.work}M`, color: 'bg-neo-secondary' },
                    { label: 'DEEP_HOURS', value: `${Math.floor((sessionCount * settings.work) / 60)}H`, color: 'bg-neo-muted' }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-slate-800 border border-white/10 p-4 text-center shadow-neo">
                        <div className={`inline-block px-3 py-1 border border-white/10 ${stat.color} ${stat.text || 'text-slate-100'} font-black text-xl italic mb-1 mb-2`}>
                            {stat.value}
                        </div>
                        <div className="text-[10px] font-black text-slate-100/40 uppercase tracking-widest">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );

}
