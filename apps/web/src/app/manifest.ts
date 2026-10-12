import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mila",
    short_name: "Mila",
    description: "Ton community manager vit dans WhatsApp.",
    start_url: "/mila",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#5B3FD9",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
