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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

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

    if (req.method === 'OPTIONS') {
        setCors(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            setCors();
            res.setHeader('Content-Type', 'application/json');
            try {
                const { topic, userId, script } = JSON.parse(body);

                if (!topic || !userId) {
                    console.log(`Rejecting request: Missing topic (${topic}) or userId (${userId})`);
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Missing topic or userId' }));
                    return;
                }

                console.log(`Received request for: ${topic}`);

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
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                    return;
                }

                const generationId = data.id;

                // 2. Spawn Worker
                // We run the matching TS script using 'tsx'
                const scriptPath = path.join(__dirname, 'generate-manim-video.ts');
                const child = spawn('npx', ['tsx', scriptPath, `"${topic}"`, `"${script || ''}"`, `--generation-id=${generationId}`], {
                    cwd: path.join(__dirname, '..'), // Run from project root
                    shell: true,
                    detached: true, // Let it run independently
                    stdio: 'ignore' // We don't need to pipe output, it logs to DB
                });

                child.unref();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, generationId }));

            } catch (e) {
                console.error('Server Error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
        });
    } else {
        setCors(404);
        console.log(`404 Not Found: ${req.method} ${req.url}`);
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Video Generation Server running on http://0.0.0.0:${PORT}`);
});
