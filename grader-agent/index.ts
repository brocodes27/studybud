// Notebook Grader Machine — device agent.
//
// Runs on the physical grader box (e.g. aryan@grader.local). Modeled on
// scripts/server.ts (service-role Supabase client on a trusted local machine),
// but instead of exposing an HTTP server it subscribes to Supabase Realtime
// and reacts to commands written to public.grading_sessions by the Grader
// Console (/teacher/grader) on the operator's laptop:
//
//   capture_page    -> photograph the current page, upload to 'notebook-scans',
//                      insert a grading_pages row
//   retake_last     -> re-photograph and overwrite the last captured page
//   start_checking  -> set status 'checking' and invoke the grade-notebook
//   resume             Edge Function (OCR + AI evaluation + test_results append)
//   pause           -> set status 'paused'
//
// Env (.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GRADER_DEVICE_ID,
//             CAPTURE_CMD (optional command template, '{out}' = output file)
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { params: { eventsPerSecond: 5 } },
});

const DEVICE_ID = process.env.GRADER_DEVICE_ID || 'grader-local-1';
const BUCKET = 'notebook-scans';

// Camera command template. '{out}' is replaced with the output JPEG path.
// Defaults: Linux -> fswebcam, macOS -> imagesnap.
// Raspberry Pi camera module: CAPTURE_CMD="libcamera-still -n -o {out}"
const DEFAULT_CAPTURE_CMD = process.platform === 'darwin'
    ? 'imagesnap -w 1 {out}'
    : 'fswebcam -r 1920x1080 --no-banner --jpeg 90 {out}';
const CAPTURE_CMD = process.env.CAPTURE_CMD || DEFAULT_CAPTURE_CMD;

const log = (...args: unknown[]) => console.log(`[${new Date().toISOString()}]`, ...args);

let isCapturing = false;
let sessionStatus = 'idle';
let liveFeedInterval: NodeJS.Timeout | null = null;

function startLiveFeed() {
    if (liveFeedInterval) return;
    log("Starting live feed loop...");
    liveFeedInterval = setInterval(async () => {
        if (isCapturing || sessionStatus !== 'capturing') return;
        isCapturing = true;
        const tempPath = path.join(os.tmpdir(), `live-${DEVICE_ID}.jpg`);
        try {
            let cmd = CAPTURE_CMD;
            if (cmd.includes('rpicam-still')) {
                cmd = cmd.replace('rpicam-still', 'rpicam-still --width 640 --height 480');
            } else if (cmd.includes('libcamera-still')) {
                cmd = cmd.replace('libcamera-still', 'libcamera-still --width 640 --height 480');
            } else if (cmd.includes('fswebcam')) {
                cmd = cmd.replace('-r 1920x1080', '-r 640x480');
            }
            
            const parts = cmd.split(/\s+/).map((p) => p.replace('{out}', tempPath));
            const [c, ...args] = parts;
            
            await new Promise<void>((resolve, reject) => {
                execFile(c, args, { timeout: 8000 }, (err, _stdout, stderr) => {
                    if (err) return reject(new Error(`Live capture failed: ${err.message} ${stderr}`));
                    resolve();
                });
            });

            if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
                const base64 = fs.readFileSync(tempPath).toString('base64');
                await channel.send({
                    type: 'broadcast',
                    event: 'live-frame',
                    payload: { image: `data:image/jpeg;base64,${base64}` }
                });
            }
        } catch (e: any) {
            log("Live feed frame capture failed:", e.message || e);
        } finally {
            if (fs.existsSync(tempPath)) {
                fs.unlink(tempPath, () => {});
            }
            isCapturing = false;
        }
    }, 1500);
}

function stopLiveFeed() {
    if (liveFeedInterval) {
        log("Stopping live feed loop...");
        clearInterval(liveFeedInterval);
        liveFeedInterval = null;
    }
}

async function checkActiveSession() {
    try {
        const { data, error } = await supabase
            .from('grading_sessions')
            .select('status')
            .eq('device_id', DEVICE_ID)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (data) {
            sessionStatus = data.status;
            log(`Active session status on startup: ${sessionStatus}`);
            if (sessionStatus === 'capturing') {
                startLiveFeed();
            } else {
                stopLiveFeed();
            }
        }
    } catch (err: any) {
        log('Failed to check active session status on startup:', err.message || err);
    }
}

function capturePhoto(outPath: string): Promise<void> {
    isCapturing = true;
    const parts = CAPTURE_CMD.split(/\s+/).map((p) => p.replace('{out}', outPath));
    const [cmd, ...args] = parts;
    log(`Capturing photo: ${cmd} ${args.join(' ')}`);
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 30000 }, (err, _stdout, stderr) => {
            isCapturing = false;
            if (err) return reject(new Error(`Camera capture failed (${cmd}): ${err.message} ${stderr || ''}`));
            if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
                return reject(new Error(`Camera produced no image at ${outPath}`));
            }
            resolve();
        });
    });
}

async function markFailed(sessionId: string, message: string) {
    try {
        await supabase.from('grading_sessions')
            .update({ status: 'failed', error_message: message })
            .eq('id', sessionId);
    } catch (e) {
        log('Failed to write failure status:', e);
    }
}

