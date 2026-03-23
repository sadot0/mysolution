#!/bin/bash
set -e

SERVER_IP="${1:-YOUR_SERVER_IP}"
DOMAIN="mysolution.uz"
APP_DIR="/var/www/mysolution"

echo "═══════════════════════════════════════"
echo "  Deploying SOLUTION to ${DOMAIN}"
echo "═══════════════════════════════════════"

# Build frontend
echo "→ Building frontend..."
cd "$(dirname "$0")/../frontend"
npm run build

# Upload files
echo "→ Uploading to server..."
rsync -avz --delete dist/ root@${SERVER_IP}:${APP_DIR}/frontend/
rsync -avz --delete ../landing/index.html ../landing/logo-icon.svg ../landing/logo-full.svg root@${SERVER_IP}:${APP_DIR}/landing/
rsync -avz --exclude=node_modules --exclude=.env ../backend/ root@${SERVER_IP}:${APP_DIR}/backend/

# Install deps and start on server
echo "→ Installing dependencies and starting..."
ssh root@${SERVER_IP} << 'REMOTE'
cd /var/www/mysolution/backend
npm install --production

# Create PM2 ecosystem
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'mysolution-api',
    script: 'node_modules/.bin/tsx',
    args: 'src/index.ts',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    error_file: '/var/log/mysolution/error.log',
    out_file: '/var/log/mysolution/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
EOF

mkdir -p /var/log/mysolution

# Start/restart the app
pm2 startOrRestart ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

REMOTE

# Setup nginx
echo "→ Configuring Nginx..."
scp "$(dirname "$0")/nginx.conf" root@${SERVER_IP}:/etc/nginx/sites-available/mysolution
ssh root@${SERVER_IP} << 'REMOTE2'
ln -sf /etc/nginx/sites-available/mysolution /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
REMOTE2

echo ""
echo "═══════════════════════════════════════"
echo "  ✓ Deployed successfully!"
echo "  → http://${DOMAIN}"
echo "═══════════════════════════════════════"
echo ""
echo "To setup SSL, run on server:"
echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
