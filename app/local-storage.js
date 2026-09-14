import {defaultData, validateData, normalizeData, withinTraining, clearedDifficulties,
  isShiraneUnlocked, validVictory, validTrainingReport, usageXP, MAPS} from '../engine/model.js';

// A single record makes each write atomic. Web Locks also serialize separate tabs.
// This is a local single-player profile, not a network service or an anti-cheat system.
const reply = (data, status = 200) => Response.json(data, {status});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const validXP = n => Number.isSafeInteger(n) && n >= 0;

export function createLocalRequest({storage, key = 'array-front-profile-v1', locks} = {}) {
  const ownerKey = key;
  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return {schema: 1, arsenal: {...defaultData(), version: 0}, cleared: [], receipts: {}};
    const data = JSON.parse(raw);
    if (!data || data.schema !== 1 || !validateData(data.arsenal) || !validXP(data.arsenal.version)
      || !Array.isArray(data.cleared) || clearedDifficulties(data.cleared).length !== data.cleared.length
      || !data.receipts || typeof data.receipts !== 'object' || Array.isArray(data.receipts)
      || Object.values(data.receipts).some(receipt => !receipt || typeof receipt !== 'object'
        || Array.isArray(receipt) || Object.values(receipt).some(n => !validXP(n) || n > 1200))) {
      throw new Error('保存データを確認できません。');
    }
    return data;
  }
  function totals(data) {
    const xp = Object.create(null);
    for (const receipt of Object.values(data.receipts)) {
      for (const [id, value] of Object.entries(receipt)) xp[id] = (xp[id] || 0) + value;
    }
    return xp;
  }
  function transaction(path, options) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const method = (options.method || 'GET').toUpperCase();
    if (!['/api/arsenal', '/api/progress', '/api/training'].includes(path)) return reply({error: '保存先が見つかりません。'}, 404);
    if (method !== 'GET' && method !== (path === '/api/arsenal' ? 'PUT' : 'POST')) return reply({error: 'この保存操作には対応していません。'}, 405);
    const data = read();
    if (method === 'GET') {
      if (path === '/api/arsenal') return reply(normalizeData(data.arsenal));
      if (path === '/api/progress') return reply({cleared: data.cleared, shiraneUnlocked: isShiraneUnlocked(data.cleared)});
      return reply({ownerKey, xp: totals(data)});
    }
    if (typeof options.body !== 'string' || options.body.length > 40000) return reply({error: '保存内容の形式を確認してください。'}, 400);
    let payload;
    try { payload = JSON.parse(options.body); } catch { return reply({error: '保存内容の形式を確認してください。'}, 400); }
    let result;
    if (path === '/api/arsenal') {
      if (!validateData(payload) || !validXP(payload.version)) return reply({error: '設定の値または装備枠を確認してください。'}, 400);
      if (payload.version !== data.arsenal.version) return reply({error: '別の画面で設定が更新されました。再読み込みしてから保存してください。'}, 409);
      const xp = totals(data);
      for (const setup of payload.setups) {
        if (!withinTraining(setup, xp[setup.id] || 0, data.arsenal.setups.find(s => s.id === setup.id))) {
          return reply({error: `「${setup.name}」の日頃の行いでは、この設定範囲は未解放です。`}, 400);
        }
      }
      data.arsenal = normalizeData({setups: payload.setups, slots: payload.slots, version: payload.version + 1});
      result = {version: data.arsenal.version};
    } else if (path === '/api/progress') {
      if (!validVictory(payload)) return reply({error: '終了した拠点制圧戦の勝利のみ記録できます。'}, 400);
      if (payload.difficultyId === 'shirane' && !isShiraneUnlocked(data.cleared)) return reply({error: '学士・修士・博士を修了すると白根が解放されます。'}, 403);
      const newClear = !data.cleared.includes(payload.difficultyId);
      data.cleared = clearedDifficulties([...data.cleared, payload.difficultyId]);
      result = {cleared: data.cleared, shiraneUnlocked: isShiraneUnlocked(data.cleared), newClear};
    } else {
      if (!payload || payload.ownerKey !== ownerKey) return reply({error: '保存先が変わりました。再読み込みしてください。'}, 403);
      if (!validTrainingReport(payload) || !MAPS.some(m => m.id === payload.mapId)) return reply({error: '戦闘記録の値を確認してください。'}, 400);
      const weapons = payload.weapons.filter(w => data.arsenal.setups.some(s => s.id === w.id));
      const receipt = Object.assign(Object.create(null), own(data.receipts, payload.matchId) ? data.receipts[payload.matchId] : {});
      for (const w of weapons) receipt[w.id] = Math.max(receipt[w.id] || 0, usageXP(w));
      data.receipts[payload.matchId] = receipt;
      result = {ownerKey, xp: totals(data), receipts: Object.fromEntries(weapons.map(w => [w.id, receipt[w.id]]))};
    }
    // If quota/access fails, report failure; never claim an unsaved record succeeded.
    storage.setItem(key, JSON.stringify(data));
    return reply(result);
  }
  return async (path, options = {}) => {
    try {
      if (locks) return await locks.request(key, {mode: 'exclusive', ...(options.signal ? {signal: options.signal} : {})}, () => transaction(path, options));
      return transaction(path, options);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return reply({error: 'このブラウザの保存データを読み書きできません。ストレージの許可・空き容量を確認して再試行してください。既存のデータは上書きしません。'}, 503);
    }
  };
}

let request;
export function localRequest(path, options) {
  if (!request) {
    // GitHub project sites on the same origin must not share a game profile.
    const directory = new URL('.', window.location.href).pathname;
    request = createLocalRequest({storage: {
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value)
    }, key: 'array-front-profile-v1:' + directory, locks: navigator.locks});
  }
  return request(path, options);
}
