# Studybud API Testing Guide

## Your Login Credentials
- **Email:** aryansingh8117@gomail.com
- **Password:** aryan@1980
- **User ID:** 4012d23d-9c0c-4c15-80e6-ac0e5fc895d4

## JWT Access Token (expires at: 2025-11-01 ~8:29 PM UTC)
```
eyJhbGciOiJIUzI1NiIsImtpZCI6IkVKRFNZSzRZMEJuU0VUVnUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3lqZGNzaGtxZ3pjdWJuaWlud29jLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0MDEyZDIzZC05YzBjLTRjMTUtODBlNi1hYzBlNWZjODk1ZDQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMDMyNTQ2LCJpYXQiOjE3NjIwMjg5NDYsImVtYWlsIjoiYXJ5YW5zaW5naDgxMTdAZ29tYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJhcnlhbnNpbmdoODExN0Bnb21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6Imxpc2pzZnJ3IiwiZ3JhZGUiOiIxMiIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic2Nob29sIjoic3QgdGVyZXNhIiwic3ViIjoiNDAxMmQyM2QtOWMwYy00YzE1LTgwZTYtYWMwZTVmYzg5NWQ0In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NjIwMjg5NDZ9XSwic2Vzc2lvbl9pZCI6ImFjN2VlMDk0LWE2ZTQtNGQ5Mi1hYjI1LWUwNTVlNGNhMTZhZiIsImlzX2Fub255bW91cyI6ZmFsc2V9.NadhPqm8Yr8TCuSyM6d2Iq-7cfNk8ICL95ZGrJjcFiw
```

---

## 🔐 Step 1: Get Fresh JWT Token (if expired)

```bash
curl -X POST "https://yjdcshkqgzcubniinwoc.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0Mzg1NzcsImV4cCI6MjA2NjAxNDU3N30.Pu_uzP2h19NsJTR5q36EQ8hYTT7QzTvb2O0aa4gv7ao" \
  -H "Content-Type: application/json" \
  -d '{"email":"aryansingh8117@gomail.com","password":"aryan@1980"}'
```

Copy the `access_token` from the response and use it in the commands below.

---

## 📚 Step 2: Test Generate Flashcards (Port 8000)

### Example 1: Generate 3 flashcards on Calculus

```bash
curl -X POST "http://localhost:8000/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "topic": "Calculus - Derivatives",
    "subject": "Mathematics",
    "class": "12",
    "count": 3
  }'
```

### Example 2: Generate flashcards for Physics

```bash
curl -X POST "http://localhost:8000/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "topic": "Newton Laws of Motion",
    "subject": "Physics",
    "class": "12",
    "count": 5
  }'
```

---

## 📝 Step 3: Test Generate Practice Test (Port 8001)

### Example: Create a 10-question Math test

```bash
curl -X POST "http://localhost:8001/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "subject": "Mathematics",
    "class": "12",
    "chapters": "Calculus, Algebra, Trigonometry",
    "question_count": 10,
    "duration_minutes": 60
  }'
```

---

## 📅 Step 4: Test Generate Study Plan (Port 8002)

### Example: Create a study plan for December exam

```bash
curl -X POST "http://localhost:8002/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "class": "12",
    "subject": "Mathematics",
    "chapters": "Calculus, Algebra, Trigonometry, Probability",
    "exam_date": "2025-12-15"
  }'
```

---

## ⚙️ Currently Running Services

- ✅ **Frontend**: http://localhost:5173/
- ✅ **generate-flashcards**: http://localhost:8000/
- ✅ **generate-practice-test**: http://localhost:8001/
- ✅ **generate-study-plan**: http://localhost:8002/
- ✅ **pabbly-webhook**: http://localhost:8003/

---

## 💡 Tips

1. **Replace `YOUR_TOKEN_HERE`** with your actual JWT access token from Step 1
2. **Token expires** after 1 hour - get a new one if you see 401 errors
3. **The AI takes 5-15 seconds** to generate responses - be patient!
4. **Pretty print JSON** responses by piping to `jq`:
   ```bash
   curl ... | jq '.'
   ```
5. **Save responses** to a file:
   ```bash
   curl ... > response.json
   ```

---

## 🎯 Using the Frontend (Recommended)

The easiest way to test everything is through the web app:

1. Open http://localhost:5173/
2. Login with: **aryansingh8117@gomail.com** / **aryan@1980**
3. Navigate to:
   - **Study Plans** → Create a new study plan
   - **Study Tools** → Generate flashcards or practice tests
   - **Analytics** → View your progress

---

## 🐛 Troubleshooting

### If you get "Failed to parse AI response":
- The Gemini API response format changed
- Check the function terminal output for the actual error
- The functions have been updated to handle markdown code blocks

### If you get 401 Unauthorized:
- Your JWT token expired - run Step 1 again to get a fresh token

### If you get "Connection refused":
- Check if the backend function is running on that port
- Look at the terminal where you started the function

### If Gemini returns errors:
- Check your `GEMINI_API_KEY` is valid
- You may have hit rate limits - wait a minute and try again
