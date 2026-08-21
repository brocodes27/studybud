#!/bin/bash
# Install script for grader-agent systemd service on aryan@grader.local

# Ensure the script is run as root (or via sudo)
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo:"
  echo "sudo ./install_service.sh"
  exit 1
fi

# Detect calling user and directory
CALLING_USER=${SUDO_USER:-$(whoami)}
CALLING_USER_HOME=$(eval echo "~$CALLING_USER")
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Resolve Node.js and npm paths supporting standard paths and NVM
NODE_PATH=$(runuser -l "$CALLING_USER" -c "which node" 2>/dev/null)
NPM_PATH=$(runuser -l "$CALLING_USER" -c "which npm" 2>/dev/null)

if [ -z "$NODE_PATH" ]; then
  NODE_PATH=$(which node 2>/dev/null)
fi
if [ -z "$NPM_PATH" ]; then
  NPM_PATH=$(which npm 2>/dev/null)
fi

if [ -z "$NODE_PATH" ] || [ -z "$NPM_PATH" ]; then
  echo "Error: Node.js or npm could not be located. Please make sure they are installed in $CALLING_USER's environment."
  exit 1
fi

echo "Detected Configuration:"
echo "  User: $CALLING_USER"
echo "  Home: $CALLING_USER_HOME"
echo "  Directory: $DIR"
echo "  Node.js: $NODE_PATH"
echo "  npm: $NPM_PATH"

SERVICE_FILE="/etc/systemd/system/grader-agent.service"

echo "Generating systemd service file at $SERVICE_FILE..."
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Notebook Grader Machine Device Agent
After=network.target

[Service]
Type=simple
User=$CALLING_USER
WorkingDirectory=$DIR
ExecStart=$NODE_PATH $DIR/node_modules/.bin/tsx $DIR/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload daemon
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable service
echo "Enabling grader-agent service to start on boot..."
systemctl enable grader-agent.service

# Restart service
echo "Starting grader-agent service..."
systemctl restart grader-agent.service

echo "--------------------------------------------------------"
echo "Installation complete!"
echo "Check service status using:"
echo "  sudo systemctl status grader-agent"
echo "Check service logs using:"
echo "  sudo journalctl -u grader-agent -f"
echo "--------------------------------------------------------"
