import { supabase } from './supabase';
import AIService from './aiService';
import { LectureConfig } from '../components/RemotionLecture/LectureComposition';
import { validateLectureConfig } from './lectureSchema';

export class LectureService {
    private static instance: LectureService;
    private ai = AIService.getInstance();

    static getInstance() {
        if (!LectureService.instance) {
            LectureService.instance = new LectureService();
        }
        return LectureService.instance;
    }

    async generateLectureConfig(topic: string, subject: string, description: string): Promise<LectureConfig> {
        const systemPrompt = `You are an elite educational architect. Generate a structured lecture configuration for a Remotion video.

Return ONLY a JSON object that strictly follows this interface:
interface LectureConfig {
  topic: string;
  subject: string;
  voiceId: string; // "Male" or "Female"
  segments: {
    title: string;
    content: string[]; // MAX 10 words per point. MAX 4 points.
    duration: number; // seconds (15-25 typical)
    tts: string; // concise narration
    media?:
      | { type: 'graph'; data: { x:{min:number,max:number,ticks?:number,label?:string,unit?:string}, y:{min:number,max:number,ticks?:number,label?:string,unit?:string}, series:{name?:string,color?:string,points:{x:number,y:number}[]}[] } }
      | { type: 'equation'; data: string } // LaTeX
      | { type: 'shape'; data: { type:'circle'|'rect' } }
      | { type: 'chemistry'; data: { smiles: string; label?: string } }
      | { type: 'diagram'; data: { vectors?:{x:number,y:number,dx:number,dy:number,label?:string,color?:string}[], points?:{x:number,y:number,label?:string}[], axes?:{show?:boolean,xLabel?:string,yLabel?:string} } }
      | { type: 'biology'; data: { nodes?:{x:number,y:number,r?:number,label?:string,fill?:string}[], connections?:{x1:number,y1:number,x2:number,y2:number}[] } };
  }[];
}

CRITICAL:
1) Graphs must use real values + units (no 0-100 normalization unless real).
2) Include axis labels and units for graphs.
3) Equations must be valid LaTeX.
4) Chemistry: provide valid SMILES.
5) Keep bullets ultra-concise.

SUBJECT GUIDANCE:
- Math: use equation + graph (e.g., quadratic) with precise axis range.
- Physics: use diagram (vectors/axes) + equation; include units (m, s, N).
- Chemistry: use chemistry SMILES for structures; label if needed.
- Biology: use biology diagram with labeled nodes (no fake shapes).`;

        const prompt = `Topic: ${topic}\nSubject: ${subject}\nContext/Description: ${description}`;

        try {
            const response = await this.ai.generateChatCompletion(prompt, systemPrompt, false);

            // Extract JSON from output
            const start = response.indexOf('{');
            const end = response.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error('Invalid AI response');

            const config = JSON.parse(response.slice(start, end + 1)) as LectureConfig;

            // Back-compat: upgrade legacy graph format (points only)
            config.segments?.forEach((seg: any) => {
                if (seg.media?.type === 'graph' && Array.isArray(seg.media?.data?.points)) {
                    const pts = seg.media.data.points.map((p: any, i: number) => ({
                        x: typeof p === 'number' ? i : (p.x ?? i),
                        y: typeof p === 'number' ? p : (p.y ?? 0)
                    }));
                    const xs = pts.map(p => p.x);
                    const ys = pts.map(p => p.y);
                    const xMin = Math.min(...xs);
                    const xMax = Math.max(...xs);
                    const yMin = Math.min(...ys);
                    const yMax = Math.max(...ys);
                    seg.media = {
                        type: 'graph',
                        data: {
                            x: { min: xMin, max: xMax, ticks: 4, label: 'x' },
                            y: { min: yMin, max: yMax, ticks: 4, label: 'y' },
                            series: [{ points: pts }]
                        }
                    };
                }
            });

            const validation = validateLectureConfig(config as any);
            if (!validation.ok) {
                console.error('Lecture config validation failed:', validation.errors);
                throw new Error('Invalid lecture config');
            }
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
