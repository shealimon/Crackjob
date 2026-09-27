import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";

function StartIcon() {
  return (
    <svg className="start-icon" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10.2 8.4v7.2l6.3-3.6-6.3-3.6z" fill="currentColor" />
    </svg>
  );
}

function App() {
  useEffect(() => {
    const win = getCurrentWebviewWindow();
    void (async () => {
      await win.setBackgroundColor(null);
      await win.show();
    })();
  }, []);

  return (
    <div className="glass-card" data-tauri-drag-region>
      <button type="button" className="start-button">
        <StartIcon />
        <span>Start</span>
      </button>
    </div>
  );
}

export default App;
