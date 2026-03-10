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

    const totalSeconds = mode === 'work' ? settings.work * 60 : mode === 'shortBreak' ? settings.shortBreak * 60 : settings.longBreak * 60;
    const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

    const modeColors = {
        work: { accent: '#00D1FF', bg: 'bg-[#00D1FF]/10', border: 'border-[#00D1FF]/20', text: 'text-[#00D1FF]', bar: 'bg-[#00D1FF]' },
        shortBreak: { accent: '#34D399', bg: 'bg-[#34D399]/10', border: 'border-[#34D399]/20', text: 'text-[#34D399]', bar: 'bg-[#34D399]' },
        longBreak: { accent: '#F472B6', bg: 'bg-[#F472B6]/10', border: 'border-[#F472B6]/20', text: 'text-[#F472B6]', bar: 'bg-[#F472B6]' },
    };
    const colors = modeColors[mode];

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${colors.bg} border ${colors.border} rounded-[16px] flex items-center justify-center`}>
                        {mode === 'work'
                            ? <Brain className={`w-6 h-6 ${colors.text}`} />
                            : <Coffee className={`w-6 h-6 ${colors.text}`} />
                        }
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight">
                            {mode === 'work' ? 'Deep Focus' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}
                        </h2>
                        <p className="text-xs font-medium text-[#64748B]">
                            {isActive ? 'Timer running...' : 'Ready to start'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="w-10 h-10 rounded-[10px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 transition-colors"
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`w-10 h-10 rounded-[10px] border-2 flex items-center justify-center transition-colors ${showSettings ? `${colors.bg} ${colors.border} ${colors.text}` : 'border-[#0A192F]/10 text-[#64748B] hover:border-[#0A192F]/20'}`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2 bg-[#F8FAFF] rounded-[14px] p-1.5 border-2 border-[#0A192F]/5">
                {(['work', 'shortBreak', 'longBreak'] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => { setMode(m); setIsActive(false); setTimeLeft(m === 'work' ? settings.work * 60 : m === 'shortBreak' ? settings.shortBreak * 60 : settings.longBreak * 60); }}
                        className={`flex-1 py-2 rounded-[10px] text-xs font-bold transition-all ${mode === m ? `bg-white shadow-sm text-[#0A192F] border border-[#0A192F]/5` : 'text-[#64748B] hover:text-[#0A192F]'}`}
                    >
                        {m === 'work' ? 'Focus' : m === 'shortBreak' ? 'Short Break' : 'Long Break'}
                    </button>
                ))}
            </div>

            {/* Timer Display */}
            <div className={`neo-card text-center py-10 ${colors.bg} border-2 ${colors.border}`}>
                {/* Progress Ring */}
                <div className="relative inline-flex items-center justify-center mb-6">
                    <svg className="w-48 h-48 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(10,25,47,0.05)" strokeWidth="8" />
                        <circle
                            cx="60" cy="60" r="54" fill="none"
                            stroke={colors.accent} strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 54}`}
                            strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
                            className="transition-all duration-1000"
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className={`text-5xl font-extrabold ${colors.text} tracking-tight tabular-nums`}>
                            {formatTime(timeLeft)}
                        </span>
                        <span className="text-xs font-bold text-[#64748B] mt-1 uppercase tracking-wider">
                            Session #{sessionCount + 1}
                        </span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-4">
                    <button
                        onClick={toggleTimer}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all hover:-translate-y-1 ${isActive ? 'bg-[#0A192F]/10 text-[#0A192F]' : `${colors.bg.replace('/10', '')} text-white`} border-2 ${colors.border}`}
                        style={!isActive ? { backgroundColor: colors.accent } : {}}
                    >
                        {isActive
                            ? <Pause className="w-7 h-7 fill-current" />
                            : <Play className="w-7 h-7 fill-white text-white ml-1" />
                        }
                    </button>
                    <button
                        onClick={resetTimer}
                        className="w-16 h-16 rounded-full bg-[#F8FAFF] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 hover:-translate-y-1 transition-all group"
                    >
                        <RotateCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="neo-card space-y-4">
                    <h3 className="text-base font-extrabold text-[#0A192F] tracking-tight">Timer Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: 'Focus Duration (min)', key: 'work', value: settings.work },
                            { label: 'Short Break (min)', key: 'shortBreak', value: settings.shortBreak },
                            { label: 'Long Break (min)', key: 'longBreak', value: settings.longBreak },
                            { label: 'Sessions Until Long Break', key: 'sessionsUntilLongBreak', value: settings.sessionsUntilLongBreak }
                        ].map((item) => (
                            <div key={item.key} className="space-y-1.5">
                                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{item.label}</label>
                                <input
                                    type="number"
                                    value={item.value}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        setSettings({ ...settings, [item.key]: val });
                                        if (mode === item.key) setTimeLeft(val * 60);
                                    }}
                                    className="w-full px-4 py-2.5 rounded-[10px] border-2 border-[#0A192F]/10 text-[#0A192F] font-bold focus:outline-none focus:border-[#00D1FF]/40"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Sessions', value: String(sessionCount), color: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/10 border-[#00D1FF]/20' },
                    { label: 'Focus Time', value: `${sessionCount * settings.work}m`, color: 'text-[#34D399]', bg: 'bg-[#34D399]/10 border-[#34D399]/20' },
                    { label: 'Hours', value: `${Math.floor((sessionCount * settings.work) / 60)}h`, color: 'text-[#F472B6]', bg: 'bg-[#F472B6]/10 border-[#F472B6]/20' }
                ].map((stat, idx) => (
                    <div key={idx} className={`rounded-[16px] border-2 p-4 text-center ${stat.bg}`}>
                        <p className={`text-2xl font-extrabold ${stat.color} tracking-tight`}>{stat.value}</p>
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
