---
description: How to deploy the Manim Video Generation Server to a Hostinger VPS
---

# Deploying Video Generation Server to Hostinger VPS

This guide outlines the steps to deploy your Dockerized video generation backend to a Hostinger Virtual Private Server (VPS).

## Prerequisites
1.  **Hostinger VPS Plan**: You need a VPS (Ubuntu 22.04 or 24.04 recommended). "Shared Hosting" will **not** work.
2.  **SSH Client**: Terminal on Mac/Linux or PowerShell/PuTTY on Windows.
3.  **Git Repo**: Your code must be pushed to GitHub/GitLab.

## Step 1: Prepare the Server
Connect to your VPS:
```bash
ssh root@<YOUR_VPS_IP_ADDRESS>
# Enter password when prompted
```

### Install Docker & Docker Compose
Run the following commands on the server:
```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify Docker installation
docker --version
docker compose version
```

## Step 2: Deploy the Code

### Clone Your Repository
```bash
# Install git if missing
apt-get install -y git

# Clone your project (replace with your repo URL)
git clone https://github.com/YOUR_USERNAME/studybud.git
cd studybud
```
*(If it's a private repo, you may need to set up an SSH key or use a Personal Access Token).*

### Configure Environment variables
Create the production `.env` file:
```bash
nano .env
```
Paste your production secrets:
```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-DO-NOT-SHARE
VITE_OPENAI_API_KEY=sk-your-openai-key
```
Press `Ctrl+X`, then `Y`, then `Enter` to save.

## Step 3: Run the Server
Launch the application using Docker Compose:
```bash
docker compose up -d --build
```
- `-d`: Runs in "detached" mode (background).
- `--build`: Forces a build of the Docker image.

**Verify it's running:**
```bash
docker compose ps
# You should see 'video-gen-server' with Status 'Up'
```

## Step 4: Expose to the Internet (Setup Nginx & HTTPS)
By default, the server is on port `3001` (HTTP). To access it securely from your frontend (HTTPS), set up a Reverse Proxy.

### Install Nginx
```bash
apt-get install -y nginx
```

### Configure Nginx
Create a config file:
```bash
nano /etc/nginx/sites-available/videogen
```
Paste this configuration (replace `videogen.yourdomain.com` with your actual domain or VPS IP):
```nginx
server {
    listen 80;
    server_name videogen.yourdomain.com; # OR use your VPS IP if no domain

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for long-running video requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```
Save and exit.

### Enable the Site
```bash
ln -s /etc/nginx/sites-available/videogen /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Optional: disable default if getting conflicts
nginx -t # Test configuration
systemctl restart nginx
```

### (Optional) Enable HTTPS with Certbot
If you have a domain pointing to the VPS IP:
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d videogen.yourdomain.com
```

## Step 5: Connect Frontend
Update your Frontend `VideoLessons.tsx` (the API URL):
1.  Change `http://localhost:3001` to your new VPS address: `https://videogen.yourdomain.com` or `http://<VPS_IP>`.
2.  Re-deploy your frontend.

## Maintenance
- **View Logs**: `docker compose logs -f`
- **Update Code**: 
  ```bash
  git pull
  docker compose up -d --build
  ```
