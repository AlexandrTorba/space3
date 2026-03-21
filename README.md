# AntigravityChess ⚡️

A high-performance hyperbullet chess platform built with modern technologies for ultra-low latency and smooth gameplay.

## 🚀 Architecture

AntigravityChess is a monorepo consisting of:

- **apps/frontend**: A Next.js 16 application using React 19, Tailwind CSS 4, and Framer Motion for a premium, high-frequency UI.
- **apps/edge-backend**: A high-performance Hono-based backend designed for Cloudflare Workers, utilizing Durable Objects and WebSocket for real-time game state management.
- **packages/contracts**: Shared Protocol Buffer definitions (using Buf/Connect) for efficient, type-safe communication between frontend and backend.

## ✨ Features

- **Hyperbullet Optimized**: Designed for sub-second moves and extremely fast time controls.
- **Modern UI**: Dark mode, glassmorphism, and smooth micro-animations.
- **Customizable**: Built-in settings for board themes, piece sets, and backgrounds.
- **Multi-language**: Support for English, Ukrainian, Spanish, and Turkish.
- **Edge Deployment**: Leverages Cloudflare's global network to minimize latency.
- **Protocol Buffers**: Binary communication for minimal payload size and maximum speed.

## 🛠 Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Lucide React.
- **Backend**: Hono, Cloudflare Workers, Durable Objects.
- **Database**: Drizzle ORM (Postgres/Cloudflare D1).
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

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)** - see the [LICENSE](LICENSE) file for details.
