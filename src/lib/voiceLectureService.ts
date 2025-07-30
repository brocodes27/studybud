import { supabase } from './supabase';

export interface VoiceLectureData {
  id: string;
  lessonId: string;
  userId: string;
  topic: string;
  conversationHistory: ConversationMessage[];
  progress: number;
  accuracy: number;
  xpEarned: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
  confidence?: number;
  keywords?: string[];
}

export interface AITutorPersonality {
  id: string;
  name: string;
  description: string;
  voiceSettings: {
    rate: number;
    pitch: number;
    voice: string;
  };
  teachingStyle: 'encouraging' | 'strict' | 'friendly' | 'socratic';
  specialty: string[];
}

export class VoiceLectureService {
  private static instance: VoiceLectureService;
  private recognition: any;
  private synthesis: SpeechSynthesis;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeSpeechRecognition();
  }

  static getInstance(): VoiceLectureService {
    if (!VoiceLectureService.instance) {
      VoiceLectureService.instance = new VoiceLectureService();
    }
    return VoiceLectureService.instance;
  }

  private initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    }
  }

  async getVoiceLectureData(lessonId: string, userId: string): Promise<VoiceLectureData | null> {
    const { data, error } = await supabase
      .from('voice_lectures')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching voice lecture data:', error);
      return null;
    }

    return data;
  }

  async saveVoiceLectureData(data: Partial<VoiceLectureData>): Promise<VoiceLectureData | null> {
    const { data: savedData, error } = await supabase
      .from('voice_lectures')
      .upsert(data)
      .select()
      .single();

    if (error) {
      console.error('Error saving voice lecture data:', error);
      return null;
    }

    return savedData;
  }

  async getConversationFlow(topic: string): Promise<any[]> {
    // Fetch from database or use predefined flows
    const flows = {
      motion: [
        {
          ai: "Hello! I'm your physics tutor. Today we're going to explore motion. Can you tell me what you think motion is?",
          expectedKeywords: ['movement', 'change', 'position', 'object', 'move'],
          followUp: "Great! Motion is indeed the change in position of an object over time. What do you think causes motion?",
          hints: ["Think about what makes things move", "Consider everyday examples"],
          difficulty: 'easy'
        },
        {
          ai: "Excellent! Forces cause motion. Can you give me an example of a force in everyday life?",
          expectedKeywords: ['gravity', 'push', 'pull', 'friction', 'weight', 'force'],
          followUp: "Perfect! Now let's talk about velocity. If a car travels 100 meters in 10 seconds, what's its velocity?",
          hints: ["Think about what pulls objects down", "Consider what happens when you push something"],
          difficulty: 'medium'
        },
        {
          ai: "That's right! Velocity = distance/time = 100m/10s = 10 m/s. What's the difference between speed and velocity?",
          expectedKeywords: ['direction', 'vector', 'scalar', 'magnitude', 'speed'],
          followUp: "Exactly! Speed is just how fast, but velocity includes direction. You're doing great!",
          hints: ["Speed tells us how fast", "Velocity tells us how fast AND in what direction"],
          difficulty: 'hard'
        }
      ],
      forces: [
        {
          ai: "Hi there! Let's talk about forces. What do you think a force is?",
          expectedKeywords: ['push', 'pull', 'interaction', 'object', 'motion', 'force'],
          followUp: "A force is indeed a push or pull that can cause motion or change in motion. What are Newton's three laws?",
          hints: ["Think about what you do to move objects", "Consider what happens when you push or pull something"],
          difficulty: 'easy'
        },
        {
          ai: "Great start! Let's focus on the first law. What happens to an object when no force acts on it?",
          expectedKeywords: ['rest', 'motion', 'constant', 'velocity', 'inertia', 'stays'],
          followUp: "Exactly! An object at rest stays at rest, and an object in motion stays in motion unless acted upon by a force.",
          hints: ["Think about what happens to a ball rolling on ice", "Consider what happens when you stop pushing something"],
          difficulty: 'medium'
        },
        {
          ai: "Now for the second law: F = ma. What does this mean?",
          expectedKeywords: ['force', 'mass', 'acceleration', 'proportional', 'net', 'equals'],
          followUp: "Perfect! Force equals mass times acceleration. The more mass, the more force needed for the same acceleration.",
          hints: ["F stands for force", "m stands for mass", "a stands for acceleration"],
          difficulty: 'hard'
        }
      ],
      energy: [
        {
          ai: "Let's explore energy! What do you think energy is?",
          expectedKeywords: ['ability', 'work', 'power', 'capacity', 'motion', 'heat'],
          followUp: "Great! Energy is the ability to do work. What are the main types of energy?",
          hints: ["Think about what makes things move", "Consider what powers your devices"],
          difficulty: 'easy'
        },
        {
          ai: "Excellent! Kinetic and potential energy. Can you give me an example of kinetic energy?",
          expectedKeywords: ['motion', 'moving', 'car', 'ball', 'running', 'falling'],
          followUp: "Perfect! Now what about potential energy?",
          hints: ["Think about objects that could move", "Consider stored energy"],
          difficulty: 'medium'
        },
        {
          ai: "Great! Now let's talk about conservation of energy. What happens to energy in a closed system?",
          expectedKeywords: ['conserved', 'constant', 'total', 'transform', 'convert', 'same'],
          followUp: "Exactly! Energy cannot be created or destroyed, only transformed from one form to another.",
          hints: ["Energy doesn't disappear", "It just changes form"],
          difficulty: 'hard'
        }
      ]
    };

    return (flows as any)[topic.toLowerCase()] || flows.motion;
  }

  async analyzeUserResponse(userInput: string, expectedKeywords: string[]): Promise<{
    accuracy: number;
    keywords: string[];
    feedback: string;
    isCorrect: boolean;
  }> {
    const userWords = userInput.toLowerCase().split(' ');
    const matchedKeywords = expectedKeywords.filter(keyword => 
      userWords.some(word => word.includes(keyword.toLowerCase()))
    );

    const accuracy = (matchedKeywords.length / expectedKeywords.length) * 100;
    const isCorrect = accuracy >= 60;

    let feedback = '';
    if (accuracy >= 80) {
      feedback = "Excellent understanding! You've grasped the concept well.";
    } else if (accuracy >= 60) {
      feedback = "Good effort! You're on the right track.";
    } else {
      feedback = "Let's think about this differently. Consider the key concepts we're discussing.";
    }

    return {
      accuracy,
      keywords: matchedKeywords,
      feedback,
      isCorrect
    };
  }

  async generateAIResponse(
    userInput: string, 
    conversationStep: number, 
    topic: string,
    personality: AITutorPersonality
  ): Promise<string> {
    const flows = await this.getConversationFlow(topic);
    const currentStep = flows[conversationStep];
    
    if (!currentStep) {
      return "Great work! You've completed this topic. Let's move on to the next concept.";
    }

    const analysis = await this.analyzeUserResponse(userInput, currentStep.expectedKeywords);
    
    if (analysis.isCorrect) {
      return currentStep.followUp;
    } else {
      const hints = currentStep.hints || [];
      const randomHint = hints[Math.floor(Math.random() * hints.length)];
      return `That's an interesting perspective! ${randomHint} Can you think about it in terms of what we're learning?`;
    }
  }

  startVoiceRecognition(onResult: (text: string) => void, onError: (error: string) => void): void {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return;
    }

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error);
    };

    this.recognition.start();
  }

  stopVoiceRecognition(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  speakText(text: string, personality: AITutorPersonality): void {
    if (this.synthesis) {
      this.synthesis.cancel(); // Stop any current speech
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = personality.voiceSettings.rate;
      utterance.pitch = personality.voiceSettings.pitch;
      utterance.voice = this.synthesis.getVoices().find(voice => 
        voice.name.includes(personality.voiceSettings.voice)
      ) || null;
      
      this.synthesis.speak(utterance);
    }
  }

  async getAITutorPersonalities(): Promise<AITutorPersonality[]> {
    return [
      {
        id: 'encouraging-sarah',
        name: 'Sarah',
        description: 'Encouraging and patient tutor who celebrates every small success',
        voiceSettings: {
          rate: 0.9,
          pitch: 1.1,
          voice: 'Samantha'
        },
        teachingStyle: 'encouraging',
        specialty: ['physics', 'math', 'chemistry']
      },
      {
        id: 'strict-professor',
        name: 'Dr. Johnson',
        description: 'Strict but fair professor who expects excellence',
        voiceSettings: {
          rate: 0.8,
          pitch: 0.9,
          voice: 'Alex'
        },
        teachingStyle: 'strict',
        specialty: ['advanced physics', 'calculus', 'engineering']
      },
      {
        id: 'friendly-mike',
        name: 'Mike',
        description: 'Friendly tutor who makes learning fun and relatable',
        voiceSettings: {
          rate: 1.0,
          pitch: 1.0,
          voice: 'Tom'
        },
        teachingStyle: 'friendly',
        specialty: ['general science', 'biology', 'earth science']
      },
      {
        id: 'socratic-sophia',
        name: 'Sophia',
        description: 'Socratic tutor who guides you to discover answers yourself',
        voiceSettings: {
          rate: 0.85,
          pitch: 1.05,
          voice: 'Victoria'
        },
        teachingStyle: 'socratic',
        specialty: ['philosophy', 'critical thinking', 'problem solving']
      }
    ];
  }

  async updateUserProgress(userId: string, lessonId: string, progress: number, xpEarned: number): Promise<void> {
    // Update user's overall progress
    const { error: progressError } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        progress,
        xp_earned: xpEarned,
        completed_at: new Date().toISOString()
      });

    if (progressError) {
      console.error('Error updating user progress:', progressError);
    }

    // Update user's total XP
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', userId)
      .single();

    if (!userError && userData) {
      const newTotalXP = (userData.total_xp || 0) + xpEarned;
      await supabase
        .from('profiles')
        .update({ total_xp: newTotalXP })
        .eq('id', userId);
    }
  }

  async getLearningAnalytics(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('voice_lectures')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching learning analytics:', error);
      return null;
    }

    const analytics = {
      totalConversations: data.length,
      averageAccuracy: data.reduce((acc, lecture) => acc + lecture.accuracy, 0) / data.length,
      totalXPEarned: data.reduce((acc, lecture) => acc + lecture.xp_earned, 0),
      favoriteTopics: this.getMostFrequentTopics(data),
      improvementTrend: this.calculateImprovementTrend(data)
    };

    return analytics;
  }

  private getMostFrequentTopics(lectures: any[]): string[] {
    const topicCounts: { [key: string]: number } = {};
    lectures.forEach(lecture => {
      topicCounts[lecture.topic] = (topicCounts[lecture.topic] || 0) + 1;
    });

    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);
  }

  private calculateImprovementTrend(lectures: any[]): number {
    if (lectures.length < 2) return 0;

    const sortedLectures = lectures.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const recentAccuracy = sortedLectures.slice(-5).reduce((acc, lecture) => acc + lecture.accuracy, 0) / 5;
    const earlyAccuracy = sortedLectures.slice(0, 5).reduce((acc, lecture) => acc + lecture.accuracy, 0) / 5;

    return recentAccuracy - earlyAccuracy;
  }
}

export default VoiceLectureService; 