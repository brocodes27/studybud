# Notebook Grader Agent

Device agent for the elevenfolks **Notebook Grader Machine**. It runs on the
physical grader box (the machine with the camera pointed at the notebook
stand, e.g. `aryan@grader.local`) and is operated remotely from the web app's
**Grader Console** (`/teacher/grader`).

How it works:

1. The teacher creates a *grading session* in the Grader Console and presses
   **Capture Page** for each notebook/answer-sheet page (flipping pages
   between presses).
2. This agent receives each command over **Supabase Realtime** (no inbound
   networking / port-forwarding needed on the device), photographs the page
   with the attached camera, and uploads it to the `notebook-scans` Storage
   bucket.
3. When the teacher presses **Start Checking** (or **Resume**), the agent
   invokes the `grade-notebook` Edge Function, which OCRs all pages, AI-grades
   them against the (optional) question paper, and appends a `test_results`
   row for the student — visible in the Teacher Class Dashboard, the student's
   own dashboard, and the parent view.

## Prerequisites (on the grader box)

- **Node.js 18+** (`node -v`)
- A camera CLI tool:
  - Linux (USB webcam): `sudo apt-get install -y fswebcam`
  - Raspberry Pi camera module: `libcamera-still` (preinstalled on Raspberry Pi OS)
  - macOS: `brew install imagesnap`

## Deploy to the machine

From your laptop (this repo checked out):

```bash
# 1. Copy the agent to the grader box
scp -r grader-agent aryan@grader.local:~/grader-agent

# 2. SSH in
ssh aryan@grader.local

# 3. Configure
cd ~/grader-agent
cp .env.example .env
nano .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GRADER_DEVICE_ID

# 4. Install deps
npm install

# 5. Test the camera (Linux example)
fswebcam -r 1920x1080 --no-banner /tmp/test.jpg && ls -la /tmp/test.jpg
# macOS: imagesnap -w 1 /tmp/test.jpg
# Raspberry Pi: libcamera-still -n -o /tmp/test.jpg

# 6. Test the agent (Ctrl+C to stop). You should see
#    "✅ Realtime subscribed. Waiting for commands..."
npm start
```

> **Security:** the `.env` contains the Supabase **service-role key** which
> bypasses RLS. Keep the grader box on a trusted network and never commit the
> `.env`.

## Run persistently

### Option A: pm2 (recommended)

```bash
npm install -g pm2
pm2 start npm --name grader-agent -- start
pm2 save
pm2 startup   # follow the printed instructions to enable boot startup
pm2 logs grader-agent
```

### Option B: systemd

Create `/etc/systemd/system/grader-agent.service`:

```ini
[Unit]
Description=elevenfolks Notebook Grader Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=aryan
WorkingDirectory=/home/aryan/grader-agent
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now grader-agent
journalctl -u grader-agent -f
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key (Dashboard → Settings → API) |
| `GRADER_DEVICE_ID` | — | Device identifier, default `grader-local-1`. Must match the Device ID used in the Grader Console. |
| `CAPTURE_CMD` | — | Camera command template with `{out}` placeholder. Defaults: `fswebcam ...` (Linux) / `imagesnap ...` (macOS). |

## Troubleshooting

- **No commands arriving:** confirm the `GRADER_DEVICE_ID` in `.env` matches
  the Device ID in the Grader Console, and that the migration added
  `grading_sessions` to the `supabase_realtime` publication.
- **Capture fails:** run the camera command manually (step 5 above); adjust
  `CAPTURE_CMD` (e.g. add `-d /dev/video1` for fswebcam).
- **Grading fails:** check the session's `error_message` in the console, and
  the `grade-notebook` function logs (`npx supabase functions logs grade-notebook`).
