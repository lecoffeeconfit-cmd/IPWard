import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState as NativeAppState, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { DEMO_DATASET } from '../data/demo';
import { CaptureSession, DataMode, PrivacyDataset, TimeRange } from '../types';
import { isStoredCapture } from '../services/storage';
import { importedEventStore } from '../services/eventStore';
import { AppleReportResult } from '../services/appleReport';
import { openAndroidUsageSettings, readAndroidUsage, UsageAccess, UsageSnapshot } from '../services/androidUsage';

export type Route = 'Overview'|'Activity'|'Apps'|'Connections'|'Protect'|'Live Monitor'|'Captures'|'Trust'|'Settings'|'Communication'|'Sensors'|'Marketing'|'Destinations'|'Alerts';
export const routePaths:Record<Route,string>={Overview:'/',Activity:'/activity',Apps:'/apps',Connections:'/connections',Protect:'/protect','Live Monitor':'/live-monitor',Captures:'/captures',Trust:'/trust',Settings:'/settings',Communication:'/communication',Sensors:'/sensors',Marketing:'/marketing',Destinations:'/destinations',Alerts:'/alerts'};
export type Detail = {type:'app'|'connection'|'organization'|'country'|'capture'|'evidence';id:string}|null;
export interface Settings { light:boolean;reducedMotion:boolean;technical:boolean;retention:number;monitoring:'Standard'|'Enhanced'|'Battery saver';alerts:boolean;localOnly:boolean }
const defaults:Settings={light:false,reducedMotion:false,technical:false,retention:30,monitoring:'Standard',alerts:true,localOnly:true};
function restoreSettings(value:unknown):Settings {const raw=value&&typeof value==='object'?value as Partial<Settings>:{};return {light:raw.light===true,reducedMotion:raw.reducedMotion===true,technical:raw.technical===true,retention:[0,1,7,30,90].includes(Number(raw.retention))?Number(raw.retention):30,monitoring:raw.monitoring==='Enhanced'||raw.monitoring==='Battery saver'?raw.monitoring:'Standard',alerts:raw.alerts!==false,localOnly:true};}
const empty:PrivacyDataset={mode:'device',generatedAt:Date.now(),apps:[],organizations:[],connections:[],sensors:[],communications:[],alerts:[]};
interface AppState {
 dataset:PrivacyDataset;mode:DataMode;setMode:(m:DataMode)=>void;range:TimeRange;setRange:(r:TimeRange)=>void;
 route:Route;navigate:(r:Route)=>void;detail:Detail;openDetail:(d:Detail)=>void;
 settings:Settings;updateSettings:(s:Partial<Settings>)=>void;captures:CaptureSession[];saveCapture:(c:CaptureSession)=>void;
 clearCaptures:()=>void;clearHistory:()=>Promise<void>;importReport:(report:AppleReportResult)=>Promise<void>;demoPaused:boolean;setDemoPaused:(p:boolean)=>void;
 usageAccess:UsageAccess;refreshUsage:()=>Promise<void>;openUsageSettings:()=>boolean;
 activeCapture:CaptureSession|null;setActiveCapture:(c:CaptureSession|null)=>void;toast:(s:string)=>void;
 notice:string|null;ready:boolean;blockedDomains:string[];toggleDomain:(domain:string)=>void;
}
const Context=createContext<AppState>(null as unknown as AppState);
export const useApp=()=>useContext(Context);
export function AppProvider({children}:{children:React.ReactNode}) {
 const [mode,setMode]=useState<DataMode>('demo'); const [range,setRange]=useState<TimeRange>('Today');
 const pathname=usePathname();const route=(Object.keys(routePaths) as Route[]).find(key=>routePaths[key]===pathname)??'Overview';const [detail,openDetail]=useState<Detail>(null);
 const [settings,setSettings]=useState(defaults);const [captures,setCaptures]=useState<CaptureSession[]>([]);
 const [activeCapture,setActiveCapture]=useState<CaptureSession|null>(null);const [notice,setNotice]=useState<string|null>(null);
 const [ready,setReady]=useState(false);const [historyCleared,setHistoryCleared]=useState(false);
 const [demoPaused,setDemoPaused]=useState(false);const [blockedDomains,setBlockedDomains]=useState<string[]>([]);
 const [importedDataset,setImportedDataset]=useState<PrivacyDataset>(empty);
 const [usageSnapshot,setUsageSnapshot]=useState<UsageSnapshot>({access:'unsupported',apps:[],records:[]});
 const refreshUsage=useCallback(async()=>{try{setUsageSnapshot(await readAndroidUsage());}catch{setNotice('Android app usage could not be read. Check Usage Access and try again.');}},[]);
 useEffect(()=>{if(Platform.OS!=='android')return;void Promise.resolve().then(refreshUsage);const subscription=NativeAppState.addEventListener('change',state=>{if(state==='active')void refreshUsage();});return()=>subscription.remove();},[refreshUsage]);
 useEffect(()=>{AsyncStorage.getItem('ipward.preferences.v1').then(raw=>{if(raw){const saved=JSON.parse(raw);if(saved.version===1){const loadedSettings=restoreSettings(saved.settings);setSettings(loadedSettings);setMode(saved.mode==='device'?'device':'demo');setHistoryCleared(saved.historyCleared===true);setBlockedDomains(Array.isArray(saved.blockedDomains)?saved.blockedDomains.filter((d:unknown)=>typeof d==='string'):[]);setCaptures(Array.isArray(saved.captures)?saved.captures.filter((c:unknown)=>isStoredCapture(c)&&(loadedSettings.retention===0||c.startedAt>=Date.now()-loadedSettings.retention*86400000)).slice(0,50):[]);}}}).catch(()=>setNotice('Local preferences could not be read. Defaults are active.')).finally(()=>setReady(true));},[]);
 useEffect(()=>{if(ready){const now=Date.now();const retained=captures.filter(c=>settings.retention===0||c.startedAt>=now-settings.retention*86400000);AsyncStorage.setItem('ipward.preferences.v1',JSON.stringify({version:1,settings,mode,captures:retained,blockedDomains,historyCleared})).catch(()=>setNotice('Local storage is unavailable. Changes will last for this session only.'));}},[settings,captures,mode,blockedDomains,historyCleared,ready]);
 useEffect(()=>{if(!ready)return;importedEventStore.load(settings.retention).then(setImportedDataset).catch(()=>setNotice('Imported activity could not be read from local storage.'));},[ready,settings.retention]);
 useEffect(()=>{if(!notice)return;const timeout=setTimeout(()=>setNotice(null),5000);return()=>clearTimeout(timeout);},[notice]);
 const dataset:PrivacyDataset=mode==='demo'&&!historyCleared?DEMO_DATASET:mode==='device'?{...importedDataset,apps:[...new Map([...importedDataset.apps,...usageSnapshot.apps].map(app=>[app.id,app])).values()],appUsage:usageSnapshot.records}:{...empty,mode};
 const value:AppState={dataset,mode,setMode:m=>{setMode(m);setActiveCapture(null);setHistoryCleared(false);},range,setRange,route,navigate:r=>{router.push(routePaths[r] as '/');openDetail(null);},detail,openDetail,settings,updateSettings:s=>{setSettings(prev=>({...prev,...s}));const retention=s.retention;if(retention!==undefined)setCaptures(prev=>prev.filter(c=>retention===0||c.startedAt>=Date.now()-retention*86400000));},captures,saveCapture:c=>setCaptures(prev=>[c,...prev.filter(p=>p.id!==c.id)].slice(0,50)),clearCaptures:()=>{setCaptures([]);setActiveCapture(null);},clearHistory:async()=>{await importedEventStore.clear();setImportedDataset(empty);setHistoryCleared(true);setCaptures([]);setActiveCapture(null);},importReport:async report=>{const merged=await importedEventStore.merge(report.dataset,settings.retention);setImportedDataset(merged);setMode('device');setHistoryCleared(false);setRange('7 days');},usageAccess:usageSnapshot.access,refreshUsage,openUsageSettings:openAndroidUsageSettings,activeCapture,setActiveCapture,demoPaused,setDemoPaused,notice,toast:setNotice,ready,blockedDomains,toggleDomain:d=>setBlockedDomains(prev=>prev.includes(d)?prev.filter(x=>x!==d):[...prev,d])};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
