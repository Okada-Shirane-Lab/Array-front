'use client';

type Marker={id:string,kind:string,distance:number,x:number,y:number,labelY:number,boxY:number,boxWidth:number,boxHeight:number,focused:boolean,compact:boolean};

export function EnemyMarkers({markers,aiming,scopeId}:{markers:Marker[],aiming:boolean,scopeId:string}){
 const magnified=aiming&&scopeId!=='reflex'&&scopeId!=='holo';
 return <div className={'enemy-identification'+(magnified?' magnified':'')} aria-label="視界内の敵">
  {markers.map(m=><div key={m.id} className={'enemy-contact'+(m.focused?' focused':'')+(m.compact?' compact':'')}>
   <div className="enemy-contact-label" style={{left:m.x+'%',top:m.labelY+'%'}}>
    <svg viewBox="0 0 18 18" aria-hidden="true"><path d={m.kind==='drone'?'M9 2 17 15H1Z':'M9 1 17 9 9 17 1 9Z'}/><path d="M9 5v5m0 2v1"/></svg>
    {!m.compact&&<span><b>{m.kind==='drone'?'敵 UAV':'敵'}</b> {m.distance} m</span>}
   </div>
   {m.focused&&<div className="enemy-contact-brackets" style={{left:m.x+'%',top:m.boxY+'%',width:m.boxWidth,height:m.boxHeight}} aria-hidden="true"><i/><i/><i/><i/></div>}
  </div>)}
 </div>;
}
