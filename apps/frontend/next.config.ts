import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  transpilePackages: ["react-chessboard", "@dnd-kit/core", "@dnd-kit/modifiers"],
};

export default nextConfig;
