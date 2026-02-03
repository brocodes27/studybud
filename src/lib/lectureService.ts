import { supabase } from './supabase';
import { OpenAIService } from './openaiService';
import { LectureConfig } from '../components/RemotionLecture/LectureComposition';

export class LectureService {
    private static instance: LectureService;
    private ai = OpenAIService.getInstance();

    static getInstance() {
        if (!LectureService.instance) {
            LectureService.instance = new LectureService();
        }
        return LectureService.instance;
    }

    async generateLectureConfig(topic: string, subject: string, description: string): Promise<LectureConfig> {
        const systemPrompt = `You are an elite educational architect. Your task is to generate a structured lecture configuration for a premium React-based video (Remotion).
        
        Return ONLY a JSON object that strictly follows this interface:
        interface LectureConfig {
            topic: string;
            subject: string;
            voiceId: string; // "Male" or "Female"
            segments: {
                title: string;
                content: string[]; // MAX 10 words per point. MAX 4 points.
                duration: number; // in seconds (usually 15-25 per segment)
                tts: string; // A concise, engaging script for ElevenLabs. Explain the concept while the visuals play.
                media?: {
                    type: 'graph' | 'shape' | 'equation';
                    data: any; // For graphs: { points: [{x:number, y:number}] (y 0-100) }, For shapes: { type: 'circle'|'rect' }, For equation: Plain LaTeX string (e.g. "E=mc^2")
                };
            }[];
        }
        
        CRITICAL: 
        1. Keep bullet points ultra-concise (max 10 words).
        2. Equations must be standard LaTeX.
        3. Make the content high-performance and elite.`;

        const prompt = `Topic: ${topic}\nSubject: ${subject}\nContext/Description: ${description}`;

        try {
            const response = await this.ai.generateChatCompletion(prompt, systemPrompt, false);

            // Extract JSON from output
            const start = response.indexOf('{');
            const end = response.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error('Invalid AI response');

            const config = JSON.parse(response.slice(start, end + 1)) as LectureConfig;
            return config;
        } catch (error) {
            console.error('Failed to generate lecture config:', error);
            // Fallback config
            return {
                topic,
                subject,
                segments: [{
                    title: "Introduction",
                    content: ["Starting our exploration of " + topic, "Initial overview and key objectives", "Setting the stage for deeper learning"],
                    duration: 10
                }]
            };
        }
    }

    async saveLecture(userId: string, topic: string, config: LectureConfig) {
        const { data, error } = await supabase
            .from('video_generations')
            .insert({
                user_id: userId,
                topic: topic,
                script: JSON.stringify(config),
                status: 'completed',
                progress: 100,
                video_url: 'remotion:live',
                logs: [{ time: new Date().toISOString(), msg: 'Lecture configuration generated and stored' }]
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getLecture(topic: string) {
        const { data, error } = await supabase
            .from('video_generations')
            .select('*')
            .eq('topic', topic)
            .eq('video_url', 'remotion:live')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;
        if (data.script) {
            try {
                return JSON.parse(data.script) as LectureConfig;
            } catch {
                return null;
            }
        }
        return null;
    }
}
