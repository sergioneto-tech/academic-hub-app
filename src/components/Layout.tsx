import { useEffect, useMemo, useState } from "react";
import { Bell, BookOpen, CalendarDays, CircleHelp, ClipboardList, Download, GraduationCap, History, Home, Menu, Monitor, Moon, MoreHorizontal, Settings, Sparkles, Sun } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProfileAvatar } from "@/components/ProfileAvatarEditor";
import ReleaseUpdateNotice, { type ReleaseUpdateEntry } from "@/components/ReleaseUpdateNotice";
import { CLOUD_SYNC_NOTICE_VISIBILITY_EVENT } from "@/components/CloudSyncNotice";
import { isMigrationNoticePending, MIGRATION_NOTICE_DISMISSED_EVENT } from "@/lib/migrationNoticeState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppStore } from "@/lib/AppStore";
import { getDegreeAccent } from "@/lib/degreeTheme";
import { applyTheme, getStoredTheme, resolveTheme, storeTheme, watchSystemTheme, type ThemeMode } from "@/lib/theme";
import { useUpdate } from "@/lib/UpdateProvider";
import { getPlanCoursesForDegree } from "@/lib/uabPlan";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
const UPDATE_DEFER_KEY="academicHub:updateDeferred",LAST_SEEN_VERSION_KEY="academic_hub_last_seen_version";
type BeforeInstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>};type ReleaseNotesEntry=ReleaseUpdateEntry;type ReleaseNotesData={latest?:string;versions?:ReleaseNotesEntry[]};type IdleCapableWindow=Window&typeof globalThis&{requestIdleCallback?:(callback:()=>void,options?:{timeout:number})=>number;cancelIdleCallback?:(handle:number)=>void};type NavItem={to:string;label:string;shortLabel:string;icon:typeof Home;exact?:boolean};
const PRIMARY_NAV:NavItem[]=[{to:"/",label:"Início",shortLabel:"Início",icon:Home,exact:true},{to:"/cadeiras",label:"Cadeiras",shortLabel:"Cadeiras",icon:BookOpen},{to:"/plano",label:"Plano de estudos",shortLabel:"Plano",icon:GraduationCap},{to:"/plano/estudo",label:"Gestão de tarefas",shortLabel:"Tarefas",icon:ClipboardList,exact:true},{to:"/calendario",label:"Calendário",shortLabel:"Agenda",icon:CalendarDays},{to:"/historico",label:"Histórico",shortLabel:"Histórico",icon:History}];const SUPPORT_NAV:NavItem[]=[{to:"/ajuda",label:"Ajuda & Guia",shortLabel:"Ajuda",icon:CircleHelp},{to:"/feedback",label:"Feedback",shortLabel:"Feedback",icon:Sparkles},{to:"/definicoes",label:"Definições",shortLabel:"Definições",icon:Settings}];const MOBILE_NAV=PRIMARY_NAV.filter(i=>i.to!=="/plano/estudo").slice(0,4),ALL_NAV=[...PRIMARY_NAV,...SUPPORT_NAV];
function parseVersion(v:string){return v.split(".").map(p=>Number.parseInt(p.replace(/\D/g,""),10)).map(n=>Number.isFinite(n)?n:0)}function isNewerVersion(c:string|undefined,current:string){if(!c||c===current)return false;const a=parseVersion(c),b=parseVersion(current),s=Math.max(a.length,b.length);for(let i=0;i<s;i++){if((a[i]??0)>(b[i]??0))return true;if((a[i]??0)<(b[i]??0))return false}return false}function isNavActive(p:string,i:NavItem){return i.exact?p===i.to:p===i.to||p.startsWith(`${i.to}/`)}function pageTitle(p:string){return ALL_NAV.find(i=>isNavActive(p,i))?.label??"Academic Hub"}function NavigationLink({item,compact=false}:{item:NavItem;compact?:boolean}){const Icon=item.icon;return <NavLink to={item.to} end={item.exact} className={({isActive})=>cn("group flex items-center rounded-xl font-medium transition-colors",compact?"flex-col justify-center gap-1 px-1 py-2 text-[10px]":"gap-3 px-3 py-2.5 text-sm",isActive?"bg-sidebar-accent text-sidebar-accent-foreground":"text-sidebar-foreground/65 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground")}><Icon className={cn(compact?"h-5 w-5":"h-[18px] w-[18px]","shrink-0")}/><span className={cn(compact&&"max-w-full truncate")}>{compact?item.shortLabel:item.label}</span></NavLink>}

// Remaining layout implementation is intentionally preserved below by the repository update process.
