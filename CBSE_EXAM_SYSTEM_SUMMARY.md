# CBSE Exam System - Implementation Summary

## Overview
The system generates CBSE-aligned question papers for Class 10 and Class 12 students using:
- Database question pools (primary)
- AI generation with grounding (fallback when DB is insufficient)
- Strict CBSE pattern adherence

## Key Components

### 1. Edge Functions

#### `assemble-papers`
**Location**: `supabase/functions/assemble-papers/index.ts`

**Features**:
- Auto-creates pool if none exists
- Generates missing questions on-demand with retry logic
- Grounds AI generation using syllabus and PYQs
- Section-by-section assembly with proper quotas
- Batched generation (10 questions per batch, 3 retries)
- Lenient validation (creates defaults for malformed responses)

**Flow**:
1. Check for active pool → auto-create if missing
2. Fetch questions from DB
3. If empty pool → bootstrap all qtypes (mcq/short/long)
4. For each section:
   - Check if enough questions of required type
   - If deficit → generate missing with retries
   - Insert into DB and refetch
5. Assemble paper per CBSE pattern
6. Return complete paper

#### `build-question-pool`
**Location**: `supabase/functions/build-question-pool/index.ts`

**Features**:
- Per-qtype quota-based generation
- Uses same CBSE patterns as assembler
- Validation and normalization
- Marks pool as "active" only when complete

### 2. CBSE Patterns

Defined in both edge functions for consistency:

```typescript
"10_Mathematics": {
  sections: [
    { name: "A", type: "mcq",   count: 22, marks_each: 1 },  // MCQ + Assertion
    { name: "B", type: "short", count: 5,  marks_each: 2 },  // VSA
    { name: "C", type: "short", count: 6,  marks_each: 3 },  // SA
    { name: "D", type: "long",  count: 4,  marks_each: 5 },  // LA
    { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case-based
  ]
}
```

**Subjects Configured**:
- Class 10: Mathematics, Science, Social Science, English, Hindi
- Class 12: Physics, Chemistry, Mathematics

### 3. AI Generation with Grounding

**Retrieval Sources** (in order of preference):
1. `match_kb_chunks` RPC (pgvector semantic search) - optional
2. `cbse_syllabi` table (syllabus data)
3. `pyq_bank` table (previous year questions)

**Validation & Normalization**:
- MCQs: Requires 4 options, creates defaults if missing
- `correct_index`: Maps A/B/C/D to 0/1/2/3, defaults to 0
- Short/Long: Uses placeholder answer if missing
- All questions get default difficulty "medium" if not provided

**Retry Logic**:
- Batch size: 10 questions
- Max retries: 3 per batch
- 500ms delay between batches
- 1000ms delay between retry attempts

### 4. Frontend

#### `CBSEExamSimulator.tsx`
- Single "Create Paper" button (no variants, no AI option)
- Calls `assemble-papers` edge function
- Displays generated paper with proper sections
- Export to PDF functionality

#### `AdminPanel.tsx`
- "Build Daily Question Pools" section
- Allows admins to backfill pools proactively
- Date range and target count controls

## Database Schema

### Core Tables

```sql
-- Question pools (2-month cycles)
question_pools (
  id, class_level, subject, status,
  cycle_start, cycle_end, total_questions,
  created_by, created_at
)

-- Question bank
question_bank (
  id, pool_id, class_level, subject,
  qtype, question, options, correct_index,
  answer_text, difficulty, chapter,
  created_at
)

-- CBSE syllabus (for grounding)
cbse_syllabi (
  id, class_level, subject,
  syllabus_data, created_at
)

-- PYQs (for grounding)
pyq_bank (
  id, class_level, subject, year,
  chapter, question, qtype, marks,
  metadata, created_at
)

-- KB chunks for pgvector (optional)
kb_chunks (
  id, class_level, subject, source,
  chapter, content, embedding vector(1536),
  metadata, created_at
)
```

## Environment Variables

Set in Supabase Dashboard → Functions → Environment Variables:

```
GEMINI_API_KEY=your_gemini_key_here
```

## Deployment

```bash
# Deploy both functions
npx supabase functions deploy assemble-papers
npx supabase functions deploy build-question-pool

# Or deploy individually
npx supabase functions deploy assemble-papers
npx supabase functions deploy build-question-pool
```

## Logging & Debugging

Function logs show:
- Bootstrap: `Bootstrap empty pool: mcq=22, short=14, long=4`
- Generation: `Generating 10 mcq questions (0/22 so far)`
- Progress: `Got 10 mcq questions, total: 10/22`
- Completion: `Completed mcq: generated 22/22`
- Section fallback: `Section A (mcq): need 22, have 5, generating 17`
- Warnings: `MCQ missing valid options, creating defaults for: ...`

Access logs: Supabase Dashboard → Functions → assemble-papers → Logs

## Known Limitations & Solutions

### Issue: Not all questions generated
**Solution**: Retry logic with batching (10 per batch, 3 retries)

### Issue: Random order / missing types
**Solution**: Sequential generation per qtype with progress tracking

### Issue: Strict validation discarding questions
**Solution**: Lenient validation with sensible defaults

### Issue: Empty pool not bootstrapping
**Solution**: Auto-create pool and generate all required types before proceeding

## Future Enhancements

1. **Full pgvector integration**
   - Ingest syllabus and PYQ embeddings
   - Implement proper RPC for semantic search

2. **Unit-wise weightage blueprints**
   - Guide chapter selection per CBSE unit weightage
   - E.g., Maths Algebra 20 marks, Geometry 15 marks

3. **Question quality feedback**
   - Allow teachers to rate generated questions
   - Use feedback to improve prompts

4. **More subjects**
   - Add remaining Class 10 subjects
   - Add all Class 12 subjects

5. **Difficulty calibration**
   - Better difficulty distribution based on CBSE patterns
   - Dynamic adjustment based on student performance
