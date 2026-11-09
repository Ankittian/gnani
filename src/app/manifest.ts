import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dukaan Dost — voice kirana assistant",
    short_name: "Dukaan Dost",
    description: "Bolke khata, stock, orders aur hisaab — apni bhasha mein.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ea",
    theme_color: "#14594a",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
