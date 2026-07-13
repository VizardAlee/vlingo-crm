import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    categories: ["business", "productivity"],
    description: "Secure CRM and operations platform for Vlingo Systems Nig. Ltd.",
    display: "standalone",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        purpose: "maskable",
        src: "/icons/maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    id: "/",
    name: "Vlingo Systems CRM",
    orientation: "portrait-primary",
    scope: "/",
    short_name: "Vlingo CRM",
    start_url: "/dashboard",
    theme_color: "#155f16",
  };
}
