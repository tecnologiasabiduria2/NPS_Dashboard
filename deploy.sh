#!/bin/bash
set -e

SERVER="root@142.93.7.13"
REMOTE_PATH="/var/www/ventra-platform"

echo "▶ Building..."
npm run build

echo "▶ Uploading..."
rsync -avz --delete .next/standalone/ $SERVER:$REMOTE_PATH/
rsync -avz --delete .next/static/     $SERVER:$REMOTE_PATH/.next/static/
rsync -avz --delete public/           $SERVER:$REMOTE_PATH/public/

echo "▶ Uploading .env.production (si existe)..."
[ -f .env.production ] && scp .env.production $SERVER:$REMOTE_PATH/.env.local

echo "▶ Restarting..."
ssh $SERVER "cd $REMOTE_PATH && PORT=3001 NODE_ENV=production pm2 restart ventra-platform 2>/dev/null || PORT=3001 NODE_ENV=production pm2 start server.js --name ventra-platform && pm2 save"

echo "✅ Deploy completo — https://vip.sabiduriaempresarial.com"
