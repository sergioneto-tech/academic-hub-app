export type PushBrowser = "Brave" | "Microsoft Edge" | "Chrome" | "Firefox" | "Opera" | "Safari" | "Navegador";

type BraveNavigator = Navigator & {
  brave?: {
    isBrave?: () => Promise<boolean>;
  };
};

export function isDesktopPushDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const appleTouchDesktopUa = (/Macintosh|Mac OS X/i.test(ua) || navigator.platform === "MacIntel") && navigator.maxTouchPoints > 1;
  return !/Android|iPhone|iPad|iPod/i.test(ua) && !appleTouchDesktopUa;
}

export function detectPushBrowser(): PushBrowser {
  if (typeof navigator === "undefined") return "Navegador";
  const ua = navigator.userAgent || "";
  const nav = navigator as BraveNavigator;

  if (nav.brave) return "Brave";
  if (/Edg\//i.test(ua)) return "Microsoft Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) || /Chromium/i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) return "Safari";
  return "Navegador";
}

export function pushActivationGuidance(error: unknown) {
  const browser = detectPushBrowser();
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.trim();
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";

  if (permission === "denied") {
    return `As notificações estão bloqueadas para este site no ${browser}. Abre as permissões do Academic Hub no navegador, define “Notificações” como “Permitir”, atualiza a página e volta a tentar.`;
  }

  if (/registration failed\s*-?\s*push service error|push service error/i.test(message)) {
    if (browser === "Brave") {
      return "No Brave, abre brave://settings/privacy e ativa “Utilizar Google services para notificações push”. Fecha completamente o Brave, volta a abri-lo e tenta novamente.";
    }
    return `O serviço Push do ${browser} não conseguiu criar a subscrição. Confirma que as notificações deste site estão permitidas, fecha completamente o navegador, volta a abri-lo e tenta novamente.`;
  }

  if (/not supported|não suporta|não disponibiliza/i.test(message)) {
    return `${browser}: este ambiente não disponibiliza Web Push. Experimenta uma versão atual de Brave, Chrome, Edge, Firefox ou Safari compatível.`;
  }

  if (/autorização de notificações não foi concedida/i.test(message)) {
    return `Autoriza as notificações do Academic Hub nas permissões do site no ${browser} e volta a tentar.`;
  }

  return message || `Não foi possível ativar o Push no ${browser}. Confirma as permissões de notificações do site e tenta novamente.`;
}
