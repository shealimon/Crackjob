import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const windowKind = new URLSearchParams(window.location.search).get("window");
const isOverlay = windowKind === "overlay";
document.documentElement.classList.toggle("overlay-mode", isOverlay);
document.documentElement.classList.toggle("toolbar-mode", !isOverlay);
document.body.classList.toggle("overlay-mode", isOverlay);
document.body.classList.toggle("toolbar-mode", !isOverlay);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App overlay={isOverlay} />
  </React.StrictMode>,
);
