
import { supabase } from './supabase';
import { OpenAIService } from './openaiService';
import { pdfFileToImageDataUrls } from './pdfToImages';

export interface GuidedPaper {
    id: string;
    user_id: string;
    title: string | null;
    file_path: string;
    status: 'processing' | 'ready' | 'error';
    created_at: string;
}

export interface GuidedQuestion {
    id: string;
    paper_id: string;
    question_number: number;
    question_text: string;
    question_image_path: string | null;
    created_at: string;
}

export interface GuidedAttempt {
    id: string;
    user_id: string;
    question_id: string;
    current_hint_level: number;
    is_solved: boolean;
    user_solution?: string;
    feedback?: string;
    created_at: string;
}

export const guidedPaperService = {
    async uploadPaper(file: File, userId: string): Promise<{ data: GuidedPaper | null; error: any }> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('paper-uploads')
            .upload(filePath, file);

        if (uploadError) return { data: null, error: uploadError };

        const { data, error } = await supabase
            .from('guided_papers')
            .insert({
                user_id: userId,
                title: file.name,
                file_path: filePath,
                status: 'processing'
            })
            .select()
            .single();

        if (!error && data) {
            // Trigger processing via Client Side Logic
            this.triggerProcessing(data.id);
        }

        return { data, error };
    },

    async getPapers(userId: string): Promise<{ data: GuidedPaper[]; error: any }> {
        const { data, error } = await supabase
            .from('guided_papers')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        return { data: data || [], error };
    },

    async getPaperQuestions(paperId: string): Promise<{ data: GuidedQuestion[]; error: any }> {
        const { data, error } = await supabase
            .from('guided_questions')
            .select('*')
            .eq('paper_id', paperId)
            .order('question_number', { ascending: true });

        return { data: data || [], error };
    },

    async getAttempt(userId: string, questionId: string): Promise<{ data: GuidedAttempt | null; error: any }> {
        const { data, error } = await supabase
            .from('guided_attempts')
            .select('*')
            .eq('user_id', userId)
            .eq('question_id', questionId)
            .single();

        // If not found (error code PGRST116), create one
        if (error && error.code === 'PGRST116') {
            const { data: newData, error: newError } = await supabase
                .from('guided_attempts')
                .insert({
                    user_id: userId,
                    question_id: questionId,
                    current_hint_level: 0
                })
                .select()
                .single();
            return { data: newData, error: newError };
        }

        return { data, error };
    },

    async unlockHint(attemptId: string, currentLevel: number): Promise<{ data: GuidedAttempt | null; error: any }> {
        if (currentLevel >= 3) return { data: null, error: 'Max hints reached' };

        const { data, error } = await supabase
            .from('guided_attempts')
            .update({ current_hint_level: currentLevel + 1 })
            .eq('id', attemptId)
            .select()
            .single();

        return { data, error };
    },

    async getHint(questionId: string, hintLevel: number): Promise<string | null> {
        // First check if hint exists in DB
        const { data, error } = await supabase
            .from('guided_ai_hints')
            .select('hint_content')
            .eq('question_id', questionId)
            .eq('hint_level', hintLevel)
            .single();

        if (data) return data.hint_content;
        return null;
    },

    async triggerProcessing(paperId: string) {
        const { data: paper } = await supabase.from('guided_papers').select('file_path').eq('id', paperId).single();
        if (!paper) return;
        await this.extractQuestionsFromPaper(paperId, paper.file_path);
    },

    async extractQuestionsFromPaper(paperId: string, filePath: string) {
        // 1. Get Public URL
        const { data: { publicUrl } } = supabase.storage.from('paper-uploads').getPublicUrl(filePath);

        let imagesForAnalysis: string[] = [];

        try {
            // Check if PDF
            if (filePath.toLowerCase().endsWith('.pdf')) {
                // Fetch the blob
                const res = await fetch(publicUrl);
                const blob = await res.blob();
                const file = new File([blob], "paper.pdf", { type: "application/pdf" });

                // Convert to images
                imagesForAnalysis = await pdfFileToImageDataUrls(file);
            } else {
                // It's an image. OpenAI accepts URLs.
                imagesForAnalysis = [publicUrl];
            }
        } catch (e) {
            console.error("Error preparing images:", e);
            await supabase.from('guided_papers').update({ status: 'error' }).eq('id', paperId);
            return { success: false, error: e };
        }

        // 2. Call OpenAI Vision to extract
        const prompt = `
      You are an expert OCR and exam digitizer.
      Extract all questions from this exam paper image.
      
      Return STRICT JSON format:
      {
        "questions": [
          { "question_number": 1, "question_text": "..." },
          { "question_number": 2, "question_text": "..." }
        ]
      }
      
      Strict Rules:
      - Ignore headers, instructions, and marks.
      - Combine multi-line text for a single question.
      - If there are images/diagrams, note [Diagram] in the text.
      - Maintain the original numbering.
    `;

        try {
            const response = await OpenAIService.getInstance().analyzeImagesWithVision(imagesForAnalysis, prompt);

            // Parse JSON
            let parsed;
            try {
                // Find JSON block
                const jsonStart = response.indexOf('{');
                const jsonEnd = response.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    parsed = JSON.parse(response.substring(jsonStart, jsonEnd + 1));
                } else {
                    parsed = JSON.parse(response);
                }
            } catch (e) {
                throw new Error("Failed to parse AI response as JSON");
            }

            if (!parsed.questions || !Array.isArray(parsed.questions)) {
                throw new Error("Invalid format");
            }

            // 3. Insert into DB
            const questionsToInsert = parsed.questions.map((q: any) => ({
                paper_id: paperId,
                question_number: Number(q.question_number) || 0,
                question_text: q.question_text
            }));

            const { error } = await supabase.from('guided_questions').insert(questionsToInsert);

            if (error) throw error;

            // 4. Update status
            await supabase.from('guided_papers').update({ status: 'ready' }).eq('id', paperId);

            return { success: true };

        } catch (e) {
            console.error("Extraction failed:", e);
            await supabase.from('guided_papers').update({ status: 'error' }).eq('id', paperId);
            return { success: false, error: e };
        }
    },

    async generateHint(questionId: string, questionText: string, hintLevel: number): Promise<string> {
        // Check if hint exists
        const existing = await this.getHint(questionId, hintLevel);
        if (existing) return existing;

        // Generate new hint
        const prompt = `
      You are a helpful tutor. The student is stuck on this question:
      "${questionText}"

      Provide Hint #${hintLevel}.
      
      Rules:
      - Hint 1: Conceptual direction only. (What topic is this? What broad principle applies?)
      - Hint 2: Problem-solving approach. (What formula or steps should be used? No numbers.)
      - Hint 3: Deeper reasoning. (Why does this approach work? Watch out for common traps. DO NOT SOLVE IT.)
      
      ABSOLUTELY NO ANSWERS. NO NUMERICAL SOLUTIONS. REVEAL NOTHING DIRECTLY.
      Keep it short, encouraging, and clear.
    `;

        const hintContent = await OpenAIService.getInstance().generateChatCompletion(prompt);

        // Save to DB
        await supabase.from('guided_ai_hints').insert({
            question_id: questionId,
            hint_level: hintLevel,
            hint_content: hintContent
        });

        return hintContent;
    }
};
