# VAPI Integration for Voice Lectures

## Overview
This application integrates VAPI (Voice AI Platform) to provide real-time voice conversations with AI tutors. Students can have interactive voice lectures with different AI personalities.

## Features
- **Real-time Voice Conversations**: Students can speak with AI tutors naturally
- **Multiple AI Personalities**: Choose from different teaching styles (Friendly, Encouraging, Strict, Socratic)
- **Advanced Conversation Analysis**: Google Gemini Pro analyzes conversations for deep learning insights
- **Personalized Feedback**: AI generates tailored feedback based on learning style and emotional state
- **Emotional Intelligence**: Detects student emotional state and adapts teaching approach
- **Adaptive Questions**: Generates questions tailored to student's learning style and difficulty level
- **Progress Tracking**: Saves conversation data and learning progress
- **Multi-language Support**: Supports different languages and accents

## Setup

### 1. Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# VAPI Configuration
VITE_VAPI_API_KEY=your_vapi_api_key_here
VITE_VAPI_ASSISTANT_ID=your_vapi_assistant_id_here
VITE_VAPI_VOICE_ID=your_vapi_voice_id_here

# Gemini Configuration (for conversation analysis)
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. VAPI Account Setup
1. Sign up at [vapi.ai](https://vapi.ai)
2. Create an API key in your dashboard
3. Create an assistant with the following configuration:
   - Model: GPT-4
   - Voice: Choose your preferred voice
   - Instructions: Use the system prompts provided in the code

### 3. Database Setup
Run the migration to create the required tables:
```bash
supabase db push
```

## Usage

### Starting a Voice Lecture
1. Navigate to the Learning Path
2. Select a lesson with voice lecture type
3. Choose your preferred AI personality
4. Click "Start Voice Lecture"
5. Speak naturally with your AI tutor

### AI Personalities

#### Mike - Friendly
- Teaching style: Casual and relatable
- Best for: General topics, making learning fun
- Voice: Natural, conversational

#### Sarah - Encouraging
- Teaching style: Patient and supportive
- Best for: Students who need confidence building
- Voice: Warm, encouraging

#### Dr. Johnson - Strict
- Teaching style: Direct and challenging
- Best for: Advanced students, exam preparation
- Voice: Authoritative, precise

#### Sophia - Socratic
- Teaching style: Question-based learning
- Best for: Critical thinking development
- Voice: Thoughtful, guiding

## Technical Implementation

### VAPIService Class
Located in `src/lib/vapiService.ts`, this class handles:
- Call initialization and management
- Real-time WebSocket connections
- Conversation analysis using Google Gemini Pro
- Database integration

### GeminiService Class
Located in `src/lib/geminiService.ts`, this class provides:
- Advanced conversation analysis with learning insights
- Personalized feedback generation
- Emotional state detection
- Adaptive question generation
- Learning style identification
- Comprehensive learning analytics

### VoiceLectureInterface Component
Located in `src/components/VoiceLectureInterface.tsx`, this component provides:
- Real-time chat interface
- Voice input controls
- Personality selection
- Progress tracking

### Database Schema
- `voice_lectures`: Stores conversation history and progress
- `user_progress`: Tracks overall learning progress
- `ai_tutor_personalities`: Defines different AI personalities
- `user_voice_preferences`: User preferences for voice settings

## API Endpoints

### VAPI Endpoints
- `POST /call/create`: Initialize a new voice call
- `GET /call/{id}`: Get call status
- `POST /call/{id}/end`: End a call
- `GET /call/{id}/transcript`: Get conversation transcript
- `GET /voice`: Get available voices
- `GET /assistant`: Get available assistants

### Custom Endpoints
- Conversation analysis using Google Gemini Pro
- Progress tracking and XP calculation
- Learning analytics and insights

## Error Handling
The system includes fallback mechanisms:
- If VAPI is unavailable, falls back to mock conversations
- Graceful degradation for network issues
- Error logging and user feedback

## Security
- All API keys are stored in environment variables
- Row Level Security (RLS) enabled on database tables
- User authentication required for voice lectures
- Secure WebSocket connections

## Performance Optimization
- WebSocket connections for real-time updates
- Efficient conversation storage in JSONB format
- Caching of AI personalities and voice settings
- Optimized database queries with proper indexing

## Future Enhancements
- Multi-language support with automatic translation
- Emotion detection from voice tone
- Adaptive difficulty based on conversation analysis
- Integration with external learning platforms
- Advanced analytics dashboard for teachers 