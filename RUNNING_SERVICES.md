# 🎓 Studybud - Complete Setup & Testing Summary

## ✅ What's Running Right Now

### Frontend (Vite React)
- **URL**: http://localhost:5173/
- **Status**: ✅ RUNNING
- **Login**: aryansingh8117@gomail.com / aryan@1980

### Backend Functions (Deno)
- **generate-flashcards**: http://localhost:8000/ ✅ RUNNING
- **generate-practice-test**: http://localhost:8001/ ✅ RUNNING  
- **generate-study-plan**: http://localhost:8002/ ✅ RUNNING
- **pabbly-webhook**: http://localhost:8003/ ✅ RUNNING

---

## 🚀 Quick Start for New Learners

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Deno (for backend functions)
**Windows PowerShell:**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Linux/Mac:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

### 3. Start the Frontend
```bash
npm run dev
```
Opens at: http://localhost:5173/

### 4. Start Backend Functions

Save this as `start-functions.sh`:

```bash
#!/bin/bash

# Export environment variables
export GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0
export SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A

# Start flashcards function
FUNCTION_PORT=8000 $HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-flashcards/index.ts &

# Start practice test function  
FUNCTION_PORT=8001 $HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-practice-test/index.ts &

# Start study plan function
FUNCTION_PORT=8002 $HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-study-plan/index.ts &

# Start webhook function
FUNCTION_PORT=8003 $HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/pabbly-webhook/index.ts &

echo "All functions started!"
```

Run it:
```bash
chmod +x start-functions.sh
./start-functions.sh
```

---

## 🧪 Testing the Application

### Option 1: Use the Web Interface (Easiest!)

1. **Open**: http://localhost:5173/
2. **Login**: aryansingh8117@gomail.com / aryan@1980
3. **Try these features:**
   - **Create Study Plan**: Go to "Study Plans" → Create New Plan
   - **Generate Flashcards**: Go to "Study Tools" → Generate Flashcards
   - **Take Practice Test**: Go to "Study Tools" → Generate Practice Test
   - **View Analytics**: See your study progress and stats

### Option 2: Test with cURL Commands

See `test-api.md` for complete curl examples. Quick example:

```bash
# 1. Get auth token
curl -X POST "https://yjdcshkqgzcubniinwoc.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0Mzg1NzcsImV4cCI6MjA2NjAxNDU3N30.Pu_uzP2h19NsJTR5q36EQ8hYTT7QzTvb2O0aa4gv7ao" \
  -H "Content-Type: application/json" \
  -d '{"email":"aryansingh8117@gomail.com","password":"aryan@1980"}'

# 2. Test flashcards (replace YOUR_TOKEN with access_token from step 1)
curl -X POST "http://localhost:8000/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"topic":"Calculus","subject":"Math","class":"12","count":3}'
```

---

## 📂 Project Structure

```
studybud/
├── src/                          # Frontend React code
│   ├── components/               # React components
│   ├── pages/                    # Page components
│   ├── contexts/                 # Auth context
│   └── lib/                      # Supabase client
├── supabase/
│   └── functions/                # Backend Deno functions
│       ├── generate-flashcards/
│       ├── generate-practice-test/
│       ├── generate-study-plan/
│       └── pabbly-webhook/
├── .env.local                    # Frontend environment variables
├── .env.functions                # Backend environment variables
├── setup.md                      # Detailed setup instructions
├── test-api.md                   # API testing guide
└── RUNNING_SERVICES.md          # This file
```

---

## 🔧 Configuration Files

### `.env.local` (Frontend)
```env
VITE_GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0
VITE_GOOGLE_CLIENT_ID=451001975335-d22klr7jqbehak8kt0voitcurrdvdk9g.apps.googleusercontent.com
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co
```

### `.env.functions` (Backend)
```env
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🎯 Key Features

### 1. AI-Powered Study Plans
- Input: class, subject, chapters, exam date
- Output: Day-by-day study schedule with practice questions
- Endpoint: POST http://localhost:8002/

### 2. Flashcard Generator
- Input: topic, subject, class, count
- Output: Educational flashcards with Q&A
- Endpoint: POST http://localhost:8000/

### 3. Practice Test Generator
- Input: subject, chapters, question count
- Output: Multiple-choice test with answers
- Endpoint: POST http://localhost:8001/

### 4. Progress Analytics
- Track study time
- View completion rates
- Monitor learning trends

---

## 🐛 Known Issues & Fixes

### Issue: "Failed to parse AI response"
**Status**: ✅ FIXED
**Solution**: Updated all functions to strip markdown code blocks from Gemini responses

### Issue: Functions on wrong ports
**Status**: ✅ FIXED  
**Solution**: Updated `pabbly-webhook` to read `FUNCTION_PORT` env variable

---

## 📚 Documentation Files

- **`setup.md`** - Complete setup guide with step-by-step instructions
- **`test-api.md`** - API testing guide with curl examples
- **`RUNNING_SERVICES.md`** - This file - overview and quick start

---

## 🎓 For New Learners

### Recommended Learning Path:

1. **Start the app** (follow Quick Start above)
2. **Open the frontend** at http://localhost:5173/
3. **Login** with provided credentials
4. **Try creating a study plan**:
   - Subject: Mathematics
   - Class: 12
   - Chapters: Calculus, Algebra
   - Exam Date: Pick a future date
5. **Generate flashcards** for a topic you're studying
6. **Take a practice test** to assess your knowledge
7. **View analytics** to see your progress

### Understanding the Tech Stack:

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Deno + Supabase Functions
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API
- **Auth**: Supabase Auth

---

## 🚨 Important Notes

1. **API Keys**: The Gemini API key in this setup is for testing. Get your own at: https://makersuite.google.com/app/apikey
2. **JWT Tokens**: Expire after 1 hour - re-login if you get 401 errors
3. **Rate Limits**: Gemini API has rate limits - wait if you hit them
4. **Local Only**: These functions run locally and connect to your hosted Supabase project

---

## 📞 Need Help?

- Check `setup.md` for detailed instructions
- See `test-api.md` for API testing examples
- View browser console for frontend errors
- Check terminal output for backend function errors

---

**Happy Learning! 🎉**
