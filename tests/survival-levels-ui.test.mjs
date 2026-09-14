import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import * as controls from '../engine/controls.js';
import * as rules from '../engine/model.js';
import * as survivalRules from '../engine/survival-rules.js';
import * as survivalMaps from '../engine/survival-maps.js';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url),ts=require('typescript');
function compile(path){
 const source=readFileSync(path,'utf8');
 const names=context=>rootNode=>{const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='useState'){const p=node.parent;if(ts.isVariableDeclaration(p)&&ts.isArrayBindingPattern(p.name))return ts.factory.createCallExpression(ts.factory.createIdentifier('__state'),undefined,[ts.factory.createStringLiteral(p.name.elements[0].name.text),...node.arguments]);}return ts.visitEachChild(node,visit,context);};return ts.visitNode(rootNode,visit);};
 return ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},transformers:{before:[names]}}).outputText;
}
const node=(type,props)=>({type,props});
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):typeof n==='string'||typeof n==='number'?String(n):'';
function walk(n,out=[]){if(Array.isArray(n))n.forEach(x=>walk(x,out));else if(n&&typeof n==='object'&&n.props){out.push(n);walk(n.props.children,out);}return out;}
function runtime(file,{store=new Map(),state={},writeFail=false,cleared=[]}={}){
 let effects=[],refIndex=0;const refs=[],listeners=new Map(),writes=[],applied=[],starts=[],progressCalls=[],toasts=[];
 const fakeEngine={setPreferences(p){applied.push(p);},setProgress(p){progressCalls.push(p);},start(...args){starts.push(args);return true;}};
 const ui=new Proxy({},{get:(_,p)=>p});
 const react={useEffect(fn,deps){effects.push({fn,deps});},useRef(init){return refs[refIndex++]??={current:refIndex===2?fakeEngine:init};}};
 const context={console,exports:{},matchMedia:()=>({matches:false}),window:{addEventListener(n,fn,capture){listeners.set(n,{fn,capture});},removeEventListener(n,fn){if(listeners.get(n)?.fn===fn)listeners.delete(n);}},localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(context.writeFail)throw Error('quota');writes.push([k,v]);store.set(k,v);}},writeFail,__state(name,initial){if(!Object.hasOwn(state,name))state[name]=typeof initial==='function'?initial():initial;return [state[name],v=>state[name]=typeof v==='function'?v(state[name]):v];}};
 context.require=p=>{if(p==='react')return react;if(p==='react/jsx-runtime')return {jsx:node,jsxs:node,Fragment:'Fragment'};if(p==='sonner')return {Toaster:'Toaster',toast:(...args)=>toasts.push(args)};if(p.endsWith('/survival-rules.js'))return survivalRules;if(p.endsWith('/controls.js'))return controls;if(p.endsWith('/model.js'))return rules;if(p.endsWith('/survival-maps.js'))return survivalMaps;if(p.includes('use-difficulty-progress'))return {useDifficultyProgress:()=>({cleared,loaded:true,unlocked:cleared.length>=3,error:'',pending:0})};if(p.includes('use-weapon-training'))return {useWeaponTraining:()=>({xp:{},loaded:true,error:'',pending:0})};return ui;};
 vm.runInContext(compile(file),vm.createContext(context),{filename:file});
 return {state,listeners,writes,store,applied,starts,progressCalls,toasts,context,render(name,props){effects=[];refIndex=0;const tree=context.exports[name](props);return {tree,nodes:walk(tree),text:text(tree),effects:[...effects]};}};
}
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const pick=(out,s)=>out.effects.find(e=>String(e.fn).includes(s));
check('Actual SurvivalLobby shows all levels, rejects locked White, and only enables start for eligible selection',()=>{
 const r=runtime(root+'/app/survival-ui.tsx'),changes=[];
 const props={map:'metro',ready:true,error:'',difficulty:'bachelor',cleared:[],onMap(){},onStart(){},onDifficulty:id=>changes.push(id)};
 let out=r.render('SurvivalLobby',props),group=out.nodes.find(n=>n.type==='RadioGroup');assert.equal(group.props.value,'bachelor');
 const radios=out.nodes.filter(n=>n.type==='RadioGroupItem');assert.equal(radios.length,4);assert(radios.find(n=>n.props.value==='shirane').props.disabled);assert(radios.filter(n=>n.props.value!=='shirane').every(n=>!n.props.disabled));
 group.props.onValueChange('doctor');assert.deepEqual(changes,['doctor']);group.props.onValueChange('shirane');assert.deepEqual(changes,['doctor']);
 out=r.render('SurvivalLobby',{...props,difficulty:'shirane'});assert(out.nodes.find(n=>n.props.className==='survival-start').props.disabled);assert.match(out.text,/白根は拠点制圧/);
 out=r.render('SurvivalLobby',{...props,difficulty:'shirane',cleared:['bachelor','master','doctor']});assert(!out.nodes.find(n=>n.props.className==='survival-start').props.disabled);assert(!out.nodes.find(n=>n.type==='RadioGroupItem'&&n.props.value==='shirane').props.disabled);
 out.nodes.find(n=>n.type==='RadioGroup').props.onValueChange('shirane');assert.equal(changes.at(-1),'shirane');assert.match(out.text,/出撃地点は毎試合ランダム/);
 assert.match(out.text,/市街地|戸建て|デパート/);
});
check('Actual GameClient preserves and saves difficulty, passes it into engine start, and retries using result difficulty',()=>{
 const key='array-front-controls-v1',store=new Map([[key,JSON.stringify({volume:23,survivalDifficulty:'doctor',keyBindings:{...controls.DEFAULT_KEY_BINDINGS,fire:'KeyK'}})]]),cleared=['bachelor','master','doctor'];
 const r=runtime(root+'/app/game-client.tsx',{store,cleared,state:{ready:true,loaded:true,gameMode:'survival',map:'metro',tab:'deploy'}});
 let out=r.render('default');pick(out,'localStorage.getItem').fn();pick(out,'localStorage.setItem').fn();assert.equal(r.writes.length,0);assert.equal(r.state.prefs.survivalDifficulty,'doctor');
 out=r.render('default');let lobby=out.nodes.find(n=>n.type==='SurvivalLobby');assert.equal(lobby.props.difficulty,'doctor');lobby.props.onDifficulty('master');
 out=r.render('default');pick(out,'localStorage.setItem').fn();assert.equal(JSON.parse(store.get(key)).survivalDifficulty,'master');assert.equal(JSON.parse(store.get(key)).keyBindings.fire,'KeyK');assert.equal(JSON.parse(store.get(key)).volume,23);
 out.nodes.find(n=>n.type==='SurvivalLobby').props.onStart();assert.equal(r.starts.at(-1)[1],'master');assert.equal(r.starts.at(-1)[2].mapId,'metro');assert.deepEqual(r.progressCalls.at(-1),cleared);
 r.state.hud={...r.state.hud,mode:'result',gameMode:'survival',difficultyId:'doctor',result:{difficultyId:'doctor',gameMode:'survival',outcome:'defeat'},activeSetup:{...rules.PRESETS[0]}};
 out=r.render('default');const hud=out.nodes.find(n=>n.type==='SurvivalHUD');assert(hud);hud.props.onStart();assert.equal(r.starts.at(-1)[1],'doctor','retry retains played difficulty despite lobby master preference');
 const reload=runtime(root+'/app/game-client.tsx',{store});out=reload.render('default');pick(out,'localStorage.getItem').fn();assert.equal(reload.state.prefs.survivalDifficulty,'master');
 r.context.writeFail=true;r.state.hud={...r.state.hud,mode:'menu'};out=r.render('default');out.nodes.find(n=>n.type==='SurvivalLobby').props.onDifficulty('bachelor');out=r.render('default');pick(out,'localStorage.setItem').fn();assert.match(r.state.controlsSaveError,/保存できません/);out.nodes.find(n=>n.type==='SurvivalLobby').props.onStart();assert.equal(r.starts.at(-1)[1],'bachelor','save failure does not prevent current selection');
});
check('Saved locked White cannot bypass start and old or malformed saves use bachelor',()=>{
 const key='array-front-controls-v1';
 for(const saved of [{survivalDifficulty:'invalid'},{volume:15},'malformed']){
  const value=typeof saved==='string'?saved:JSON.stringify(saved),r=runtime(root+'/app/game-client.tsx',{store:new Map([[key,value]])}),out=r.render('default');pick(out,'localStorage.getItem').fn();assert.equal(r.state.prefs.survivalDifficulty,'bachelor');
 }
 const r=runtime(root+'/app/game-client.tsx',{store:new Map([[key,JSON.stringify({survivalDifficulty:'shirane'})]]),state:{ready:true,gameMode:'survival',map:'tidal'}});let out=r.render('default');pick(out,'localStorage.getItem').fn();out=r.render('default');out.nodes.find(n=>n.type==='SurvivalLobby').props.onStart();assert.equal(r.starts.length,0);assert.match(String(r.toasts[0]),/白根は拠点制圧/);
});
console.log(`${passed} actual TSX difficulty UI and persistence checks passed`);
