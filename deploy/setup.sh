#!/bin/bash
set -e

echo "═══════════════════════════════════════"
echo "  SOLUTION - Server Setup Script"
echo "═══════════════════════════════════════"

# Update system
apt update && apt upgrade -y

# Install essentials
apt install -y curl git nginx certbot python3-certbot-nginx ufw

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Create app directory
mkdir -p /var/www/mysolution/{landing,frontend,backend}
mkdir -p /var/www/certbot

# Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo "✓ System packages installed"
echo "✓ Node.js $(node -v)"
echo "✓ NPM $(npm -v)"
echo "✓ PM2 installed"
echo "✓ Nginx installed"
echo "✓ Firewall configured"
echo ""
echo "Next: run deploy.sh to deploy the app"
