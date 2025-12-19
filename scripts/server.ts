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
    // CORS headers - Be explicit for production
    res.setHeader('Access-Control-Allow-Origin', 'https://elevenfolks.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': 'https://elevenfolks.com',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization'
        });
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
                const { topic, userId, script } = JSON.parse(body);

                if (!topic || !userId) {
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
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Video Generation Server running on http://localhost:${PORT}`);
});
