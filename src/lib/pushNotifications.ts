import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BFDPFz6LlLvqa99SKJYYnxSBskJWWFLpHF7PqGA8MmdzZJfaX4DkbYlWIKD5zMt1JaDq5kdOBsq_I7gVEHwFQSc";

export type PushPreferences = {
  deadlines_enabled: boolean;
  exams_enabled: boolean;
  uab_enabled: boolean;
  efinal_lead_days: number;
  exam_lead_days: number;
  uab_lead_days: number;
  timezone: string;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  deadlines_enabled: true,
  exams_enabled: true,
  uab_enabled: true,
  efinal_lead_days: 2,
  exam_lead_days: 7,
  uab_lead_days: 3,
  timezone: "Europe/Lisbon",
};

function urlBase64ToUint8Array(value:string){
  const padding="=".repeat((4-(value.length%4))%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}

export function pushSupported(){ return typeof window!=="undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
export function isStandalonePwa(){ return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?:boolean}).standalone===true; }

export async function loadPushPreferences(){
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return null;
  const {data,error}=await supabase.from("push_preferences").select("*").eq("user_id",user.id).maybeSingle();
  if(error) throw error;
  return data ? ({...DEFAULT_PUSH_PREFERENCES,...data} as PushPreferences) : DEFAULT_PUSH_PREFERENCES;
}

export async function savePushPreferences(prefs:PushPreferences){
  const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Inicia sessão para ativar notificações.");
  const {error}=await supabase.from("push_preferences").upsert({user_id:user.id,...prefs},{onConflict:"user_id"});
  if(error) throw error;
}

export async function currentPushSubscription(){
  if(!pushSupported()) return null;
  const registration=await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePushOnThisDevice(deviceLabel:string){
  if(!pushSupported()) throw new Error("Este dispositivo/navegador não suporta notificações Push.");
  const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Inicia sessão para ativar notificações.");
  const permission=await Notification.requestPermission();
  if(permission!=="granted") throw new Error("A autorização de notificações não foi concedida.");
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription){
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
  }
  const json=subscription.toJSON();
  const {error}=await supabase.from("push_subscriptions").upsert({
    user_id:user.id, endpoint:subscription.endpoint, p256dh:json.keys?.p256dh??"", auth:json.keys?.auth??"",
    device_label:deviceLabel, user_agent:navigator.userAgent, enabled:true,
  },{onConflict:"endpoint"});
  if(error) throw error;
  await savePushPreferences(await loadPushPreferences()??DEFAULT_PUSH_PREFERENCES);
  return subscription;
}

export async function disablePushOnThisDevice(){
  const subscription=await currentPushSubscription(); if(!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint",subscription.endpoint);
  await subscription.unsubscribe();
}

export async function sendPushTest(){
  const {error}=await supabase.functions.invoke("academic-push",{body:{mode:"test"}});
  if(error) throw error;
}
