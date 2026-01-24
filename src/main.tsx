import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AppStoreProvider } from "./lib/AppStore";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { AuthProvider, useAuth } from "./lib/auth";

function StoreWithAuthKey({ children }: { children: React.ReactNode }) {
  const { storageKey } = useAuth();
  return (
    <AppStoreProvider storageKey={storageKey} key={storageKey}>
      {children}
    </AppStoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <HashRouter>
        <StoreWithAuthKey>
          <TooltipProvider>
            <App />
          </TooltipProvider>
          <Toaster />
        </StoreWithAuthKey>
      </HashRouter>
    </AuthProvider>
  </React.StrictMode>
);
