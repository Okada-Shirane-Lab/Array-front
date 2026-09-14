'use client';
import {localRequest as fetch} from './local-storage.js';
import {useEffect,useRef,useState} from 'react';
// @ts-ignore Shared game rules.
import {clearedDifficulties,isShiraneUnlocked,validVictory} from '../engine/model.js';
type Victory={matchId:string,difficultyId:string,mapId:string,blue:number,red:number,remaining:number,outcome:string};
export function useDifficultyProgress(result:Victory|null){
 const [cleared,setCleared]=useState<string[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<Victory[]>([]),[saving,setSaving]=useState(false),[retry,setRetry]=useState(0),[unlockMatch,setUnlockMatch]=useState('');
 const seen=useRef(new Set<string>()),known=useRef<string[]>([]);
 function accept(data:any){
  if(!Array.isArray(data.cleared)||data.cleared.some((id:any)=>typeof id!=='string')||clearedDifficulties(data.cleared).length!==data.cleared.length)throw new Error('達成記録の形式を確認できませんでした。');
  const wasUnlocked=isShiraneUnlocked(known.current);
  known.current=clearedDifficulties([...known.current,...data.cleared]);setCleared(known.current);setLoaded(true);
  return !wasUnlocked&&isShiraneUnlocked(known.current);
 }
 useEffect(()=>{
  if(pending.length)return;
  const controller=new AbortController();let active=true;const timer=setTimeout(()=>controller.abort(),12000);
  fetch('/api/progress',{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(active){accept(data);setError('');}}).catch(e=>{if(active)setError(e.name==='AbortError'?'達成記録の読み込みがタイムアウトしました。再試行してください。':e.message);}).finally(()=>clearTimeout(timer));
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[retry,pending.length]);
 useEffect(()=>{
  if(!result||result.outcome!=='victory'||!validVictory(result)||seen.current.has(result.matchId))return;
  seen.current.add(result.matchId);setPending(queue=>[...queue,{...result}]);
 },[result]);
 useEffect(()=>{
  if(!pending.length)return;
  const victory=pending[0],controller=new AbortController();let active=true;const timer=setTimeout(()=>controller.abort(),12000);
  setSaving(true);setError('');
  fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(victory),signal:controller.signal}).then(async response=>{
   const data=await response.json();if(!response.ok)throw new Error(data.error);
   if(active){if(accept(data))setUnlockMatch(victory.matchId);setError('');setSaving(false);setPending(queue=>queue.filter(item=>item.matchId!==victory.matchId));}
  }).catch(e=>{if(active)setError(e.name==='AbortError'?'達成記録の保存がタイムアウトしました。画面を閉じずに再試行してください。':e.message);}).finally(()=>{clearTimeout(timer);if(active)setSaving(false);});
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[pending,retry]);
 return {cleared,loaded,error,saving,pending:pending.length,unlockMatch,unlocked:isShiraneUnlocked(cleared),retry:()=>setRetry(value=>value+1)};
}
