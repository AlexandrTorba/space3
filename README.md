# AntigravityChess ⚡️ [antigravitychess.io](https://antigravitychess.io/)

A high-performance hyperbullet chess platform built with modern technologies for ultra-low latency and smooth gameplay.

## 🚀 Architecture

AntigravityChess is a monorepo consisting of:

- **apps/frontend**: A Next.js 16 application using React 19, Tailwind CSS 4, and Framer Motion for a premium, high-frequency UI. Includes integrated secure video communication.
- **apps/edge-backend**: A high-performance Hono-based backend for Cloudflare Workers, utilizing Durable Objects and WebSocket for real-time game state management. Includes an **Admin Dashboard** for match orchestration.
- **packages/contracts**: Shared Protocol Buffer definitions (using Buf/Connect) for efficient, type-safe communication between frontend and backend.
- **packages/database**: Shared Drizzle/LibSQL schema and client for globally distributed match state and user history.

## ✨ Features

- **Hyperbullet Optimized**: Designed for sub-second moves and extremely fast time controls.
- **Secure Video Chat**: Token-based private video/audio sessions for all match types (Standard & Bughouse).
- **Interactive Chat**: Real-time encrypted text messaging integrated into the video panel.
- **Admin Control Panel**: Advanced management bridge for real-time session control and video authorization.
- **Modern UI**: Dark mode, glassmorphism, and smooth micro-animations.
- **Support for Bughouse**: Full multiplayer support for 2v2 tactical team play.
- **Multi-language**: Support for English, Ukrainian, Spanish, and Turkish.
- **Edge Deployment**: Leverages Cloudflare's global network to minimize latency.
- **Protocol Buffers**: Binary communication for minimal payload size and maximum speed.

## 🛠 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Lucide React.
- **Backend**: Hono, Cloudflare Workers, Durable Objects.
- **Media**: Daily.co Video SDK (React SDK).
- **Database**: Drizzle ORM, Turso (LibSQL).
- **Protocols**: Protobuf (Connect RPC), WebSockets.

## 📦 Getting Started

### Prerequisites
- Node.js (v20+)
- npm

### Installation
```bash
npm install
```

### Development
To run both frontend and backend in development mode:
```bash
npm run dev
```
Wait for the local server to start:
- Frontend: `http://localhost:3000`
- Backend/Admin: `http://localhost:8787/admin`

## 📜 License & Acknowledgments

- **Main License**: This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)** - see the [LICENSE](LICENSE) file for details.
- **Disclaimer**: By using this platform, you agree to our [Disclaimer](DISCLAIMER.md) regarding limited liability and usage at your own risk.
- **Third-Party Components**: For info about Stockfish, Daily.co, piece sets, and other open-source libraries used, see the [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

### ♟️ Stockfish
AntigravityChess uses **Stockfish 16.1 (GPLv3)** for move analysis and bot games. We comply with the GPLv3 license terms by providing access to our source code and and providing appropriate credits in our [Third-Party Notices](THIRD_PARTY_NOTICES.md).

Source code: [github.com/AlexandrTorba/space3](https://github.com/AlexandrTorba/space3)
Stockfish website: [stockfishchess.org](https://stockfishchess.org/)
