import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENGINE_DIR = path.join(__dirname, '..', 'manim_engine');

// Setup Supabase (Optional, only used if generation-id supplied)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabase: any = null;
let generationId: string | null = null;

// Parse Args
const args = process.argv.slice(2);
const topicArg = args[0] && !args[0].startsWith('--') ? args[0] : 'Photosynthesis';
const scriptArg = args[1] && !args[1].startsWith('--') ? args[1] : null;

// Look for flags
const genIdFlag = args.find(a => a.startsWith('--generation-id='));
if (genIdFlag) {
    generationId = genIdFlag.split('=')[1];
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
}

async function logToDB(msg: string, progress: number = -1, status: string | null = null) {
    console.log(msg); // Always log to console
    if (!supabase || !generationId) return;

    try {
        const update: any = {
            // Append log to array using Postgres operator check? No, Supabase JS simple access
            // We'll read-modify-write or just assume simple usage for now. 
            // Better: use rpc or just append locally and update? 
            // For simplicity/reliability in this script, we'll just push a log entry.
            // Actually, simplified: Just update status/progress. Logs might be heavy to simple-update repeatedly.
            // Let's just update 'current_step' and 'progress'.
            current_step: msg,
            updated_at: new Date().toISOString()
        };

        if (progress >= 0) update.progress = progress;
        if (status) update.status = status;

        // Append to logs JSONB
        // We can use a raw SQL query or just fetch-update. Fetch-update is safer for JS client.
        // But for speed, we'll just update fields.

        await supabase.from('video_generations').update(update).eq('id', generationId);

        // Separate call to append log to match desired "timeline" feature
        const logEntry = { time: new Date().toISOString(), msg };
        // Postgrest append to array is tricky without RPC. We'll skip atomic append and just overwrite? 
        // No, that's race-condition prone.
        // We will just assume this is single-threaded enough or use a simple RPC if distinct.
        // Actually, let's just create a log entry in a separate logs table? 
        // No, the user asked for logs in the JSON column.
        // We'll skip writing *every* log to DB to save requests, only major steps.
    } catch (e) {
        console.error("Failed to log to DB:", e);
    }
}

// Helper to append log item
async function logEntryDb(msg: string) {
    if (!supabase || !generationId) return;
    try {
        // Fetch current logs
        const { data } = await supabase.from('video_generations').select('logs').eq('id', generationId).single();
        const currentLogs = data?.logs || [];
        currentLogs.push({ time: new Date().toLocaleTimeString(), msg });
        await supabase.from('video_generations').update({ logs: currentLogs }).eq('id', generationId);
    } catch (e) { /* ignore */ }
}


// ... [Helper functions getEnhancedEnv, runPythonScript, findFFmpegOnWindows remain unchanged, simpler to inline them or rely on previous structure. 
// Since I am rewriting the file, I must include them.]

function getEnhancedEnv() {
    const env = { ...process.env };
    if (process.platform === 'win32') {
        const potentialPaths = [
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
            'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
            'C:\\texlive\\2023\\bin\\windows',
            'C:\\texlive\\2024\\bin\\windows',
        ];
        const validPaths = potentialPaths.filter(p => fs.existsSync(p));
        if (validPaths.length > 0) {
            const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'Path';
            env[pathKey] = `${validPaths.join(';')};${env[pathKey]}`;
        }
        env.PYTHONIOENCODING = 'utf-8';
    }
    return env;
}

async function runPythonScript(scriptName: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        let pythonArgs = [path.join(ENGINE_DIR, scriptName), ...args];

        if (process.platform === 'win32') {
            pythonCmd = 'py';
            pythonArgs = ['-3.12', path.join(ENGINE_DIR, scriptName), ...args];
        }

        const child = spawn(pythonCmd, pythonArgs, {
            env: getEnhancedEnv(),
            cwd: ENGINE_DIR,
            shell: process.platform === 'win32'
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const str = data.toString();
            stdout += str;
            process.stdout.write(str); // Forward to console
        });
        child.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            process.stderr.write(str); // Forward to console
        });

        child.on('error', (err) => reject(new Error(`Failed to start Python script ${scriptName}: ${err.message}`)));

        child.on('close', (code) => {
            if (code !== 0) {
                const combinedOutput = `Stdout: ${stdout}\nStderr: ${stderr}`;
                reject(new Error(`Python script ${scriptName} failed with code ${code}\n${combinedOutput}`));
            } else {
                resolve(stdout);
            }
        });
    });
}

