import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { applyTheme, getStoredTheme, getSystemTheme } from "@/lib/theme";
import { UpdateProvider } from "@/lib/UpdateProvider";
import { AppStoreProvider } from "./lib/AppStore";
import App from "./App";

// Aplicar tema o mais cedo possível (evita "flash" ao abrir)
const initialTheme = getStoredTheme() ?? getSystemTheme();
applyTheme(initialTheme);


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <UpdateProvider>
        <AppStoreProvider>
          <App />
        </AppStoreProvider>
      </UpdateProvider>
    </HashRouter>
  </React.StrictMode>
);