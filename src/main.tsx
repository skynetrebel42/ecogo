
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { applySettings, loadSettings } from "./lib/settings";

  // Text size and contrast go on <html> before the first render, so the page never flashes the defaults (M11 3.4).
  applySettings(document.documentElement, loadSettings());
  createRoot(document.getElementById("root")!).render(<App />);
  