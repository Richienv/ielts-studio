import type { Recording, Session, Settings } from './types';
const prefix='ielts-studio-v1:';
export function readLocal<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(prefix+key)??'null')??fallback;}catch{return fallback;} }
export function writeLocal(key:string,value:unknown) {localStorage.setItem(prefix+key,JSON.stringify(value));}
export const defaultSettings: Settings={name:'Candidate',target:7.5,fontSize:'normal',contrast:false};
export function loadSession():Session|null { const s=readLocal<Session|null>('active',null);return s&&typeof s.id==='string'&&Array.isArray(s.sequence)&&Number.isFinite(s.deadline)?s:null; }
let connection:Promise<IDBDatabase>|undefined;
function database() {return connection??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('ielts-studio-recordings',1);r.onupgradeneeded=()=>r.result.createObjectStore('clips',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveRecording(clip: Recording) {const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('clips','readwrite');tx.objectStore('clips').put(clip);tx.oncomplete=()=>{window.dispatchEvent(new CustomEvent('ielts-recording-saved',{detail:clip.sessionId}));resolve();};tx.onerror=()=>reject(tx.error);});}
export async function recordings(sessionId:string) {const db=await database();return new Promise<Recording[]>((resolve,reject)=>{const tx=db.transaction('clips','readonly');const request=tx.objectStore('clips').getAll();request.onsuccess=()=>resolve((request.result as Recording[]).filter(c=>c.sessionId===sessionId).sort((a,b)=>a.step-b.step));request.onerror=()=>reject(request.error);});}
export function download(name:string,content:Blob|string,type='application/json') {const url=URL.createObjectURL(typeof content==='string'?new Blob([content],{type}):content);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
