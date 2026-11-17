import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// CSS loads in this order. Check campus.css for overrides when a change in styles.css does not appear.
import "./styles.css";
import "./campus.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
