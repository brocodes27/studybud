# elevenfolks

All standalone text and image AI features use Meta Model API with
`muse-spark-1.3-contributor`: chat, study tasks and plans, flashcards, tutoring,
notes, syllabus/image extraction, grading, agent tool calls, streaming workspace
replies, and video script/animation-code generation.

The agent dashboard uses Meta Muse Voice Transcribe for speech recognition and
Groq Orpheus for hosted speech output. Spoken messages use the same saved agent conversation,
tool execution, and independent-check restrictions as typed messages. Embeddings
and other existing specialist features retain their own providers.

## Configuration

Set `MODEL_API_KEY` in your Supabase project's Edge Function secrets, then
redeploy the changed functions. The shared client is
`supabase/functions/_shared/meta.ts`; functions must be redeployed to receive it.
Keep `GEMINI_API_KEY` for other existing specialist services.

### Dashboard voice

The dashboard uses hosted Groq Orpheus English TTS
(`canopylabs/orpheus-v1-english`, voice `hannah`) and Meta Muse Voice Transcribe
for STT. It does not download or run a speech model on the user's device.

Set server-side Supabase secrets `MODEL_API_KEY` (Meta) and `GROQ_API_KEY`
(from a Groq Free-plan organization), then deploy `workspace-voice` and the
frontend. Never put provider keys in `VITE_` variables. The Edge Function checks
signed-in users and allowed origins. Speech replies are split at word boundaries
into chunks of at most 200 characters to meet Orpheus's input limit, then played
in order without truncating the saved reply.

Groq's published Free plan currently allows 10 requests/minute, 100 requests/day,
1,200 tokens/minute, and 3,600 tokens/day for this TTS model, shared across the
organization. Each speech chunk counts as a request. Keep the Groq organization
on the Free plan to avoid paid usage; the app cannot select or enforce your Groq
billing plan. If quota is exhausted, the reply remains readable and the app
reports the limit. It does not retry automatically or fall back to a paid service.

Voice captures mono 16 kHz WAV utterances and sends them after about 900 ms of
silence (or at 25 seconds). It pauses capture while the agent works and speaks
to avoid echo. Mute discards a partial recording; ending voice cancels in-flight
requests and stops microphone capture and playback. Transcripts are saved through
the normal agent message flow, including independent-check restrictions.
Recordings go to Meta for transcription; reply text goes to Groq for speech.
Both require an internet connection. Raw recordings are not stored in the workspace.

Provider contracts: [Meta speech-to-text](https://dev.meta.ai/docs/speech-to-text),
[Groq TTS](https://console.groq.com/docs/text-to-speech/orpheus), and
[Groq rate limits](https://console.groq.com/docs/rate-limits).

For local Edge Functions, put the key in an ignored environment file passed to
`supabase functions serve --env-file`. For video generation and the JEE syllabus
script, set `MODEL_API_KEY` in the server environment or the ignored root `.env` file. Never use a `VITE_` variable
for this key or include it in browser code.

The contributor tier permits Meta to train on submitted prompts and responses,
including study excerpts and images. See the
[Meta model documentation](https://dev.meta.ai/docs/models).

## Checks

- `npm run test:learning`
- `python3 -m unittest discover -s manim_engine -p 'test_meta_client.py'`

The provider tests mock network requests; a live check requires a Meta API key.
