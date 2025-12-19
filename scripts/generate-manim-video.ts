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

async function logToDB(msg: string, progress: number = -1, status: string | null = null, urls: { video?: string, sub?: string } | null = null) {
    console.log(`[DB LOG] ${msg}`); // Always log to console
    if (!supabase || !generationId) return;

    try {
        const update: any = {
            current_step: msg,
            updated_at: new Date().toISOString()
        };

        if (progress >= 0) update.progress = progress;
        if (status) update.status = status;
        if (urls?.video) update.video_url = urls.video;
        if (urls?.sub) update.subtitle_url = urls.sub;

        // Fetch current logs to append
        const { data } = await supabase.from('video_generations').select('logs').eq('id', generationId).single();
        const currentLogs = data?.logs || [];
        currentLogs.push({ time: new Date().toLocaleTimeString(), msg });
        update.logs = currentLogs;

        await supabase.from('video_generations').update(update).eq('id', generationId);
    } catch (e) {
        console.error("Failed to log to DB:", e);
    }
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
    const jobId = generationId || `job_${Date.now()}`;
    const jobDir = path.join(ENGINE_DIR, 'jobs', jobId);

    try {
        await logToDB(`Starting generation for: ${topic}`, 5, 'processing');
        await logToDB("Preparing your personal study material...");

        // Create isolated directory
        if (!fs.existsSync(path.join(ENGINE_DIR, 'jobs'))) fs.mkdirSync(path.join(ENGINE_DIR, 'jobs'));
        if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

        // Temp files within jobDir
        const inputScriptPath = path.join(jobDir, 'input_script.txt');
        fs.writeFileSync(inputScriptPath, scriptText, 'utf-8');

        // 1. Script & Code
        await logToDB("AI Mentor: Drafting the lesson script...", 20);
        await logToDB("Structuring key concepts and visual blueprints...");

        // Pass jobDir to generator
        await runPythonScript('generator.py', [`"${topic}"`, inputScriptPath, jobDir]);

        const scenePath = path.join(jobDir, 'scene.py');
        if (!fs.existsSync(scenePath)) throw new Error("Failed to generate scene.py code.");

        const narrationPath = path.join(jobDir, 'narration.txt');
        const audioPath = path.join(jobDir, 'narration.mp3');

        if (!fs.existsSync(narrationPath) || !fs.existsSync(audioPath)) {
            throw new Error("Missing audio/narration files.");
        }

        // 2. Render
        await logToDB("Visualizing concepts into 3D animations...", 40);
        await logToDB("Crafting high-fidelity diagrams and motion graphics...");

        // Update renderer to take jobDir
        await runPythonScript('renderer.py', [scenePath, 'l', jobDir]);

        // Find video - it will be inside jobDir/media
        const videoDir = path.join(jobDir, 'media', 'videos', 'scene', '480p15');
        if (!fs.existsSync(videoDir)) throw new Error(`Render failed: ${videoDir} not found.`);

        const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.mp4'))
            .map(f => ({ name: f, time: fs.statSync(path.join(videoDir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length === 0) throw new Error("No rendered MP4 found.");
        const silentVideoPath = path.join(videoDir, files[0].name);

        // 3. Subtitles
        await logToDB("Generating precision subtitles...", 75);
        await logToDB("Syncing visual cues with narration...");
        const srtPath = path.join(jobDir, 'subtitles.srt');
        await runPythonScript('alignment.py', [narrationPath, audioPath, srtPath]);

        // 4. Merge
        await logToDB("Compositing the final masterpiece...", 90);
        await logToDB("Polishing audio-visual synchronization...");
        const finalVideoPath = path.join(jobDir, 'final_output.mp4');
        if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);

        await runCommand('ffmpeg', [
            '-i', silentVideoPath, '-i', audioPath,
            '-c:v', 'copy', '-c:a', 'aac',
            '-map', '0:v:0', '-map', '1:a:0', '-y', finalVideoPath
        ]);

        // 5. Upload / Save
        await logToDB("Delivering your premium lesson...", 95);
        await logToDB("Optimizing for mobile playback...");

        const videoUrl = await uploadToStorage(finalVideoPath, 'video/mp4');
        const subUrl = await uploadToStorage(srtPath.replace('.srt', '.vtt'), 'text/vtt'); // Upload VTT

        const slug = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const localVideoName = `${slug}.mp4`;

        // Ensure local persistence for server static delivery fallback
        const destDir = path.join(__dirname, '..', 'public', 'videos');
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(finalVideoPath, path.join(destDir, localVideoName));
        fs.copyFileSync(srtPath.replace('.srt', '.vtt'), path.join(destDir, `${slug}.vtt`));

        await logToDB("Process Complete", 100, 'completed', {
            video: videoUrl || `/videos/${localVideoName}`,
            sub: subUrl || `/videos/${slug}.vtt`
        });

        if (supabase && generationId) {
            // Get user_id for notification
            const { data: genData } = await supabase.from('video_generations').select('user_id').eq('id', generationId).single();

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

        // Cleanup isolated job directory after success
        if (fs.existsSync(jobDir)) {
            console.log(`Cleaning up isolated job directory: ${jobDir}`);
            fs.rmSync(jobDir, { recursive: true, force: true });
        }

    } catch (error: any) {
        console.error('Generation Failed:', error);
        await logToDB(`Failed: ${error.message}`, -1, 'failed');
        await logToDB(`Critical Error: ${error.message}`);
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

