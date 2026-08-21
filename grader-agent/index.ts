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
import { randomUUID } from 'crypto';
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
let lastReleaseTime = 0;

function startLiveFeed() {
    if (liveFeedInterval) return;
    log("Starting live feed loop...");
    liveFeedInterval = setInterval(async () => {
        if (isCapturing || sessionStatus !== 'capturing' || (Date.now() - lastReleaseTime < 250)) return;
        isCapturing = true;
        const tempPath = path.join(os.tmpdir(), `live-${DEVICE_ID}.jpg`);
        try {
            let cmd = CAPTURE_CMD;
            if (cmd.includes('rpicam-still')) {
                cmd = cmd.replace('rpicam-still', 'rpicam-still --width 640 --height 480 --immediate --denoise off');
                cmd = cmd.replace('-t 1000', '-t 1');
            } else if (cmd.includes('libcamera-still')) {
                cmd = cmd.replace('libcamera-still', 'libcamera-still --width 640 --height 480 --immediate --denoise off');
                cmd = cmd.replace('-t 1000', '-t 1');
            } else if (cmd.includes('fswebcam')) {
                cmd = cmd.replace('-r 1920x1080', '-r 640x480');
            } else if (cmd.includes('imagesnap')) {
                cmd = cmd.replace('-w 1', '-w 0.1');
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
            lastReleaseTime = Date.now();
            isCapturing = false;
        }
    }, 250);
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

async function capturePhoto(outPath: string): Promise<void> {
    // Wait for any active live feed capture to release the camera and respect release cooldown
    for (let i = 0; i < 40; i++) { // wait up to 2 seconds
        if (!isCapturing && (Date.now() - lastReleaseTime >= 250)) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    isCapturing = true;
    const parts = CAPTURE_CMD.split(/\s+/).map((p) => p.replace('{out}', outPath));
    const [cmd, ...args] = parts;
    log(`Capturing photo: ${cmd} ${args.join(' ')}`);
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 30000 }, (err, _stdout, stderr) => {
            lastReleaseTime = Date.now();
            isCapturing = false;
            if (err) return reject(new Error(`Camera capture failed (${cmd}): ${err.message} ${stderr || ''}`));
            if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
                return reject(new Error(`Camera produced no image at ${outPath}`));
            }
            resolve();
        });
    });
}

async function markFailed(sessionId: string, commandSeq: number, runToken: string, message: string) {
    try {
        const { data, error } = await supabase.rpc('fail_grading_session_command', {
            p_session_id: sessionId,
            p_command_seq: commandSeq,
            p_run_token: runToken,
            p_error_message: message,
        });
        if (error) throw error;
        if (data !== true) {
            log(`Failure status was not written because session ${sessionId} no longer owns this command lease.`);
        }
    } catch (e) {
        log('Failed to write failure status:', e);
    }
}

async function removeUploadedPage(storagePath: string) {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) log(`Could not clean up unused scan ${storagePath}:`, error.message);
}

async function uploadPage(sessionId: string, pageNumber: number, runToken: string): Promise<string> {
    const localPath = path.join(os.tmpdir(), `${sessionId}-${runToken}-page-${pageNumber}.jpg`);
    const storagePath = `${sessionId}/commands/${runToken}/page-${pageNumber}.jpg`;
    try {
        await capturePhoto(localPath);
        const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, fs.readFileSync(localPath), { contentType: 'image/jpeg', upsert: false });
        if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
        return storagePath;
    } finally {
        fs.unlink(localPath, () => { /* best-effort cleanup */ });
    }
}

async function handleCapturePage(sessionId: string, commandSeq: number, runToken: string) {
    const { count, error: countErr } = await supabase
        .from('grading_pages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);
    if (countErr) throw new Error(`Failed to count pages: ${countErr.message}`);
    const pageNumber = (count ?? 0) + 1;
    const storagePath = await uploadPage(sessionId, pageNumber, runToken);
    const { error: insertErr } = await supabase.rpc('commit_grading_page_capture', {
        p_session_id: sessionId,
        p_command_seq: commandSeq,
        p_run_token: runToken,
        p_page_number: pageNumber,
        p_storage_path: storagePath,
    });
    if (insertErr) {
        await removeUploadedPage(storagePath);
        throw new Error(`Failed to commit captured page: ${insertErr.message}`);
    }
    log(`Captured page ${pageNumber} for session ${sessionId} -> ${storagePath}`);
}

async function handleRetakeLast(sessionId: string, commandSeq: number, runToken: string) {
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
        return handleCapturePage(sessionId, commandSeq, runToken);
    }
    const storagePath = await uploadPage(sessionId, lastPage.page_number, runToken);
    const { error: updateErr } = await supabase.rpc('commit_grading_page_retake', {
        p_session_id: sessionId,
        p_command_seq: commandSeq,
        p_run_token: runToken,
        p_page_id: lastPage.id,
        p_storage_path: storagePath,
    });
    if (updateErr) {
        await removeUploadedPage(storagePath);
        throw new Error(`Failed to commit retaken page: ${updateErr.message}`);
    }
    if (lastPage.storage_path !== storagePath) {
        await removeUploadedPage(lastPage.storage_path);
    }
    log(`Retook page ${lastPage.page_number} for session ${sessionId}`);
}

