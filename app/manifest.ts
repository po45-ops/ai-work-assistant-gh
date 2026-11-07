import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Po · AI Work Assistant",
    short_name: "Po Assistant",
    description: "ผู้ช่วยจัดงานส่วนตัว วางแผนงาน และติดตามโปรเจกต์",
    start_url: "/protected",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f2",
    theme_color: "#8f6447",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/po-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/po-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
