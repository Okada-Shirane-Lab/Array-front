import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import * as controls from '../engine/controls.js';
import * as rules from '../engine/model.js';
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
function runtime(file,{store=new Map(),state={},writeFail=false}={}){
 let effects=[],refIndex=0;const refs=[],listeners=new Map(),writes=[],applied=[];
 const fakeEngine={setPreferences(p){applied.push(p);},setProgress(){}};
 const ui=new Proxy({},{get:(_,p)=>p});
 const react={useEffect(fn,deps){effects.push({fn,deps});},useRef(init){return refs[refIndex++]??={current:refIndex===2?fakeEngine:init};}};
 const context={console,exports:{},window:{addEventListener(n,fn,capture){listeners.set(n,{fn,capture});},removeEventListener(n,fn){if(listeners.get(n)?.fn===fn)listeners.delete(n);}},localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(context.writeFail)throw Error('quota');writes.push([k,v]);store.set(k,v);}},writeFail,__state(name,initial){if(!Object.hasOwn(state,name))state[name]=typeof initial==='function'?initial():initial;return [state[name],v=>state[name]=typeof v==='function'?v(state[name]):v];}};
 context.require=p=>{if(p==='react')return react;if(p==='react/jsx-runtime')return {jsx:node,jsxs:node,Fragment:'Fragment'};if(p.endsWith('/controls.js'))return controls;if(p.endsWith('/model.js'))return rules;if(p.endsWith('/survival-maps.js'))return survivalMaps;if(p.includes('use-difficulty-progress'))return {useDifficultyProgress:()=>({cleared:[],loaded:true,unlocked:false,error:'',pending:0})};if(p.includes('use-weapon-training'))return {useWeaponTraining:()=>({xp:{},loaded:true,error:'',pending:0})};return ui;};
 vm.runInContext(compile(file),vm.createContext(context),{filename:file});
 return {state,listeners,writes,store,applied,context,render(name,props){effects=[];refIndex=0;const tree=context.exports[name](props);return {tree,nodes:walk(tree),text:text(tree),effects:[...effects]};}};
}
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
check('Actual KeySettings capture handles repeat, IME, duplicate, invalid key, modifiers, Escape, commit and reset',()=>{
 const r=runtime(root+'/app/key-settings.tsx');let bindings={...controls.DEFAULT_KEY_BINDINGS},changes=0,cleanup;
 const onChange=b=>{bindings=b;changes++;};
 const render=(saveError='')=>{cleanup?.();const out=r.render('KeySettings',{bindings,onChange,saveError});cleanup=out.effects[0].fn();return out;};
 const choose=(id)=>{const label=controls.KEY_ACTIONS.find(a=>a.id===id).label;render().nodes.find(n=>n.type==='button'&&n.props['aria-label']?.startsWith(label+'のキーを変更')).props.onClick();return render();};
 const event=(code,extra={})=>{const e={code,repeat:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};r.listeners.get('keydown').fn(e);assert(e.prevented&&e.stopped);return e;};
 choose('fire');assert.equal(r.listeners.get('keydown').capture,true);
 event('KeyK',{repeat:true});event('KeyK',{isComposing:true});assert.equal(changes,0);assert.equal(r.state.waiting,'fire');
 event('KeyW');assert.match(render().text,/前進.*使用中/);assert.equal(changes,0);
 event('F5');assert.match(render().text,/割り当てできません/);event('KeyK',{ctrlKey:true});assert.equal(changes,0);
 event('Escape');assert.match(render().text,/キャンセル/);assert.equal(r.state.waiting,null);assert.equal(r.listeners.has('keydown'),false);
 choose('fire');event('KeyK');let out=render();assert.equal(changes,1);assert.equal(bindings.fire,'KeyK');assert.equal(r.state.waiting,null);assert.equal(r.listeners.has('keydown'),false);assert.match(out.text,/キー割り当てを変更しました/);assert(out.nodes.some(n=>n.props['aria-label']==='射撃のキーを変更、現在K'));
 out=render('保存できません');assert.match(out.text,/保存できません/);
 choose('forward');r.listeners.get('blur').fn();render();assert.equal(r.state.waiting,null);assert.equal(r.listeners.has('keydown'),false);
 render().nodes.find(n=>n.type==='button'&&text(n).includes('初期設定に戻す')).props.onClick();out=render();assert.deepEqual({...bindings},{...controls.DEFAULT_KEY_BINDINGS});assert.match(out.text,/初期設定に戻しました/);
});
check('Actual GameClient effects preserve saved bindings on mount, update storage and engine, and restore on reload',()=>{
 const saved={sensitivity:1.5,arrowSensitivity:2,volume:22,screenShake:55,dronesEnabled:false,quality:'low',keyBindings:{...controls.DEFAULT_KEY_BINDINGS,forward:'KeyI',fire:'KeyK'}};
 const key='array-front-controls-v1',store=new Map([[key,JSON.stringify(saved)]]),r=runtime(root+'/app/game-client.tsx',{store,state:{ready:true,loaded:true,tab:'arsenal'}});
 const render=()=>r.render('default');const pick=(out,s)=>out.effects.find(e=>String(e.fn).includes(s));
 let out=render();pick(out,'localStorage.getItem').fn();pick(out,'localStorage.setItem').fn();assert.equal(r.writes.length,0);assert.equal(r.state.controlsLoaded,true);assert.equal(r.state.prefs.keyBindings.fire,'KeyK');
 out=render();pick(out,'localStorage.setItem').fn();pick(out,'setPreferences').fn();assert.equal(JSON.parse(store.get(key)).keyBindings.forward,'KeyI');assert.equal(r.applied.at(-1).keyBindings.fire,'KeyK');
 const settings=out.nodes.find(n=>n.type==='KeySettings');assert(settings);assert.equal(settings.props.bindings.fire,'KeyK');settings.props.onChange({...settings.props.bindings,reload:'KeyO'});
 out=render();pick(out,'localStorage.setItem').fn();pick(out,'setPreferences').fn();assert.equal(JSON.parse(store.get(key)).keyBindings.reload,'KeyO');assert.equal(r.applied.at(-1).keyBindings.reload,'KeyO');assert.equal(r.state.prefs.volume,22);
 const reload=runtime(root+'/app/game-client.tsx',{store});const loaded=reload.render('default');pick(loaded,'localStorage.getItem').fn();assert.equal(reload.state.prefs.keyBindings.reload,'KeyO');assert.equal(reload.state.prefs.keyBindings.fire,'KeyK');
 r.context.writeFail=true;out=render();pick(out,'localStorage.setItem').fn();out=render();assert.match(out.nodes.find(n=>n.type==='KeySettings').props.saveError,/保存できません/);pick(out,'setPreferences').fn();assert.equal(r.applied.at(-1).keyBindings.reload,'KeyO');
 r.context.writeFail=false;out=render();pick(out,'localStorage.setItem').fn();assert.equal(r.state.controlsSaveError,'');
});
check('Actual preferences loader accepts old saves and safely normalizes malformed or duplicate bindings',()=>{
 const key='array-front-controls-v1';
 for(const [value,fire] of [[JSON.stringify({volume:12}),'Enter'],['broken-json','Enter'],[JSON.stringify({keyBindings:{...controls.DEFAULT_KEY_BINDINGS,fire:'KeyW'}}),'Enter']]){
  const r=runtime(root+'/app/game-client.tsx',{store:new Map([[key,value]])}),out=r.render('default');out.effects.find(e=>String(e.fn).includes('localStorage.getItem')).fn();assert.equal(r.state.controlsLoaded,true);assert.equal(r.state.prefs.keyBindings.fire,fire);
 }
});
console.log(`${passed} UI and persistence flow checks passed`);