async function handleStartChecking(sessionId: string) {
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

async function handlePause(sessionId: string, commandSeq: number, runToken: string) {
    const { error } = await supabase.rpc('pause_grading_session_command', {
        p_session_id: sessionId,
        p_command_seq: commandSeq,
        p_run_token: runToken,
    });
    if (error) throw error;
    log(`Session ${sessionId} paused`);
}

// Deduplicate commands: the console bumps command_seq for every button press.
const lastSeenSeq = new Map<string, number>();
const commandQueues = new Map<string, Promise<void>>();

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function claimCommand(sessionId: string, commandSeq: number, command: string, runToken: string) {
    let retryCount = 0;
    for (;;) {
        const { data, error } = await supabase.rpc('claim_grading_command', {
            p_session_id: sessionId,
            p_command_seq: commandSeq,
            p_command: command,
            p_run_token: runToken,
        });
        if (error) {
            retryCount += 1;
            if (retryCount === 1 || retryCount % 30 === 0) {
                log(`Command claim retry for session ${sessionId}:`, error.message);
            }
            await delay(1000);
            continue;
        }
        if (data !== 'busy') return String(data);
        await delay(500);
    }
}

async function finishCommand(sessionId: string, commandSeq: number, runToken: string) {
    for (let attempt = 1; attempt <= 120; attempt += 1) {
        const { data, error } = await supabase.rpc('finish_grading_command', {
            p_session_id: sessionId,
            p_command_seq: commandSeq,
            p_run_token: runToken,
        });
        if (!error) {
            if (data !== true) {
                log(`Command lease was already lost for session ${sessionId}; stale writes were fenced.`);
            }
            return;
        }
        if (attempt === 1 || attempt % 30 === 0) {
            log(`Command lease release retry for session ${sessionId}:`, error.message);
        }
        await delay(500);
    }
    log(`Command lease release timed out for session ${sessionId}; it will expire safely.`);
}

async function handleSessionUpdate(session: any) {
    const { id, command, command_seq, status } = session || {};
    if (!id || !command || typeof command_seq !== 'number') return;
    if ((lastSeenSeq.get(id) ?? -1) >= command_seq) return; // already handled

    if (status === 'graded' || status === 'cancelled') {
        lastSeenSeq.set(id, command_seq);
        log(`Ignoring command '${command}' for read-only ${status} session ${id}`);
        return;
    }

    log(`Command '${command}' (seq ${command_seq}) for session ${id}`);
    const runToken = randomUUID();
    let claimStatus: string;
    try {
        claimStatus = await claimCommand(id, command_seq, command, runToken);
    } catch (claimError: any) {
        log(`Could not claim command '${command}' for session ${id}:`, claimError?.message || claimError);
        return;
    }
    if (claimStatus !== 'claimed') {
        lastSeenSeq.set(id, command_seq);
        log(`Command '${command}' (seq ${command_seq}) skipped: ${claimStatus}`);
        return;
    }
    lastSeenSeq.set(id, command_seq);

    try {
        switch (command) {
            case 'capture_page':
                await handleCapturePage(id, command_seq, runToken);
                break;
            case 'retake_last':
                await handleRetakeLast(id, command_seq, runToken);
                break;
            case 'start_checking':
            case 'resume':
                await handleStartChecking(id);
                break;
            case 'pause':
                await handlePause(id, command_seq, runToken);
                break;
            default:
                log(`Unknown command ignored: ${command}`);
        }
    } catch (err: any) {
        const message = String(err?.message || err);
        if (message.includes('already in progress')) {
            log(`Command '${command}' ignored because another grader already owns session ${id}`);
            return;
        }
        log(`Command '${command}' failed for session ${id}:`, message);
        await markFailed(id, command_seq, runToken, message);
    } finally {
        await finishCommand(id, command_seq, runToken);
    }
}

function enqueueSessionUpdate(session: any) {
    const sessionId = session?.id;
    if (!sessionId) return;
    const previous = commandQueues.get(sessionId) || Promise.resolve();
    const next = previous
        .catch((error) => log(`Previous command queue error for session ${sessionId}:`, error))
        .then(() => handleSessionUpdate(session));
    commandQueues.set(sessionId, next);
    void next.finally(() => {
        if (commandQueues.get(sessionId) === next) commandQueues.delete(sessionId);
    }).catch((error) => log(`Command queue error for session ${sessionId}:`, error));
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
            enqueueSessionUpdate(payload.new);
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
