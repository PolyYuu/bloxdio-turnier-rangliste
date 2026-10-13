/* Run with node --test tests/phase-a-accounts.test.cjs.
 * HUB_PHASE_A_SOURCE may point at a saved, local baseline index.html.
 * The real inline API and renderers execute in a VM; all data and sessions are synthetic.
 * No network access, real accounts, production writes, or private sources are involved.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.HUB_PHASE_A_SOURCE || path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const apiSource = scripts.find(s => s.includes('window.HubAPI = (() =>'));
const uiSource = scripts.find(s => s.includes('async function renderAdminAccountPlayers('));
assert.ok(apiSource, 'The inline HubAPI must exist');
assert.ok(uiSource, 'The current account/social UI must exist');

function declaration(name) {
  const start = uiSource.search(new RegExp('^  (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `${name} must exist in the real UI`);
  const nextLine = uiSource.indexOf('\n', start) + 1;
  const rest = uiSource.slice(nextLine);
  const end = rest.search(/^\s{0,2}(?:async )?function \w+\(/m);
  assert.notEqual(end, -1, `${name} must have a following function declaration`);
  return uiSource.slice(start, nextLine + end).trim();
}

const fixtures = [
  { id: 'self', current_name: 'OwnHub', active: true, account: true, rating: 1400 },
  { id: 'active', current_name: 'ActiveHub', active: true, account: true, rating: 1550, is_ranked: true, is_online: true, last_seen: '2026-10-13T10:00:00Z' },
  { id: 'legacy', current_name: 'ImportTestB', active: true, account: false, rating: 1700, is_ranked: true },
  { id: 'deleted', current_name: 'DeletedTest', active: false, account: false, rating: 1800 },
  { id: 'test5', current_name: 'TestAccount5', active: true, account: true, rating: 1621, peak_rating: 1635, is_ranked: true, is_online: false },
  { id: 'literal', current_name: '50%_"quoted\'Hub', active: true, account: true, rating: 1100 },
];
const clone = x => JSON.parse(JSON.stringify(x));
const accounts = () => clone(fixtures.filter(p => p.active && p.account));
const pending = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

function apiHarness(options = {}) {
  const calls = [];
  const state = { session: options.session === undefined ? { user: { id: 'auth-self' }, access_token: 'synthetic' } : options.session };
  const client = {
    auth: { getSession: async () => { calls.push({ kind: 'session' }); return { data: { session: state.session }, error: options.sessionError || null }; } },
    rpc: async (name, args) => {
      calls.push({ kind: 'rpc', name, args: clone(args) });
      if (options.rpcError) return { data: null, error: options.rpcError };
      if (options.rpcData !== undefined) return { data: options.rpcData, error: null };
      if (name === 'search_hub_friend_candidates') {
        const query = args.p_query.toLowerCase();
        // Models the inspected RPC contract; directory deliberately contains broader history.
        return { data: accounts().filter(p => p.id !== 'self' && p.current_name.toLowerCase().includes(query)), error: null };
      }
      if (name === 'admin_get_account_players') return { data: accounts(), error: null };
      return { data: clone(fixtures), error: null };
    },
    from: table => {
      calls.push({ kind: 'from', table });
      let rows = clone(fixtures);
      const chain = {
        select: columns => { calls.push({ kind: 'select', columns }); return chain; },
        ilike: (column, pattern) => { calls.push({ kind: 'ilike', column, pattern }); const needle = pattern.slice(1, -1).replace(/\\([%_])/g, '$1').toLowerCase(); rows = rows.filter(p => String(p[column]).toLowerCase().includes(needle)); return chain; },
        order: (column, ordering) => { calls.push({ kind: 'order', column, ordering: clone(ordering) }); rows.sort((a, b) => Number(b[column]) - Number(a[column])); return chain; },
        limit: limit => { calls.push({ kind: 'limit', limit }); rows = rows.slice(0, limit); return chain; },
        then: (resolve, reject) => Promise.resolve({ data: rows, error: options.directoryError || null }).then(resolve, reject),
      };
      return chain;
    },
  };
  const window = { supabase: { createClient: () => client } };
  vm.runInNewContext(apiSource, { window, fetch: () => { throw new Error('Network forbidden in regression tests'); } });
  return { api: window.HubAPI, calls, state };
}

function uiHarness(options = {}) {
  const calls = [];
  const elements = new Map();
  for (const id of ['friendSearchResults', 'friendSearchInput', 'friendSearchButton', 'friendList', 'friendCount', 'friendRequestList', 'cupInviteList', 'friendRequestCount', 'cupInviteCount', 'communityNoticeDot', 'v3AdminAccountSearch', 'v3AdminOnlineBadge', 'v3AdminAccountOnlineCount', 'v3AdminAccountOfflineCount', 'v3AdminAccountOnline', 'v3AdminAccountOffline']) {
    elements.set('#' + id, { _html: '', _text: '', get innerHTML() { return this._html; }, set innerHTML(value) { this._html = value; this._text = ''; }, get textContent() { return this._text; }, set textContent(value) { this._text = value; this._html = ''; }, value: '', listeners: [], addEventListener(type, callback, capture) { this.listeners.push({ type, callback, capture }); } });
  }
  const live = { session: options.session === undefined ? { user: { id: 'auth-self' } } : options.session, player: { id: 'self' }, isAdmin: options.isAdmin !== false };
  const blankSocial = () => ({ friends: [], incoming_friend_requests: [], outgoing_friend_requests: [], cup_invites: [], my_registrations: [] });
  const real = { social: blankSocial(), adminAccounts: [] };
  const lookup = selector => elements.get(selector) || null;
  let now = 0, timerId = 0;
  const timers = new Map();
  const fakeSetTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { due: now + delay, callback }); return id; };
  const fakeClearTimeout = id => timers.delete(id);
  const advance = async ms => { now += ms; const executing = []; for (const [id, timer] of [...timers]) { if (timer.due <= now && timers.has(id)) { timers.delete(id); executing.push(timer.callback()); } } await Promise.all(executing); };
  const documentEvents = new Map();
  let authCallback;
  const api = {
    client: { auth: { onAuthStateChange: callback => { authCallback = callback; } } },
    searchHubFriendCandidates: async q => { calls.push({ kind: 'candidates', q }); return options.search ? options.search(q) : accounts().filter(p => p.id !== 'self' && p.current_name.toLowerCase().includes(q.toLowerCase())); },
    searchPlayers: async q => { calls.push({ kind: 'directory', q }); return options.search ? options.search(q) : clone(fixtures).filter(p => p.current_name.toLowerCase().includes(q.toLowerCase())); },
    adminGetAccountPlayers: async () => { calls.push({ kind: 'accounts' }); return options.admin ? options.admin() : accounts(); },
    adminGetGlobalPlayers: async () => { calls.push({ kind: 'globals' }); return clone(fixtures); },
    getSocialState: async () => { calls.push({ kind: 'social' }); return options.social ? options.social() : blankSocial(); },
    getGlobalPlayers: async () => clone(fixtures),
  };
  const context = vm.createContext({ api, live, real, $: lookup, copy: en => en, avatarImg: () => '<img alt="">', viewerCanSeeRank: () => false, rankName: () => 'Rank', core: { rankKey: () => 'gold', rankLabel: () => 'Gold' }, ensureAdminPrimaryNav: () => {}, renderMateHint: () => {}, refreshFakeProfiles: async () => {}, renderRealRanking: () => {}, renderOwnOverview: async () => {}, refreshCups: async () => {}, ensureFinalizeButton: () => {}, startPresence: () => {}, location: { hash: '#overview' }, state: {}, document: { addEventListener: (type, callback) => documentEvents.set(type, callback) }, console: { error: () => {} }, setTimeout: options.fakeTimers ? fakeSetTimeout : setTimeout, clearTimeout: options.fakeTimers ? fakeClearTimeout : clearTimeout });
  const escLine = uiSource.match(/^  const esc=.*$/m)?.[0];
  assert.ok(escLine, 'Use the real HTML escaping helper');
  const socialStart = uiSource.indexOf('// ---------- social ----------');
  const socialEnd = uiSource.indexOf('// ---------- Cups ----------', socialStart);
  assert.ok(socialStart >= 0 && socialEnd > socialStart, 'Extract the real social block including its request state');
  vm.runInContext(escLine + '\n' + uiSource.slice(socialStart, socialEnd) + '\n' + declaration('relativeSeen') + '\n' + declaration('adminAccountRow') + '\n' + declaration('renderAdminAccountPlayers') + '\nthis.renderFriendSearch=renderFriendSearch; this.renderAdminAccountPlayers=renderAdminAccountPlayers;', context);
  if (/^  function invalidateAccountViews\(/m.test(uiSource)) vm.runInContext(declaration('invalidateAccountViews'), context);
  const inputBinding = uiSource.match(/^  \$\('#friendSearchInput'\).*$/m)?.[0];
  if (inputBinding) vm.runInContext(inputBinding, context);
  const authBinding = uiSource.match(/^      api\.client\.auth\.onAuthStateChange.*$/m)?.[0];
  if (authBinding) vm.runInContext(authBinding, context);
  vm.runInContext(declaration('refreshForAuth') + "\nthis.refreshForAuth=refreshForAuth; this.refreshSocial=refreshSocial; this.scheduleFriendSearch=typeof scheduleFriendSearch==='function'?scheduleFriendSearch:undefined; this.invalidateAccountViews=typeof invalidateAccountViews==='function'?invalidateAccountViews:undefined;", context);
  return { context, calls, elements, live, real, api, advance, timers, documentEvents, get: lookup, auth: (...args) => authCallback(...args) };
}

test('friend API uses the authenticated dedicated RPC; directory imports are excluded', async () => {
  const h = apiHarness();
  const rows = await h.api.searchHubFriendCandidates('  Hub  ');
  assert.deepEqual(rows.map(p => p.id).sort(), ['active', 'literal']);
  assert.equal(h.calls.some(c => c.kind === 'from'), false);
  assert.deepEqual(h.calls.filter(c => c.kind === 'rpc'), [{ kind: 'rpc', name: 'search_hub_friend_candidates', args: { p_query: 'Hub' } }]);
  assert.equal(h.calls.some(c => c.kind === 'session'), true);
});

test('friend API excludes imported, deleted and own profiles while accepting TestAccount5', async () => {
  const h = apiHarness();
  assert.deepEqual(clone(await h.api.searchHubFriendCandidates('ImportTestB')), []);
  assert.deepEqual(clone(await h.api.searchHubFriendCandidates('DeletedTest')), []);
  assert.deepEqual(clone(await h.api.searchHubFriendCandidates('OwnHub')), []);
  assert.deepEqual((await h.api.searchHubFriendCandidates('TestAccount5')).map(p => p.id), ['test5']);
});

test('friend API sends percent, underscore, and quotes as literal RPC arguments', async () => {
  const h = apiHarness();
  const q = '%_"quoted\'';
  const result = await h.api.searchHubFriendCandidates('  ' + q + '  ');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'literal');
  assert.equal(h.calls.find(c => c.kind === 'rpc').args.p_query, q);
  assert.equal(h.calls.some(c => c.kind === 'from' || c.kind === 'ilike'), false);
});

test('friend API ignores empty and oversized queries without touching the RPC', async () => {
  const h = apiHarness();
  for (const q of ['', '   ', null, undefined, 'a'.repeat(65), '😀'.repeat(65)]) assert.deepEqual(clone(await h.api.searchHubFriendCandidates(q)), []);
  assert.equal(h.calls.some(c => c.kind === 'rpc' || c.kind === 'from'), false);
});

test('friend API accepts one and 64 Unicode characters, counting codepoints', async () => {
  const h = apiHarness({ rpcData: [] });
  for (const q of ['x', 'a'.repeat(64), '😀'.repeat(64)]) await h.api.searchHubFriendCandidates(q);
  assert.deepEqual(h.calls.filter(c => c.kind === 'rpc').map(c => c.args.p_query), ['x', 'a'.repeat(64), '😀'.repeat(64)]);
});

test('friend API returns no candidates for missing sessions without querying the RPC', async () => {
  const h = apiHarness({ session: null });
  assert.deepEqual(clone(await h.api.searchHubFriendCandidates('Hub')), []);
  assert.equal(h.calls.some(c => c.kind === 'rpc' || c.kind === 'from'), false);
});

test('friend API normalizes null data and propagates server/session errors', async () => {
  assert.deepEqual(clone(await apiHarness({ rpcData: null }).api.searchHubFriendCandidates('Hub')), []);
  const denied = new Error('candidate permission denied');
  await assert.rejects(() => apiHarness({ rpcError: denied }).api.searchHubFriendCandidates('Hub'), /candidate permission denied/);
  await assert.rejects(() => apiHarness({ sessionError: new Error('session failed') }).api.searchHubFriendCandidates('Hub'), /session failed/);
});

test('public directory search and ranked history remain broad and keep wildcard escaping', async () => {
  const h = apiHarness({ session: null });
  assert.equal((await h.api.searchPlayers('ImportTestB'))[0].id, 'legacy');
  assert.equal((await h.api.searchPlayers('%_'))[0].id, 'literal');
  const broad = await h.api.getGlobalPlayers();
  assert.ok(broad.some(p => p.id === 'legacy'));
  assert.equal(h.calls.find(c => c.kind === 'ilike' && c.pattern.includes('\\%')).pattern, '%\\%\\_%');
  assert.ok(h.calls.some(c => c.kind === 'order' && c.column === 'rating' && c.ordering.ascending === false));
});

test('friend renderer calls only candidates and excludes imported/deleted profiles', async () => {
  const h = uiHarness();
  await h.context.renderFriendSearch('ImportTestB');
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /ImportTestB/);
  await h.context.renderFriendSearch('DeletedTest');
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /DeletedTest/);
  await h.context.renderFriendSearch('ActiveHub');
  assert.match(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
  assert.equal(h.calls.some(c => c.kind === 'directory'), false);
});

test('friend renderer suppresses own profile and retains friend/pending states', async () => {
  const h = uiHarness({ search: () => [fixtures[0], fixtures[1], fixtures[4]] });
  h.real.social.friends = [{ id: 'active' }];
  h.real.social.outgoing_friend_requests = [{ receiver_id: 'test5' }];
  await h.context.renderFriendSearch('Hub');
  const output = h.get('#friendSearchResults').innerHTML;
  assert.doesNotMatch(output, /OwnHub|data-v3-friend-add="self"/);
  assert.match(output, /Friend/);
  assert.doesNotMatch(output, /data-v3-friend-add="active"/);
  assert.match(output, /data-v3-friend-add="test5" disabled/);
  assert.match(output, /Request sent/);
});

test('friend renderer makes no unauthenticated request and clears old results', async () => {
  const h = uiHarness({ session: null });
  h.get('#friendSearchResults').innerHTML = 'old result';
  await h.context.renderFriendSearch('Hub');
  assert.equal(h.calls.length, 0);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /old result|ActiveHub/);
});

test('friend renderer escapes malicious names and server errors', async () => {
  const h = uiHarness({ search: () => [{ id: 'active', current_name: '<img src=x onerror=alert(1)>' }] });
  await h.context.renderFriendSearch('x');
  assert.match(h.get('#friendSearchResults').innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /<img src=x/);
  h.api.searchHubFriendCandidates = h.api.searchPlayers = async () => { throw new Error('<script>bad()</script>'); };
  await h.context.renderFriendSearch('y');
  assert.match(h.get('#friendSearchResults').innerHTML, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /<script>/);
});

test('friend renderer ignores stale success when a newer search completes first', async () => {
  const first = pending(), second = pending();
  const h = uiHarness({ search: q => q === 'first' ? first.promise : second.promise });
  const a = h.context.renderFriendSearch('first'), b = h.context.renderFriendSearch('second');
  second.resolve([{ id: 'new', current_name: 'NewestHub' }]);
  await b;
  first.resolve([{ id: 'old', current_name: 'StaleHub' }]);
  await a;
  assert.match(h.get('#friendSearchResults').innerHTML, /NewestHub/);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /StaleHub/);
});

test('friend renderer ignores stale errors after a newer successful search', async () => {
  const first = pending();
  const h = uiHarness({ search: q => q === 'first' ? first.promise : [{ id: 'new', current_name: 'NewestHub' }] });
  const a = h.context.renderFriendSearch('first');
  await h.context.renderFriendSearch('second');
  first.reject(new Error('stale failure'));
  await a;
  assert.match(h.get('#friendSearchResults').innerHTML, /NewestHub/);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /stale failure/);
});

test('clearing a search prevents in-flight results from reappearing', async () => {
  const request = pending();
  const h = uiHarness({ search: () => request.promise });
  const a = h.context.renderFriendSearch('Hub');
  await h.context.renderFriendSearch('   ');
  request.resolve([{ id: 'old', current_name: 'LateHub' }]);
  await a;
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
});

test('logging out during a search prevents candidates from rendering', async () => {
  const request = pending();
  const h = uiHarness({ search: () => request.promise });
  const a = h.context.renderFriendSearch('Hub');
  h.live.session = null;
  h.live.player = null;
  request.resolve([{ id: 'old', current_name: 'LateHub' }]);
  await a;
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /LateHub|data-v3-friend-add/);
});

test('changing the authenticated player during a search rejects previous results', async () => {
  const request = pending();
  const h = uiHarness({ search: () => request.promise });
  const a = h.context.renderFriendSearch('Hub');
  h.live.session = { user: { id: 'auth-other' } };
  h.live.player = { id: 'other' };
  request.resolve([{ id: 'active', current_name: 'PreviousAccountResult' }]);
  await a;
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /PreviousAccountResult/);
});

test('admin default list loads only active HUB accounts and preserves TestAccount5', async () => {
  const h = uiHarness();
  await h.context.renderAdminAccountPlayers(true);
  assert.deepEqual(h.calls, [{ kind: 'accounts' }]);
  assert.deepEqual(h.real.adminAccounts.map(p => p.id).sort(), ['active', 'literal', 'self', 'test5']);
  const output = h.get('#v3AdminAccountOnline').innerHTML + h.get('#v3AdminAccountOffline').innerHTML;
  assert.match(output, /TestAccount5/);
  assert.match(output, /1621/);
  assert.doesNotMatch(output, /ImportTestB|DeletedTest/);
});

test('admin presence and filtered counts come from account rows without global merging', async () => {
  const h = uiHarness();
  await h.context.renderAdminAccountPlayers(true);
  assert.equal(h.get('#v3AdminAccountOnlineCount').textContent, '1');
  assert.equal(h.get('#v3AdminAccountOfflineCount').textContent, '3');
  assert.equal(h.get('#v3AdminOnlineBadge').textContent, '1');
  assert.match(h.get('#v3AdminAccountOnline').innerHTML, /ActiveHub/);
  assert.doesNotMatch(h.get('#v3AdminAccountOffline').innerHTML, /ActiveHub/);
  h.get('#v3AdminAccountSearch').value = '  testACCOUNT5  ';
  await h.context.renderAdminAccountPlayers(false);
  assert.equal(h.get('#v3AdminAccountOnlineCount').textContent, '0');
  assert.equal(h.get('#v3AdminAccountOfflineCount').textContent, '1');
  assert.equal(h.get('#v3AdminOnlineBadge').textContent, '1');
  assert.match(h.get('#v3AdminAccountOffline').innerHTML, /TestAccount5/);
  assert.equal(h.calls.filter(c => c.kind === 'accounts').length, 1);
});

test('admin cached filtering avoids refetch; fresh refresh does refetch', async () => {
  const h = uiHarness();
  await h.context.renderAdminAccountPlayers(true);
  await h.context.renderAdminAccountPlayers(false);
  assert.equal(h.calls.filter(c => c.kind === 'accounts').length, 1);
  await h.context.renderAdminAccountPlayers(true);
  assert.equal(h.calls.filter(c => c.kind === 'accounts').length, 2);
  assert.equal(h.calls.some(c => c.kind === 'globals'), false);
});

test('admin renderer shows empty state for null data and escapes permission errors', async () => {
  const h = uiHarness({ admin: () => null });
  await h.context.renderAdminAccountPlayers(true);
  assert.equal(h.real.adminAccounts.length, 0);
  assert.equal(h.get('#v3AdminAccountOfflineCount').textContent, '0');
  assert.match(h.get('#v3AdminAccountOffline').innerHTML, /No player profiles match/);
  h.api.adminGetAccountPlayers = async () => { throw new Error('<b>Admin only</b>'); };
  await h.context.renderAdminAccountPlayers(true);
  assert.match(h.get('#v3AdminAccountOffline').innerHTML, /&lt;b&gt;Admin only&lt;\/b&gt;/);
  assert.doesNotMatch(h.get('#v3AdminAccountOffline').innerHTML, /<b>Admin only/);
});

test('non-admin cannot load or render account management', async () => {
  const h = uiHarness({ isAdmin: false });
  await h.context.renderAdminAccountPlayers(true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.get('#v3AdminAccountOnline').innerHTML, '');
  assert.equal(h.get('#v3AdminAccountOffline').innerHTML, '');
});

test('admin account API preserves the server permission boundary', async () => {
  const h = apiHarness({ rpcError: new Error('Admin only') });
  await assert.rejects(() => h.api.adminGetAccountPlayers(), /Admin only/);
  assert.deepEqual(h.calls, [{ kind: 'rpc', name: 'admin_get_account_players', args: {} }]);
});

test('debounce sends only the latest query after 180 ms and clears previous results immediately', async () => {
  const h = uiHarness({ fakeTimers: true });
  h.get('#friendSearchResults').innerHTML = 'previous';
  h.context.scheduleFriendSearch('Act');
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
  await h.advance(100);
  h.context.scheduleFriendSearch('ActiveHub');
  await h.advance(179);
  assert.equal(h.calls.length, 0);
  await h.advance(1);
  assert.deepEqual(h.calls, [{ kind: 'candidates', q: 'ActiveHub' }]);
  assert.match(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
});

test('debounce cancels a pending query when input is cleared or session is missing', async () => {
  const h = uiHarness({ fakeTimers: true });
  h.context.scheduleFriendSearch('ActiveHub');
  h.context.scheduleFriendSearch('  ');
  await h.advance(1000);
  assert.equal(h.calls.length, 0);
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
  h.live.session = null;
  h.context.scheduleFriendSearch('ActiveHub');
  await h.advance(1000);
  assert.equal(h.calls.length, 0);
});

test('input scheduling invalidates an already running response before the next timer fires', async () => {
  const request = pending();
  const h = uiHarness({ fakeTimers: true, search: () => request.promise });
  const old = h.context.renderFriendSearch('Old');
  h.context.scheduleFriendSearch('New');
  request.resolve([{ id: 'old', current_name: 'StaleBeforeDebounce' }]);
  await old;
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
  assert.equal(h.calls.length, 1);
});

test('admin renderer makes no request without a session even if an old admin flag remains', async () => {
  const h = uiHarness({ session: null });
  await h.context.renderAdminAccountPlayers(true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.get('#v3AdminAccountOffline').innerHTML, '');
});

test('admin renderer ignores old refresh success when a newer refresh completed', async () => {
  const first = pending();
  let n = 0;
  const h = uiHarness({ admin: () => ++n === 1 ? first.promise : [fixtures[4]] });
  const a = h.context.renderAdminAccountPlayers(true);
  await h.context.renderAdminAccountPlayers(true);
  first.resolve([fixtures[1]]);
  await a;
  assert.deepEqual(h.real.adminAccounts.map(p => p.id), ['test5']);
  assert.match(h.get('#v3AdminAccountOffline').innerHTML, /TestAccount5/);
  assert.doesNotMatch(h.get('#v3AdminAccountOnline').innerHTML, /ActiveHub/);
});

test('admin renderer ignores old refresh errors after a successful newer refresh', async () => {
  const first = pending();
  let n = 0;
  const h = uiHarness({ admin: () => ++n === 1 ? first.promise : [fixtures[4]] });
  const a = h.context.renderAdminAccountPlayers(true);
  await h.context.renderAdminAccountPlayers(true);
  first.reject(new Error('old denied'));
  await a;
  assert.deepEqual(h.real.adminAccounts.map(p => p.id), ['test5']);
  assert.doesNotMatch(h.get('#v3AdminAccountOffline').innerHTML, /old denied/);
});

test('admin errors clear cached accounts, old online rows and all counts', async () => {
  const h = uiHarness();
  await h.context.renderAdminAccountPlayers(true);
  h.api.adminGetAccountPlayers = async () => { throw new Error('permission revoked'); };
  await h.context.renderAdminAccountPlayers(true);
  assert.equal(h.real.adminAccounts.length, 0);
  assert.equal(h.get('#v3AdminAccountOnline').innerHTML, '');
  assert.equal(h.get('#v3AdminOnlineBadge').textContent, '');
  assert.equal(h.get('#v3AdminAccountOnlineCount').textContent, '0');
  assert.equal(h.get('#v3AdminAccountOfflineCount').textContent, '0');
  assert.match(h.get('#v3AdminAccountOffline').innerHTML, /permission revoked/);
});

for (const change of ['logout', 'account change', 'admin privilege removal']) {
  test(`admin refresh rejects results after ${change}`, async () => {
    const request = pending();
    const h = uiHarness({ admin: () => request.promise });
    const a = h.context.renderAdminAccountPlayers(true);
    if (change === 'logout') h.live.session = null;
    if (change === 'account change') h.live.session = { user: { id: 'another-auth' } };
    if (change === 'admin privilege removal') h.live.isAdmin = false;
    request.resolve([fixtures[4]]);
    await a;
    assert.equal(h.real.adminAccounts.length, 0);
    assert.doesNotMatch(h.get('#v3AdminAccountOffline').innerHTML, /TestAccount5/);
  });
}

test('social refresh ignores responses belonging to a previous account', async () => {
  const request = pending();
  const h = uiHarness({ social: () => request.promise });
  const previous = h.real.social;
  const a = h.context.refreshSocial();
  h.live.session = { user: { id: 'another-auth' } };
  h.live.player = { id: 'another-player' };
  request.resolve({ friends: [fixtures[1]], incoming_friend_requests: [], outgoing_friend_requests: [], cup_invites: [], my_registrations: [] });
  await a;
  assert.equal(h.real.social, previous);
  assert.doesNotMatch(h.get('#friendList').innerHTML, /ActiveHub/);
});

test('social refresh ignores an older response after a newer one completed', async () => {
  const first = pending();
  let n = 0;
  const state = name => ({ friends: [{ id: name, current_name: name }], incoming_friend_requests: [], outgoing_friend_requests: [], cup_invites: [], my_registrations: [] });
  const h = uiHarness({ social: () => ++n === 1 ? first.promise : state('NewestFriend') });
  const a = h.context.refreshSocial();
  await h.context.refreshSocial();
  first.resolve(state('StaleFriend'));
  await a;
  assert.match(h.get('#friendList').innerHTML, /NewestFriend/);
  assert.doesNotMatch(h.get('#friendList').innerHTML, /StaleFriend/);
});

test('auth invalidation clears account/social views and rejects same-account stale responses', async () => {
  const friendRequest = pending(), adminRequest = pending(), socialRequest = pending();
  const h = uiHarness({ fakeTimers: true, search: () => friendRequest.promise, admin: () => adminRequest.promise, social: () => socialRequest.promise });
  h.real.adminAccounts = accounts();
  h.real.social.friends = [fixtures[1]];
  const friend = h.context.renderFriendSearch('Hub');
  const admin = h.context.renderAdminAccountPlayers(true);
  const social = h.context.refreshSocial();
  h.get('#v3AdminAccountOnline').innerHTML = 'previous admin rows';
  h.get('#friendSearchResults').innerHTML = 'previous candidate';
  assert.equal(typeof h.documentEvents.get('hub:auth-restored'), 'function');
  h.documentEvents.get('hub:auth-restored')();
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
  assert.equal(h.get('#v3AdminAccountOnline').innerHTML, '');
  assert.equal(h.get('#v3AdminAccountOffline').innerHTML, '');
  assert.equal(h.get('#v3AdminAccountOnlineCount').textContent, '0');
  assert.equal(h.get('#v3AdminAccountOfflineCount').textContent, '0');
  assert.equal(h.real.adminAccounts.length, 0);
  assert.equal(h.real.social, null);
  friendRequest.resolve([fixtures[1]]);
  adminRequest.resolve([fixtures[4]]);
  socialRequest.resolve({ friends: [fixtures[1]], incoming_friend_requests: [], outgoing_friend_requests: [], cup_invites: [], my_registrations: [] });
  await Promise.all([friend, admin, social]);
  assert.equal(h.real.adminAccounts.length, 0);
  assert.equal(h.real.social, null);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
  assert.doesNotMatch(h.get('#v3AdminAccountOffline').innerHTML, /TestAccount5/);
});

test('auth invalidation cancels a debounced query before it can access the API', async () => {
  const h = uiHarness({ fakeTimers: true });
  h.context.scheduleFriendSearch('ActiveHub');
  h.context.invalidateAccountViews();
  await h.advance(1000);
  assert.equal(h.calls.length, 0);
});

test('real input capture blocks legacy bubble rendering and keeps the 180 ms debounce', async () => {
  const h = uiHarness({ fakeTimers: true });
  const input = h.get('#friendSearchInput');
  let legacyCalls = 0, stopped = false;
  input.addEventListener('input', () => { ++legacyCalls; h.get('#friendSearchResults').innerHTML = 'legacy imported results'; }, false);
  const event = { target: { value: 'ActiveHub' }, stopImmediatePropagation: () => { stopped = true; }, preventDefault: () => {} };
  // DOM capture listeners on the same target precede its bubble listeners.
  for (const capture of [true, false]) for (const listener of input.listeners) if (!stopped && !!listener.capture === capture && listener.type === 'input') listener.callback(event);
  assert.equal(legacyCalls, 0);
  assert.equal(h.calls.length, 0);
  assert.doesNotMatch(h.get('#friendSearchResults').innerHTML, /legacy imported results/);
  await h.advance(180);
  assert.match(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
});

test('same-account auth restore reruns the existing friend query after invalidation', async () => {
  const h = uiHarness({ fakeTimers: true });
  h.get('#friendSearchInput').value = 'ActiveHub';
  await h.context.renderFriendSearch('ActiveHub');
  assert.match(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
  h.context.invalidateAccountViews();
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
  await h.context.refreshForAuth();
  assert.match(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
  assert.equal(h.calls.filter(c => c.kind === 'candidates').length, 2);
});

test('real auth callback invalidates views synchronously and restores current search after its timer', async () => {
  const h = uiHarness({ fakeTimers: true });
  h.get('#friendSearchInput').value = 'ActiveHub';
  h.get('#friendSearchResults').innerHTML = 'previous auth results';
  h.get('#v3AdminAccountOnline').innerHTML = 'previous admin rows';
  h.real.adminAccounts = accounts();
  h.auth('TOKEN_REFRESHED', h.live.session);
  assert.equal(h.get('#friendSearchResults').innerHTML, '');
  assert.equal(h.get('#v3AdminAccountOnline').innerHTML, '');
  assert.equal(h.real.adminAccounts.length, 0);
  await h.advance(120);
  assert.match(h.get('#friendSearchResults').innerHTML, /ActiveHub/);
});
