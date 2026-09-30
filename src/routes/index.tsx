import { createFileRoute } from "@tanstack/react-router";
import { PortfolioPage } from "../components/PortfolioPage";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mewo Studios — 3D Product Visualization & Game Art" },
      { name: "description", content: "Mewo Studios creates photoreal product visualization, game-ready 3D assets, and interactive Unity experiences." },
      { property: "og:title", content: "Mewo Studios — 3D Product Visualization & Game Art" },
      { property: "og:description", content: "High-end 3D visuals and optimized real-time assets, from Blender to Unity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});
