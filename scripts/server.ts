import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // CORS Helper
    const setCors = (status = 0) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
        if (status) res.writeHead(status);
    };

    // Response Helper
    const sendJson = (status: number, data: any) => {
        setCors();
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    };

    if (req.method === 'OPTIONS') {
        setCors(204);
        res.end();
        return;
    }

    // Ping check for Cloudflare/Uptime
    if (req.method === 'GET' && req.url === '/api/generate') {
        sendJson(200, { status: 'online' });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
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
                const child = spawn('npx', ['tsx', scriptPath, topic, script || '', `--generation-id=${generationId}`], {
                    cwd: path.join(__dirname, '..'),
                    shell: true,
                    detached: true,
                    stdio: 'inherit' // Change to inherit to see logs in docker
                });

                child.unref();

                sendJson(200, { success: true, generationId });

            } catch (e) {
                console.error('Server Error:', e);
                sendJson(500, { error: 'Internal Server Error' });
            }
        });
    } else {
        sendJson(404, { error: 'Not Found' });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Video Generation Server running on http://0.0.0.0:${PORT}`);
});
