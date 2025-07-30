export interface ConversationAnalysis {
  accuracy: number;
  keywords: string[];
  feedback: string;
  suggestedNextTopics: string[];
  learningStyle: string;
  confidenceLevel: 'low' | 'medium' | 'high';
  areasForImprovement: string[];
  strengths: string[];
  emotionalState: 'confident' | 'uncertain' | 'engaged' | 'confused';
}

export interface LearningInsights {
  preferredLearningStyle: string;
  knowledgeGaps: string[];
  strengths: string[];
  recommendedTopics: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  studyRecommendations: string[];
}

export class GeminiService {
  private static instance: GeminiService;
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  async analyzeConversation(transcript: string, topic: string): Promise<ConversationAnalysis> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this educational conversation about ${topic} and provide a detailed JSON response:

                  {
                    "accuracy": number (0-100 based on understanding),
                    "keywords": ["array", "of", "key", "concepts", "mentioned"],
                    "feedback": "detailed constructive feedback",
                    "suggestedNextTopics": ["array", "of", "logical", "next", "topics"],
                    "learningStyle": "visual|auditory|kinesthetic|reading|writing",
                    "confidenceLevel": "low|medium|high",
                    "areasForImprovement": ["array", "of", "specific", "areas"],
                    "strengths": ["array", "of", "student", "strengths"],
                    "emotionalState": "confident|uncertain|engaged|confused"
                  }

                  Conversation: ${transcript}

                  Analyze for:
                  - Understanding depth and accuracy
                  - Learning style preferences
                  - Confidence level in responses
                  - Emotional engagement
                  - Knowledge gaps and strengths
                  - Logical progression of topics

                  Respond only with valid JSON.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze conversation with Gemini');
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error analyzing conversation with Gemini:', error);
      return {
        accuracy: 75,
        keywords: [],
        feedback: 'Good conversation! Keep learning.',
        suggestedNextTopics: [],
        learningStyle: 'auditory',
        confidenceLevel: 'medium',
        areasForImprovement: ['Continue practicing key concepts'],
        strengths: ['Good engagement'],
        emotionalState: 'engaged'
      };
    }
  }

  async generatePersonalizedFeedback(analysis: ConversationAnalysis, topic: string): Promise<string> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate personalized, encouraging feedback for a student based on this analysis:

                  Analysis: ${JSON.stringify(analysis)}
                  Topic: ${topic}

                  Create feedback that:
                  - Celebrates their strengths
                  - Addresses areas for improvement constructively
                  - Suggests specific next steps
                  - Maintains an encouraging tone
                  - Adapts to their learning style (${analysis.learningStyle})
                  - Considers their confidence level (${analysis.confidenceLevel})
                  - Addresses their emotional state (${analysis.emotionalState})

                  Keep the response under 200 words and make it conversational.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate feedback with Gemini');
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error generating feedback with Gemini:', error);
      return 'Great work on this topic! Keep practicing and you\'ll continue to improve.';
    }
  }

  async generateLearningInsights(userId: string, conversationHistory: any[]): Promise<LearningInsights> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this student's learning history and generate comprehensive insights:

                  Conversation History: ${JSON.stringify(conversationHistory)}

                  Provide a JSON response with:
                  {
                    "preferredLearningStyle": "visual|auditory|kinesthetic|reading|writing",
                    "knowledgeGaps": ["array", "of", "identified", "gaps"],
                    "strengths": ["array", "of", "student", "strengths"],
                    "recommendedTopics": ["array", "of", "recommended", "topics"],
                    "difficultyLevel": "beginner|intermediate|advanced",
                    "studyRecommendations": ["array", "of", "specific", "recommendations"]
                  }

                  Focus on:
                  - Learning patterns and preferences
                  - Consistent strengths and weaknesses
                  - Optimal difficulty level
                  - Personalized study strategies
                  - Topic progression recommendations`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate learning insights with Gemini');
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating learning insights with Gemini:', error);
      return {
        preferredLearningStyle: 'auditory',
        knowledgeGaps: ['Continue building foundational knowledge'],
        strengths: ['Good engagement in conversations'],
        recommendedTopics: ['Continue with current topic progression'],
        difficultyLevel: 'intermediate',
        studyRecommendations: ['Practice regularly', 'Review key concepts']
      };
    }
  }

  async generateAdaptiveQuestions(topic: string, difficulty: string, learningStyle: string): Promise<string[]> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate 5 adaptive questions for a student learning about ${topic}.

                  Difficulty Level: ${difficulty}
                  Learning Style: ${learningStyle}

                  Provide questions that:
                  - Match the difficulty level
                  - Cater to the learning style
                  - Build progressively in complexity
                  - Encourage critical thinking
                  - Connect to real-world applications

                  Return as a JSON array of strings:
                  ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.5,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate adaptive questions with Gemini');
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error('No JSON array found in Gemini response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating adaptive questions with Gemini:', error);
      return [
        `What is the main concept of ${topic}?`,
        `How does ${topic} apply to everyday life?`,
        `What are the key principles of ${topic}?`,
        `Can you give an example of ${topic} in action?`,
        `What would happen if we changed one aspect of ${topic}?`
      ];
    }
  }

  async detectEmotionalState(transcript: string): Promise<string> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze the emotional state of this student based on their conversation:

                  Transcript: ${transcript}

                  Return only one of these emotional states:
                  - confident: Shows strong understanding and self-assurance
                  - uncertain: Shows hesitation or lack of confidence
                  - engaged: Shows enthusiasm and active participation
                  - confused: Shows misunderstanding or difficulty

                  Respond with just the emotional state word.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 10,
            topP: 0.9,
            maxOutputTokens: 50
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to detect emotional state with Gemini');
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini');
      }

      const emotionalState = data.candidates[0].content.parts[0].text.trim().toLowerCase();
      
      // Validate the response
      const validStates = ['confident', 'uncertain', 'engaged', 'confused'];
      return validStates.includes(emotionalState) ? emotionalState : 'engaged';
    } catch (error) {
      console.error('Error detecting emotional state with Gemini:', error);
      return 'engaged';
    }
  }
}

export default GeminiService; 