import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Admin Client (for reliable updates)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env. Need at least SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

console.log("Supabase Admin Client initialized for:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 3001;

const server = http.createServer(async (req, res) => {
    // 1. Core CORS Setup - Always applied to every response
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');

    // 2. Immediate Preflight Handling
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // 3. URL Normalization
    // Handle cases where the app might send /api/generate/videos/... or /videos/...
    let urlPath = req.url || '';
    if (urlPath.startsWith('/api/generate/')) {
        urlPath = urlPath.replace('/api/generate', '');
    }
    // Remove query params for path matching
    const cleanPath = urlPath.split('?')[0];

    // 4. Response Helpers
    const sendJson = (status: number, data: any) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    // 5. Static Video Serving
    if (req.method === 'GET' && cleanPath.startsWith('/videos/')) {
        const filePath = path.join(__dirname, '..', 'public', cleanPath);

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.vtt' ? 'text/vtt' : 'application/octet-stream';

            // Support Range requests for video seeking
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(filePath, { start, end });

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                });
                file.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': stat.size,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(filePath).pipe(res);
            }
            return;
        } else {
            console.warn(`File not found: ${filePath}`);
            sendJson(404, { error: 'Video file not found' });
            return;
        }
    }

    // 6. API Endpoints
    // Ping check
    if (req.method === 'GET' && cleanPath === '/api/generate') {
        sendJson(200, { status: 'online', message: 'ElevenFolks Video Engine is ready' });
        return;
    }

    // Generation Request
    if (req.method === 'POST' && cleanPath === '/api/generate') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { topic, userId, script } = JSON.parse(body);

                if (!topic || !userId) {
                    console.log(`Rejecting request: Missing topic or userId`);
                    sendJson(400, { error: 'Missing topic or userId' });
                    return;
                }

                console.log(`Received generation request for: ${topic}`);

                // 1. Create DB Record
                const { data, error } = await supabase
                    .from('video_generations')
                    .insert({
                        user_id: userId,
                        topic: topic,
                        script: script || null,
                        status: 'pending',
                        progress: 0,
                        logs: [{ time: new Date().toISOString(), msg: 'Request received by server' }]
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('DB Error:', error);
                    sendJson(500, { error: error.message });
                    return;
                }

                const generationId = data.id;

                // 2. Spawn Worker
                const scriptPath = path.join(__dirname, 'generate-manim-video.ts');
                const child = spawn('node', [
                    '--import', 'tsx',
                    scriptPath,
                    topic,
                    script || '',
                    `--generation-id=${generationId}`
                ], {
                    cwd: path.join(__dirname, '..'),
                    detached: true,
                    stdio: 'inherit',
                    env: { ...process.env, NODE_OPTIONS: '--no-warnings' }
                });

                child.unref();
                sendJson(200, { success: true, generationId });

            } catch (e) {
                console.error('Server Error:', e);
                sendJson(500, { error: 'Invalid JSON or Internal Server Error' });
            }
        });
    } else {
        // Fallback for unmatched routes
        sendJson(404, { error: 'Endpoint not found', path: cleanPath });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Video Generation Server running on http://0.0.0.0:${PORT}`);
});
