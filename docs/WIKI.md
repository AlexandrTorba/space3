# AntigravityChess Wiki

This wiki contains technical documentation and guides for the AntigravityChess platform.

---

## 🏠 Home

Welcome to the **AntigravityChess** Documentation! 

AntigravityChess is a high-performance chess platform designed specifically for hyperbullet time controls and 2v2 Bughouse team play. It leverages modern edge computing and binary protocols to achieve ultra-low latency.

### 🌓 Vision
- **Speed**: Optimized for sub-millisecond reactions. High-frequency updates via WebSockets.
- **Social**: Integrated private video chat for every match for a personalized experience.
- **Fair Play**: Secure, edge-validated game logic using Cloudflare Durable Objects.

---

## 🏗 Architecture

The project is built as a **Turborepo** monorepo:

### 1. `apps/edge-backend`
The heart of the platform. Built on **Cloudflare Workers** using **Durable Objects**.
- **Lobby DO**: Manages global matchmaking and challenge lists.
- **Match DO (Standard)**: Handles single-board logic, clocks, and chess.js integration.
- **Match DO (Bughouse)**: Orchestrates two synchronized boards for 2v2 play, sharing piece banks.
- **REAPER Logic**: Automatically cleans up stale matches from the database if no moves are made for 20 minutes (implemented in `/api/live` lazy cleanup).

### 2. `apps/frontend`
A **Next.js 16** (React 19) application.
- **Responsive Layout**: Tailored for both web and mobile-view players.
- **Visuals**: Framer Motion for buttery-smooth animations and glassmorphism UI.
- **Video**: Integrated Daily.co SDK for peer-to-peer video sessions with token-based auth.

### 3. `packages/contracts`
Shared **Protocol Buffers** definitions.
- Uses binary `proto3` format via `@bufbuild/protobuf` to minimize WebSocket payload size.
- End-to-end type safety between frontend and backend.

### 4. `packages/database`
**Turso (LibSQL)** backend with **Drizzle ORM**.
- Globally distributed database for match history, active game tracking, and metadata.

---

## 🎨 Features & Modes

### ♟️ Standard Chess
Classic 1v1 play with hyperbullet optimizations. 
- Fast time controls: 1m, 3m, or Unlimited.
- Real-time PGN generation and FEN tracking.

### 🐜 Bughouse (2v2 Team Play)
Two boards (Board 0 and Board 1) synced in a single Durable Object.
- **Piece Transfer**: Captured pieces (e.g., White on Board 0) are instantly sent to the partner (Black on Board 1).
- **Drops**: Pieces from your bank can be dropped on empty squares using UCI notation (e.g., `P@e4`).
- **Promotion Handling**: Promoted pieces (Queens, Rooks, etc.) correctly revert to Pawns when captured.
- **Checkmate Sync**: If any board results in a checkmate (unless a drop can save the king), the entire team wins/loses.

### 🎥 Secure Video Chat
- Automatic private room creation using `matchId`.
- Admin-controlled video authorization (On/Off).
- Meeting tokens generated securely by the edge backend.

---

## 🛠 Admin & Maintenance

The platform includes a dedicated **Admin Dashboard** (available at `/admin` with `X-Admin-Secret`):

### Controls:
- **Live Monitoring**: View all current active games stored in Turso/LibSQL.
- **Video Flush**: Instantly delete all active rooms from the Daily.co dashboard.
- **Manual Reap**: Trigger a cleanup of matches that haven't been updated for 20 minutes.
- **Video Toggle**: Enable or disable video chat for a specific Match ID in real-time.

---

## 🚀 Development & Deployment

### Local Setup
1. `npm install`
2. `npm run dev` (Frontend: 3000, Backend: 8787).
3. Ensure `.env` is configured with `TURSO_URL` and `DAILY_API_KEY`.

### Deployment
- **Backend**: `npm run deploy` inside `apps/edge-backend` using Wrangler.
- **Frontend**: Integrated with Cloudflare Pages via GitHub.
- **Database**: Use Drizzle Kit to migrate schemas: `npx drizzle-kit push`.

### Security
- **Protobuf rate limiting**: Sockets are limited to 10 moves/actions per second.
- **Durable Object Alarms**: Automatic memory cleanup and DB persistence when DOs go idle.
