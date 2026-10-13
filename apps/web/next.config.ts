import type { NextConfig } from "next";

// The montage preview plays the render worker's Remotion composition
// (apps/render/src) in the browser. Its imports must resolve to the web app's
// React and Remotion, never to a copy installed under apps/render.
const shared = (name: string) => `../../node_modules/${name}`;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@fauve/agent"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      react: shared("react"),
      "react-dom": shared("react-dom"),
      remotion: shared("remotion"),
    },
  },
};

export default nextConfig;
