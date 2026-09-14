const action=(id,label,code,group,mode='all')=>Object.freeze({id,label,code,group,mode});
export const KEY_ACTIONS=Object.freeze([
 action('forward','前進','KeyW','移動'),action('backward','後退','KeyS','移動'),action('left','左へ移動','KeyA','移動'),action('right','右へ移動','KeyD','移動'),
 action('sprint','ダッシュ','ShiftLeft','移動'),action('jump','ジャンプ','Space','移動'),action('crouch','しゃがむ','KeyC','移動'),
 action('lookUp','視点を上へ','ArrowUp','視点'),action('lookDown','視点を下へ','ArrowDown','視点'),action('lookLeft','視点を左へ','ArrowLeft','視点'),action('lookRight','視点を右へ','ArrowRight','視点'),
 action('fire','射撃','Enter','戦闘'),action('aim','スコープ切り替え','KeyV','戦闘'),action('reload','エネルギー交換','KeyR','戦闘'),action('scan','スキャン','KeyQ','戦闘'),action('wpt','WPT給電（長押し）','KeyE','戦闘'),
 action('slot1','武器スロット1','Digit1','武器','conquest'),action('slot2','武器スロット2','Digit2','武器','conquest'),action('slot3','武器スロット3','Digit3','武器','conquest'),
 action('pickup','部品・セル回収','KeyF','サバイバル','survival'),action('heal','WPT救急セル','KeyH','サバイバル','survival'),action('armor','WPTアーマーセル','KeyJ','サバイバル','survival'),action('map','全体マップ','KeyM','サバイバル','survival'),action('autorun','自動前進','KeyZ','サバイバル','survival'),
 action('pause','一時停止','KeyP','共通')
]);
export const DEFAULT_KEY_BINDINGS=Object.freeze(Object.fromEntries(KEY_ACTIONS.map(a=>[a.id,a.code])));
const aliases={NumpadEnter:'fire',ControlLeft:'crouch',Tab:'map'};
export const validKeyCode=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|NumpadEnter|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Enter|Tab|ShiftLeft|ShiftRight|ControlLeft|ControlRight|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(code);
export function normalizeKeyBindings(value){
 const result=Object.fromEntries(KEY_ACTIONS.map(a=>[a.id,validKeyCode(value?.[a.id])?value[a.id]:a.code]));
 return new Set(Object.values(result)).size===KEY_ACTIONS.length?result:{...DEFAULT_KEY_BINDINGS};
}
export function bindingConflict(bindings,actionId,code){return KEY_ACTIONS.find(a=>a.id!==actionId&&bindings[a.id]===code)||null;}
export function resolveControlCode(code,bindings=DEFAULT_KEY_BINDINGS){
 if(code==='Escape')return 'Escape';
 const explicit=KEY_ACTIONS.find(a=>bindings[a.id]===code);
 if(explicit)return explicit.code;
 const alias=aliases[code];
 return alias&&bindings[alias]===DEFAULT_KEY_BINDINGS[alias]?DEFAULT_KEY_BINDINGS[alias]:null;
}
const names={Space:'Space',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'左Shift',ShiftRight:'右Shift',ControlLeft:'左Ctrl',ControlRight:'右Ctrl',NumpadEnter:'テンキーEnter',Backquote:'半角/全角',Minus:'−',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'};
export const codeLabel=code=>names[code]||String(code).replace(/^Key|^Digit/,'').replace(/^Numpad/,'テンキー');
export const keyLabel=(bindings,id)=>codeLabel(bindings?.[id]||DEFAULT_KEY_BINDINGS[id]);
export function editableKeyTarget(target){return !!(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')||target?.closest?.('[contenteditable="true"], [role="textbox"]'));}