async function uploadPage(sessionId: string, pageNumber: number): Promise<string> {
    const localPath = path.join(os.tmpdir(), `${sessionId}-page-${pageNumber}.jpg`);
    await capturePhoto(localPath);
    const storagePath = `${sessionId}/page-${pageNumber}.jpg`;
    const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fs.readFileSync(localPath), { contentType: 'image/jpeg', upsert: true });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
    fs.unlink(localPath, () => { /* best-effort cleanup */ });
    return storagePath;
}

async function handleCapturePage(sessionId: string) {
    const { count, error: countErr } = await supabase
        .from('grading_pages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);
    if (countErr) throw new Error(`Failed to count pages: ${countErr.message}`);
    const pageNumber = (count ?? 0) + 1;
    const storagePath = await uploadPage(sessionId, pageNumber);
    const { error: insertErr } = await supabase.from('grading_pages').insert({
        session_id: sessionId,
        page_number: pageNumber,
        storage_path: storagePath,
    });
    if (insertErr) throw new Error(`Failed to insert page row: ${insertErr.message}`);
    log(`Captured page ${pageNumber} for session ${sessionId} -> ${storagePath}`);
}

async function handleRetakeLast(sessionId: string) {
    const { data: lastPage, error } = await supabase
        .from('grading_pages')
        .select('*')
        .eq('session_id', sessionId)
        .order('page_number', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`Failed to load last page: ${error.message}`);
    if (!lastPage) {
        // Nothing captured yet — treat retake as a normal capture.
        return handleCapturePage(sessionId);
    }
    const storagePath = await uploadPage(sessionId, lastPage.page_number);
    const { error: updateErr } = await supabase
        .from('grading_pages')
        .update({ storage_path: storagePath, ocr_text: null })
        .eq('id', lastPage.id);
    if (updateErr) throw new Error(`Failed to update retaken page: ${updateErr.message}`);
    log(`Retook page ${lastPage.page_number} for session ${sessionId}`);
}

async function handleStartChecking(sessionId: string) {
    await supabase.from('grading_sessions')
        .update({ status: 'checking', error_message: null })
        .eq('id', sessionId);
    log(`Invoking grade-notebook for session ${sessionId}...`);
    const { data, error } = await supabase.functions.invoke('grade-notebook', {
        body: { session_id: sessionId },
    });
    if (error) {
        let errMsg = error.message;
        if (error.context) {
            try {
                const body = await error.context.json();
                if (body && body.error) errMsg = body.error;
            } catch (_) {}
        }
        throw new Error(`grade-notebook failed: ${errMsg}`);
    }
    log(`Grading complete for session ${sessionId}:`, JSON.stringify(data)?.slice(0, 300));
}

async function handlePause(sessionId: string) {
    await supabase.from('grading_sessions')
        .update({ status: 'paused' })
        .eq('id', sessionId);
    log(`Session ${sessionId} paused`);
}

// Deduplicate commands: the console bumps command_seq for every button press.
const lastSeenSeq = new Map<string, number>();

async function handleSessionUpdate(session: any) {
    const { id, command, command_seq } = session || {};
    if (!id || !command || typeof command_seq !== 'number') return;
    if ((lastSeenSeq.get(id) ?? -1) >= command_seq) return; // already handled
    lastSeenSeq.set(id, command_seq);

    log(`Command '${command}' (seq ${command_seq}) for session ${id}`);
    try {
        switch (command) {
            case 'capture_page':
                await handleCapturePage(id);
                break;
            case 'retake_last':
                await handleRetakeLast(id);
                break;
            case 'start_checking':
            case 'resume':
                await handleStartChecking(id);
                break;
            case 'pause':
                await handlePause(id);
                break;
            default:
                log(`Unknown command ignored: ${command}`);
        }
    } catch (err: any) {
        log(`Command '${command}' failed for session ${id}:`, err?.message || err);
        await markFailed(id, String(err?.message || err));
    }
}

log(`Notebook Grader agent starting (device_id=${DEVICE_ID})`);
log(`Supabase: ${supabaseUrl}`);
log(`Capture command: ${CAPTURE_CMD}`);

const channel = supabase
    .channel(`grader-${DEVICE_ID}`)
    .on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'grading_sessions',
            filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload: any) => {
            sessionStatus = payload.new.status;
            if (sessionStatus === 'capturing') {
                startLiveFeed();
            } else {
                stopLiveFeed();
            }
            void handleSessionUpdate(payload.new);
        },
    )
    .subscribe((status: string, err?: Error) => {
        if (status === 'SUBSCRIBED') {
            log(`✅ Realtime subscribed. Waiting for commands from the Grader Console (device_id=${DEVICE_ID})...`);
            void checkActiveSession();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            log(`⚠️ Realtime channel status: ${status}`, err?.message || '');
        } else {
            log(`Realtime channel status: ${status}`);
        }
    });

// Heartbeat log so pm2/systemd logs show liveness.
setInterval(() => {
    log(`heartbeat: agent alive (device_id=${DEVICE_ID}, channel=${channel.state})`);
}, 5 * 60 * 1000);

process.on('SIGINT', async () => {
    log('Shutting down...');
    await supabase.removeChannel(channel);
    process.exit(0);
});
