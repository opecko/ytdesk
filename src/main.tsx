import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// No browser context menu (Back, Reload, Inspect Element…). In dev builds Shift+right-click still opens it for debugging.
document.addEventListener("contextmenu", (e) => {
  if (!(import.meta.env.DEV && e.shiftKey)) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
