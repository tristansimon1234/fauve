import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edith",
    short_name: "Edith",
    description: "Ton community manager vit dans WhatsApp.",
    start_url: "/fauve",
    display: "standalone",
    background_color: "#F5F2EC",
    theme_color: "#F5F2EC",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
