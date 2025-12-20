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
        <div className="p-8 text-white max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-12">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    {mode === 'work' ? <Brain className="text-neon-blue" /> : <Coffee className="text-neon-green" />}
                    {mode === 'work' ? 'Focus Session' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}
                </h2>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="relative flex justify-center items-center mb-12">
                {/* Progress Circle */}
                <svg className="w-64 h-64 -rotate-90">
                    <circle
                        cx="128"
                        cy="128"
                        r="120"
                        className="stroke-white/5 fill-none"
                        strokeWidth="8"
                    />
                    <circle
                        cx="128"
                        cy="128"
                        r="120"
                        className={`fill-none transition-all duration-1000 ${mode === 'work' ? 'stroke-neon-blue' : 'stroke-neon-green'
                            }`}
                        strokeWidth="8"
                        strokeDasharray={753.98}
                        strokeDashoffset={753.98 * (progress / 100)}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Timer Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-mono font-bold">{formatTime(timeLeft)}</span>
                    <span className="text-gray-400 mt-2">session #{sessionCount + 1}</span>
                </div>
            </div>

            <div className="flex justify-center gap-6 mb-12">
                <button
                    onClick={toggleTimer}
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${isActive ? 'bg-orange-500 shadow-orange-500/20' : 'bg-neon-blue shadow-neon-blue/20'
                        }`}
                >
                    {isActive ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
                </button>
                <button
                    onClick={resetTimer}
                    className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                    <RotateCcw className="w-8 h-8" />
                </button>
            </div>

            {showSettings && (
                <div className="glass-panel p-6 rounded-2xl border border-white/10 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold mb-4">Timer Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Focus (mins)</label>
                            <input
                                type="number"
                                value={settings.work}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setSettings({ ...settings, work: val });
                                    if (mode === 'work') setTimeLeft(val * 60);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:border-neon-blue outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Short Break (mins)</label>
                            <input
                                type="number"
                                value={settings.shortBreak}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setSettings({ ...settings, shortBreak: val });
                                    if (mode === 'shortBreak') setTimeLeft(val * 60);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:border-neon-blue outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Long Break (mins)</label>
                            <input
                                type="number"
                                value={settings.longBreak}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setSettings({ ...settings, longBreak: val });
                                    if (mode === 'longBreak') setTimeLeft(val * 60);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:border-neon-blue outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Sessions Until Long Break</label>
                            <input
                                type="number"
                                value={settings.sessionsUntilLongBreak}
                                onChange={(e) => setSettings({ ...settings, sessionsUntilLongBreak: parseInt(e.target.value) || 1 })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:border-neon-blue outline-none transition-colors"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Stats/History Mini */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass-panel p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-neon-blue font-bold text-xl">{sessionCount}</div>
                    <div className="text-xs text-gray-400">Total Sessions</div>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-neon-green font-bold text-xl">{sessionCount * settings.work}m</div>
                    <div className="text-xs text-gray-400">Focus Time</div>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-neon-purple font-bold text-xl">
                        {Math.floor((sessionCount * settings.work) / 60)}h
                    </div>
                    <div className="text-xs text-gray-400">Hours Deep</div>
                </div>
            </div>
        </div>
    );
}
