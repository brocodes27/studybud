# Use the official Manim Community image as the base
# It comes with Python, Manim, LaTeX, and FFmpeg pre-installed
FROM manimcommunity/manim:v0.18.0

# Switch to root to install Node.js
USER root

# Install Node.js (Version 20)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install Node dependencies
# We omit dev dependencies to save space and time on the VPS
# We only need the runtime scripts (tsx, typescript, supabase, etc)
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retries 5 && \
    npm ci --omit=dev

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 3001

# Start the generation server
CMD ["npm", "run", "serve-gen"]
