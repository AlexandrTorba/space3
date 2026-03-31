import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**"
  ]),
  {
    rules: {
      // Many external APIs (react-chessboard v5, protobuf, chess.js callbacks) have no
      // TypeScript definitions - 'any' is unavoidable. Downgrade from error to warn.
      "@typescript-eslint/no-explicit-any": "warn",

      // Apostrophes in JSX text (e.g. "don't", "it's") are safe - no XSS risk.
      // React itself handles this correctly. Turning off to reduce noise.
      "react/no-unescaped-entities": "off",

      // next/image is preferable but <img> is acceptable for chess piece SVGs
      // loaded from external CDNs where Next.js Image optimization wouldn't apply.
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
