import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { AppStoreProvider } from "./lib/AppStore";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </HashRouter>
  </React.StrictMode>
);