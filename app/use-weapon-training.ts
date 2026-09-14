'use client';
import {localRequest as fetch} from './local-storage.js';
import {useCallback,useEffect,useRef,useState} from 'react';
// @ts-ignore Shared game rules.
import {usageXP,validTrainingReport} from '../engine/model.js';
type Report={matchId:string,mapId:string,elapsed:number,weapons:{id:string,damage:number,kills:number,headshotKills:number}[]};
export function useWeaponTraining(report:Report|null,mode:string){
 const [xp,setXp]=useState<Record<string,number>>({}),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[pending,setPending]=useState(0),[retry,setRetry]=useState(0);
 const queue=useRef(new Map<string,Report>()),ack=useRef(new Map<string,Record<string,number>>()),owner=useRef(''),busy=useRef(false),mounted=useRef(true),lastPush=useRef(0),modeRef=useRef(mode),noticeMatch=useRef(''),active=useRef<AbortController|null>(null);
 modeRef.current=mode;
 const cache=useCallback(()=>{setPending(queue.current.size);if(owner.current)try{sessionStorage.setItem('array-front-training-pending:'+owner.current,JSON.stringify([...queue.current.values()]));}catch{}},[]);
 const accept=useCallback((data:any)=>{if(!data||typeof data.ownerKey!=='string'||!data.xp||typeof data.xp!=='object'||Array.isArray(data.xp)||Object.values(data.xp).some(n=>!Number.isSafeInteger(n)||Number(n)<0))throw new Error('日頃の行いの記録を確認できませんでした。');if(owner.current&&owner.current!==data.ownerKey)throw new Error('保存先が変わりました。再読み込みしてください。');owner.current=data.ownerKey;setXp(old=>Object.fromEntries([...new Set([...Object.keys(old),...Object.keys(data.xp)])].map(id=>[id,Math.max(Number(old[id])||0,Number(data.xp[id])||0)])));setLoaded(true);},[]);
 const flush=useCallback(async()=>{
  if(!mounted.current||!owner.current||busy.current||!queue.current.size)return;
  const current=queue.current.values().next().value!;
  busy.current=true;lastPush.current=Date.now();setSaving(true);const controller=new AbortController();active.current=controller;const timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch('/api/training',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...current,ownerKey:owner.current}),signal:controller.signal,keepalive:true});const data=await response.json();if(!response.ok)throw new Error(data.error);if(!mounted.current)return;accept(data);setError('');if(current.weapons.some(w=>!Object.prototype.hasOwnProperty.call(data.receipts||{},w.id))){noticeMatch.current=current.matchId;setNotice('未保存または削除済みの武器の経験値は保存されませんでした。保存済みの武器で出撃してください。');}else if(current.matchId!==noticeMatch.current)setNotice('');
   const highwater=ack.current.get(current.matchId)||Object.create(null);for(const w of current.weapons)highwater[w.id]=Math.max(highwater[w.id]||0,usageXP(w));ack.current.set(current.matchId,highwater);
   const latest=queue.current.get(current.matchId);if(latest&&latest.weapons.every(w=>usageXP(w)<=(highwater[w.id]||0)))queue.current.delete(current.matchId);cache();
  }catch(e:any){if(mounted.current)setError(e.name==='AbortError'?'日頃の行いの保存を再試行しています。':e.message||'日頃の行いを保存できませんでした。');}
  finally{clearTimeout(timer);busy.current=false;active.current=null;if(mounted.current)setSaving(false);}
 },[accept,cache]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort();};},[]);
 useEffect(()=>{
  const controller=new AbortController();let live=true;const timer=setTimeout(()=>controller.abort(),12000);
  fetch('/api/training',{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(!live)return;const first=!owner.current;accept(data);setError('');
   // Session storage holds retry drafts; local-storage.js persists accepted totals.
   if(first)try{const saved=JSON.parse(sessionStorage.getItem('array-front-training-pending:'+owner.current)||'[]');if(Array.isArray(saved))for(const item of saved)if(validTrainingReport(item)&&!queue.current.has(item.matchId))queue.current.set(item.matchId,item);}catch{}
   cache();void flush();
  }).catch(e=>{if(live)setError(e.name==='AbortError'?'日頃の行いを読み込めませんでした。再試行してください。':e.message);}).finally(()=>clearTimeout(timer));
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[retry,accept,cache,flush]);
 useEffect(()=>{
  if(!report||!validTrainingReport(report))return;const known=ack.current.get(report.matchId)||Object.create(null);
  if(!report.weapons.some(w=>usageXP(w)>(known[w.id]||0)))return;
  const old=queue.current.get(report.matchId);if(old&&old.weapons.length===report.weapons.length&&old.weapons.every(w=>usageXP(w)>=usageXP(report.weapons.find(v=>v.id===w.id)||w)))return;
  queue.current.set(report.matchId,report);cache();if(mode!=='playing'||Date.now()-lastPush.current>=15000)void flush();
 },[report,mode,cache,flush]);
 useEffect(()=>{if(mode!=='playing')void flush();const timer=setInterval(()=>{if(modeRef.current!=='playing'||Date.now()-lastPush.current>=15000)void flush();},3000);return()=>clearInterval(timer);},[mode,flush]);
 return {xp,loaded,error,notice,saving,pending,retry:()=>{lastPush.current=0;setRetry(n=>n+1);void flush();}};
}