async function findFFmpegOnWindows(): Promise<string | null> {
    try {
        const localAppData = process.env.LOCALAPPDATA || '';
        const wingetPath = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
        if (!fs.existsSync(wingetPath)) return null;
        const packages = fs.readdirSync(wingetPath);
        for (const pkg of packages) {
            if (pkg.includes('FFmpeg')) {
                const pkgPath = path.join(wingetPath, pkg);
                // Simple recursive search 2 levels deep
                const findInDir = (dir: string, depth: number): string | null => {
                    if (depth > 3) return null;
                    try {
                        const files = fs.readdirSync(dir);
                        if (files.includes('ffmpeg.exe')) return path.join(dir, 'ffmpeg.exe');
                        for (const f of files) {
                            const full = path.join(dir, f);
                            if (fs.statSync(full).isDirectory()) {
                                const found = findInDir(full, depth + 1);
                                if (found) return found;
                            }
                        }
                    } catch (e) { }
                    return null;
                };
                const found = findInDir(pkgPath, 0);
                if (found) return found;
            }
        }
    } catch (e) { }
    return null;
}

async function runCommand(command: string, args: string[]): Promise<string> {
    return new Promise(async (resolve, reject) => {
        let cmd = command;
        if (process.platform === 'win32' && command === 'ffmpeg') {
            const found = await findFFmpegOnWindows();
            if (found) {
                cmd = found;
                console.log(`Using auto-located ffmpeg: ${cmd}`);
            }
        }
        const child = spawn(cmd, args, {
            env: getEnhancedEnv(),
            cwd: ENGINE_DIR,
            shell: process.platform === 'win32'
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => stdout += d.toString());
        child.stderr.on('data', (d) => stderr += d.toString());
        child.on('error', (e) => reject(e));
        child.on('close', (code) => {
            if (code !== 0) reject(new Error(`Command ${command} failed code ${code}\n${stderr}`));
            else resolve(stdout);
        });
    });
}

async function uploadToStorage(filePath: string, contentType: string): Promise<string | null> {
    if (!supabase || !generationId) return null;
    try {
        const fileName = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        const { data, error } = await supabase.storage
            .from('videos')
            .upload(`${generationId}/${fileName}`, fileBuffer, {
                contentType,
                upsert: true
            });

        if (error) {
            console.error("Upload error:", error);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(`${generationId}/${fileName}`);

        return publicUrl;
    } catch (e) {
        console.error("Storage upload failed:", e);
        return null;
    }
}

async function generateVideo(topic: string, scriptText: string) {
    try {
        await logToDB(`Starting generation for: ${topic}`, 5, 'processing');
        await logEntryDb("Initializing Manim Engine and AI Agents...");

        // Temp file
        const inputScriptPath = path.join(ENGINE_DIR, 'input_script.txt');
        fs.writeFileSync(inputScriptPath, scriptText, 'utf-8');

        // Cleanup
        const scenePath = path.join(ENGINE_DIR, 'scene.py');
        if (fs.existsSync(scenePath)) fs.unlinkSync(scenePath);
        if (fs.existsSync(path.join(ENGINE_DIR, 'media'))) fs.rmSync(path.join(ENGINE_DIR, 'media'), { recursive: true, force: true });

        // 1. Script & Code
        await logToDB("AI Agent: Generating script and Manim code...", 20);
        await logEntryDb("Prompting OpenAI GPT-4o for educational content...");
        await runPythonScript('generator.py', [`"${topic}"`, inputScriptPath]);

        if (!fs.existsSync(scenePath)) throw new Error("Failed to generate scene.py code.");

        const narrationPath = path.join(ENGINE_DIR, 'narration.txt');
        const audioPath = path.join(ENGINE_DIR, 'narration.mp3');

        if (!fs.existsSync(narrationPath) || !fs.existsSync(audioPath)) {
            throw new Error("Missing audio/narration files.");
        }

        // 2. Render
        await logToDB("Manim Engine: Rendering video scenes...", 40);
        await logEntryDb("Starting Python renderer (480p15)... this may take a few minutes.");

        await runPythonScript('renderer.py', ['scene.py', 'l']);

        // Find video
        const videoDir = path.join(ENGINE_DIR, 'media', 'videos', 'scene', '480p15');
        const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.mp4'))
            .map(f => ({ name: f, time: fs.statSync(path.join(videoDir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length === 0) throw new Error("No rendered MP4 found.");
        const silentVideoPath = path.join(videoDir, files[0].name);

        // 3. Subtitles
        await logToDB("Aligning subtitles...", 75);
        await logEntryDb("Calculating word-level timestamps using audio analysis...");
        const srtPath = path.join(ENGINE_DIR, 'subtitles.srt');
        await runPythonScript('alignment.py', [narrationPath, audioPath, srtPath]);

        // 4. Merge
        await logToDB("Merging audio and video...", 90);
        await logEntryDb("FFmpeg: Stitching video stream with audio track...");
        const finalVideoPath = path.join(ENGINE_DIR, 'final_output.mp4');
        if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);

        await runCommand('ffmpeg', [
            '-i', silentVideoPath, '-i', audioPath,
            '-c:v', 'copy', '-c:a', 'aac',
            '-map', '0:v:0', '-map', '1:a:0', '-y', finalVideoPath
        ]);

        // 5. Upload / Save
        await logToDB("Finalizing and Uploading...", 95);
        await logEntryDb("Uploading assets to Supabase Storage...");

        const videoUrl = await uploadToStorage(finalVideoPath, 'video/mp4');
        const subUrl = await uploadToStorage(srtPath.replace('.srt', '.vtt'), 'text/vtt'); // Upload VTT

        // Also save locally just in case
        const slug = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const destDir = path.join(__dirname, '..', 'public', 'videos');
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        // Copy to public for local dev viewing immediately
        const localVideoName = `${slug}.mp4`;
        fs.copyFileSync(finalVideoPath, path.join(destDir, localVideoName));
        fs.copyFileSync(srtPath.replace('.srt', '.vtt'), path.join(destDir, `${slug}.vtt`));

        await logToDB("Process Complete", 100, 'completed');
        await logEntryDb("Video ready for playback.");

        if (supabase && generationId) {
            // Get user_id for notification
            const { data: genData } = await supabase.from('video_generations').select('user_id').eq('id', generationId).single();

            await supabase.from('video_generations').update({
                video_url: videoUrl || `/videos/${localVideoName}`,
                subtitle_url: subUrl || `/videos/${slug}.vtt`
            }).eq('id', generationId);

            if (genData?.user_id) {
                await supabase.from('notifications').insert({
                    user_id: genData.user_id,
                    type: 'system',
                    title: '🎬 Video Ready!',
                    message: `Your premium video lesson for "${topic}" is ready.`,
                    priority: 'medium',
                    is_read: false
                });
            }
        }

        console.log("Generation Success!");

    } catch (error: any) {
        console.error('Generation Failed:', error);
        await logToDB(`Failed: ${error.message}`, -1, 'failed');
        await logEntryDb(`Critical Error: ${error.message}`);
    }
}

async function main() {
    let topic = topicArg;
    let script = scriptArg;

    if (!script) {
        await logToDB(`Generating script for: ${topic}`, 10);
        // AI Script Generation logic here using runPythonScript...
        // For brevity in rewrite using existing logic:
        try {
            script = await runPythonScript('script_generator.py', [`"${topic}"`]);
            script = script.trim();
        } catch (e) {
            script = "Error generating script.";
        }
    }

    await generateVideo(topic, script);
}

main();

