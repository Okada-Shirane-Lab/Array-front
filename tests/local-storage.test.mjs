import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createLocalRequest} from '../app/local-storage.js';
import {usageXP, trainingStatus} from '../engine/model.js';

function fixture() {
  const values = new Map();
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const request = createLocalRequest({storage});
  return {values, storage, request};
}
async function call(request, path, body, method = path === '/api/arsenal' ? 'PUT' : 'POST') {
  const response = await request(path, body === undefined ? {} : {method, body: JSON.stringify(body)});
  return {status: response.status, ...await response.json()};
}
const win = difficultyId => ({matchId: randomUUID(), difficultyId, mapId: 'base', blue: 250, red: 100, remaining: 10, outcome: 'victory'});
const report = (ownerKey, damage = 100) => ({ownerKey, matchId: randomUUID(), mapId: 'base', elapsed: 30, weapons: [{id: 'precision', damage, kills: 0, headshotKills: 0}]});

test('fresh profile and edited arsenal survive a new request instance', async () => {
  const f = fixture(), data = await call(f.request, '/api/arsenal');
  assert.equal(data.setups.length, 3); assert.equal(data.version, 0);
  data.setups[0].name = 'GitHub 保存'; data.setups[0].scope = 'holo';
  assert.equal((await call(f.request, '/api/arsenal', data)).status, 200);
  const next = await call(createLocalRequest({storage: f.storage}), '/api/arsenal');
  assert.equal(next.setups[0].scope, 'holo'); assert.equal(next.setups[0].name, 'GitHub 保存'); assert.equal(next.version, 1);
  assert.equal((await call(f.request, '/api/arsenal', data)).status, 409);
});

test('unearned weapon range changes and invalid slots are refused', async () => {
  const {request} = fixture(), data = await call(request, '/api/arsenal');
  data.setups[0].power = 120;
  assert.equal((await call(request, '/api/arsenal', data)).status, 400);
  data.setups[0].power = 80; data.slots = ['missing'];
  assert.equal((await call(request, '/api/arsenal', data)).status, 400);
  assert.equal((await call(request, '/api/arsenal')).version, 0);
});

test('only valid conquest victories unlock and record Shirane', async () => {
  const f = fixture();
  assert.equal((await call(f.request, '/api/progress', win('shirane'))).status, 403);
  for (const invalid of [{...win('bachelor'), blue: 50}, {...win('bachelor'), gameMode: 'survival'}, {...win('bachelor'), blue: 100, red: 250}]) {
    assert.equal((await call(f.request, '/api/progress', invalid)).status, 400);
  }
  for (const level of ['doctor', 'bachelor', 'master']) assert.equal((await call(f.request, '/api/progress', win(level))).status, 200);
  assert.equal((await call(f.request, '/api/progress', win('master'))).newClear, false);
  const saved = await call(f.request, '/api/progress', win('shirane'));
  assert.equal(saved.shiraneUnlocked, true); assert.equal(saved.cleared.length, 4);
  assert.deepEqual((await call(createLocalRequest({storage: f.storage}), '/api/progress')).cleared, saved.cleared);
});

test('training retries and reordered cumulative reports award each match only once', async () => {
  const f = fixture(), {ownerKey} = await call(f.request, '/api/training'), r = report(ownerKey);
  await call(f.request, '/api/training', r); await call(f.request, '/api/training', r);
  assert.equal((await call(f.request, '/api/training')).xp.precision, 10);
  const newer = {...r, weapons: [{...r.weapons[0], damage: 300}]};
  await call(f.request, '/api/training', newer); await call(f.request, '/api/training', r);
  assert.equal((await call(f.request, '/api/training')).xp.precision, 30);
  await call(f.request, '/api/training', report(ownerKey));
  assert.equal((await call(createLocalRequest({storage: f.storage}), '/api/training')).xp.precision, 40);
});

test('training ignores unsaved weapons and rejects survival and mismatched profiles', async () => {
  const {request} = fixture(), {ownerKey} = await call(request, '/api/training');
  const r = report(ownerKey); r.weapons.push({...r.weapons[0], id: 'unsaved'});
  const saved = await call(request, '/api/training', r);
  assert.equal(saved.xp.unsaved, undefined); assert.equal(saved.receipts.unsaved, undefined);
  assert.equal((await call(request, '/api/training', {...r, gameMode: 'survival'})).status, 400);
  assert.equal((await call(request, '/api/training', {...r, ownerKey: 'other'})).status, 403);
});

test('earned levels unlock ranges, preserve edits, and stop at level 10', async () => {
  const {request} = fixture(), {ownerKey} = await call(request, '/api/training');
  for (let i = 0; i < 16; i++) {
    const r = report(ownerKey, 60000);
    assert.equal(usageXP(r.weapons[0]), 1200);
    await call(request, '/api/training', r);
  }
  const {xp} = await call(request, '/api/training');
  assert.equal(trainingStatus(xp.precision).level, 10);
  const data = await call(request, '/api/arsenal'); data.setups[0].power = 120; data.setups[0].elements = 256;
  assert.equal((await call(request, '/api/arsenal', data)).status, 200);
  const copy = await call(request, '/api/arsenal'); copy.setups.push({...copy.setups[0], id: randomUUID()});
  assert.equal((await call(request, '/api/arsenal', copy)).status, 400);
});

test('blocked storage and quota errors never report a successful save', async () => {
  const f = fixture(), data = await call(f.request, '/api/arsenal');
  const request = createLocalRequest({storage: {...f.storage, setItem() {throw new Error('QuotaExceededError');}}});
  assert.equal((await call(request, '/api/arsenal', data)).status, 503);
  assert.equal(f.values.size, 0);
  const unavailable = createLocalRequest({storage: {getItem() {throw new Error('SecurityError');}}});
  assert.equal((await call(unavailable, '/api/arsenal')).status, 503);
});

test('malformed existing data is preserved instead of being reset', async () => {
  const f = fixture(); f.values.set('array-front-profile-v1', '{broken');
  assert.equal((await call(f.request, '/api/progress', win('bachelor'))).status, 503);
  assert.equal(f.values.get('array-front-profile-v1'), '{broken');
});

test('separate project keys keep saved profiles independent', async () => {
  const {storage} = fixture();
  const a = createLocalRequest({storage, key: 'game-a'}), b = createLocalRequest({storage, key: 'game-b'});
  await call(a, '/api/progress', win('doctor'));
  assert.deepEqual((await call(b, '/api/progress')).cleared, []);
});

test('cross-tab lock serializes competing edits and abort leaves data untouched', async () => {
  const f = fixture(); let tail = Promise.resolve(), locksUsed = 0;
  const locks = {request(_key, _opts, fn) {locksUsed++; const job = tail.then(fn); tail = job.catch(() => {}); return job;}};
  const a = createLocalRequest({storage: f.storage, locks}), b = createLocalRequest({storage: f.storage, locks});
  const data = await call(a, '/api/arsenal');
  const results = await Promise.all([call(a, '/api/arsenal', data), call(b, '/api/arsenal', data)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal(locksUsed, 3);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(a('/api/arsenal', {signal: controller.signal}), {name: 'AbortError'});
  assert.equal((await call(a, '/api/arsenal')).version, 1);
});
