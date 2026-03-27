#!/bin/bash

# AntigravityChess Deployment Script 🚀

echo "📦 Starting deployment sequence..."

# 1. Backend Deployment (Cloudflare Workers)
echo "📡 Deploying Edge Backend..."
cd apps/edge-backend
npm run deploy
cd ../..

# 2. Frontend Build (Vercel/Manual)
# Note: Next.js is typically auto-deployed via Git on Vercel or similar.
# If you are using Cloudflare Pages, you might want to run 'wrangler pages deploy' here.
echo "🎨 Building Frontend..."
npm run build -w apps/frontend

echo "✅ Deployment sequence complete!"
