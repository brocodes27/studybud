import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface ActiveGeneration {
    id: string;
    topic: string;
    status: 'generating' | 'completed' | 'failed';
    current_step: string;
    progress: number;
    logs: { time: string; msg: string }[];
}

interface VideoGenerationContextType {
    activeGenerations: Map<string, ActiveGeneration>;
    trackGeneration: (id: string, topic: string) => void;
}

const VideoGenerationContext = createContext<VideoGenerationContextType | undefined>(undefined);

export function VideoGenerationProvider({ children }: { children: React.ReactNode }) {
    const [activeGenerations, setActiveGenerations] = useState<Map<string, ActiveGeneration>>(new Map());

    const trackGeneration = (id: string, topic: string) => {
        setActiveGenerations(prev => {
            const next = new Map(prev);
            next.set(id, {
                id,
                topic,
                status: 'generating',
                current_step: 'Initializing...',
                progress: 0,
                logs: [{ time: new Date().toLocaleTimeString(), msg: 'Initializing engine...' }]
            });
            return next;
        });
    };

    useEffect(() => {
        if (activeGenerations.size === 0) return;

        const channel = supabase
            .channel('global-video-generations')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'video_generations'
                    // removed unsupported 'in.' filter
                },
                (payload) => {
                    const newItem = payload.new as any;

                    setActiveGenerations(prev => {
                        // Only process updates for IDs we are actually tracking
                        if (!prev.has(newItem.id)) return prev;

                        const next = new Map(prev);
                        const existing = next.get(newItem.id)!;
                        const status = newItem.status;

                        // If completed or failed, we might want to keep it for a bit then remove
                        if (status === 'completed' || status === 'failed') {
                            next.set(newItem.id, {
                                ...existing,
                                status,
                                current_step: newItem.current_step || existing.current_step,
                                progress: status === 'completed' ? 1 : existing.progress
                            });

                            // Remove after 10 seconds if completed/failed instead of 5
                            setTimeout(() => {
                                setActiveGenerations(p => {
                                    const n = new Map(p);
                                    n.delete(newItem.id);
                                    return n;
                                });
                            }, 10000);
                        } else {
                            // Increment progress by 10% for every update, up to 95%
                            const newProgress = Math.min(0.95, (existing.progress || 0) + 0.1);
                            const newLog = { time: new Date().toLocaleTimeString(), msg: newItem.current_step };

                            next.set(newItem.id, {
                                ...existing,
                                current_step: newItem.current_step || existing.current_step,
                                progress: newProgress,
                                logs: [...(existing.logs || []), newLog]
                            });
                        }
                        return next;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeGenerations.size]);

    return (
        <VideoGenerationContext.Provider value={{ activeGenerations, trackGeneration }}>
            {children}
        </VideoGenerationContext.Provider>
    );
}

export function useVideoGeneration() {
    const context = useContext(VideoGenerationContext);
    if (!context) {
        throw new Error('useVideoGeneration must be used within a VideoGenerationProvider');
    }
    return context;
}
