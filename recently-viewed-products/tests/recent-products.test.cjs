'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, CookieJar } = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '..', 'one-recent-products.v1.js'), 'utf8');
const targetId = 'one-recent-products-159b7d2a-5b87-4caa-a981-c6930a4a587f';
const cookieName = '__Host-one_recent_products';
const fixturePath = '/format-lemezfuro-extra-rovid-din1897-dk77-hss-3-2mm-f111139-id-111139';
const sample = {
  id: '111139', slug: '111139', status: 'ACTIVE',
  name: 'Format lemezfúró extra rövid DIN1897 DK77 HSS 3.2mm F111139',
  url: fixturePath,
  photos: [{ url: 'https://static.besttool.hu/11/11/39/1/SMALL_100.webp?hash=8684e5ef8540a7d15c84449cdea5ec44' }]
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 1800) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (check()) return; await pause(5); }
  assert.fail('Condition did not settle');
}
function product(id, overrides = {}) {
  return { id, slug: id.toLowerCase(), status: 'ACTIVE', name: 'Termék ' + id,
    url: '/termek-id-' + id.toLowerCase(), photos: [], ...overrides };
}
function fixture(options = {}) {
  const jar = new CookieJar();
  const dom = new JSDOM('<!doctype html><html><head></head><body>' +
    (options.noTarget ? '' : '<div id="' + targetId + '" hidden style="display:none"></div>') +
    '</body></html>', {
    url: 'https://besttool.hu' + (options.path || fixturePath), runScripts: 'outside-only',
    pretendToBeVisual: true, cookieJar: jar
  });
  const w = dom.window;
  const products = new Map([['111139', sample]]);
  for (let i = 1; i <= 8; i++) products.set(String(i), product(String(i)));
  const subscribers = new Set(), routerHooks = new Set(), calls = [], errors = [];
  const state = { auth: { accessToken: null, sub: null, org: null },
    account: { client: { id: null } }, config: { tenantKey: 'fetis' } };
  const route = { name: (options.path && !options.path.includes('-id-')) ? 'index' : 'product-page' };
  const nuxt = {
    $route: route,
    $store: {
      state,
      subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
    },
    $api: { catalog: { app: {
      async getProductBySlug(slug) {
        calls.push({ type: 'current', slug, token: state.auth.accessToken });
        if (options.current) return options.current(slug, state);
        const p = [...products.values()].find(p => p.slug === slug);
        if (!p) throw { response: { status: 404 } };
        return { data: p };
      },
      async getProductsListById(flag, ids) {
        calls.push({ type: 'list', flag, ids: [...ids], token: state.auth.accessToken });
        if (options.list) return options.list(ids, state);
        return { data: [...ids].reverse().map(id => products.get(id)).filter(Boolean) };
      }
    } } },
    $router: {
      afterEach(fn) { routerHooks.add(fn); return () => routerHooks.delete(fn); },
      push(url) { navigate(url); return Promise.resolve(); }
    }
  };
  w.OneRecentProductsConfig = {
    debounceMs: 5, requestTimeoutMs: 300, retryDelayMs: 10, appWaitMs: 300,
    ...(options.config || {})
  };
  for (const storage of ['localStorage', 'sessionStorage', 'indexedDB']) {
    Object.defineProperty(w, storage, { configurable: true, get() {
      assert.fail('Forbidden storage used: ' + storage);
    } });
  }
  w.fetch = () => assert.fail('Module must use the existing ONe client');
  w.document.addEventListener('one-recent-products-error', e => errors.push(e.detail));
  if (!options.delayedApp) w.$nuxt = nuxt;
  function navigate(url) {
    const next = new URL(url, w.location.origin);
    w.dispatchEvent(new w.CustomEvent('one-route-change', { detail: { to: { path: next.pathname } } }));
    w.history.pushState({}, '', url);
    route.name = next.pathname.includes('-id-') ? 'product-page' : 'index';
    [...routerHooks].forEach(fn => fn());
  }
  function history() {
    const match = w.document.cookie.split(';').map(s => s.trim())
      .find(s => s.startsWith(cookieName + '='));
    return match ? JSON.parse(decodeURIComponent(match.slice(cookieName.length + 1))).ids : [];
  }
  function seed(ids) {
    w.document.cookie = cookieName + '=' + encodeURIComponent(JSON.stringify({ v: 1, ids })) +
      '; Path=/; Secure; SameSite=Lax';
  }
  function mountTarget() {
    const node = w.document.createElement('div');
    node.id = targetId; node.hidden = true; w.document.body.appendChild(node);
    return node;
  }
  w.eval(source);
  function close() { if (w.OneRecentlyViewed) w.OneRecentlyViewed.destroy(); w.close(); }
  return { w, jar, products, calls, errors, state, nuxt, navigate, history, seed, mountTarget,
    subscribers, routerHooks, close,
    cards: () => [...w.document.querySelectorAll('.one-rv__sku')].map(e => e.textContent.replace('Cikkszám: ', '')),
    ready: () => w.OneRecentlyViewed.getState().status === 'ready',
    mutate: fn => { fn(state); [...subscribers].forEach(cb => cb({}, state)); }
  };
}
test('Actual besttool product fixture renders and writes a host-only session cookie', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    assert.deepEqual(f.history(), ['111139']);
    assert.deepEqual(f.cards(), ['111139']);
    assert.equal(f.w.document.querySelector('.one-rv__name').textContent, sample.name);
    assert.equal(f.w.document.querySelector('.one-rv__link').getAttribute('href'), fixturePath);
    const cookies = f.jar.getCookiesSync('https://besttool.hu/');
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].key, cookieName);
    assert.equal(cookies[0].expires, 'Infinity');
    assert.equal(cookies[0].hostOnly, true);
    assert.equal(cookies[0].secure, true);
    assert.equal(cookies[0].sameSite, 'lax');
    assert.equal(cookies[0].path, '/');
    assert.equal(f.w.document.getElementById(targetId).hidden, false);
  } finally { f.close(); }
});
test('Seven visits retain exactly six unique IDs, MRU order; query/hash does not reorder', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    for (let i = 1; i <= 7; i++) {
      f.navigate('/termek-id-' + i);
      await until(() => f.ready() && f.history()[0] === String(i));
    }
    assert.deepEqual(f.history(), ['7','6','5','4','3','2']);
    assert.deepEqual(f.cards(), ['7','6','5','4','3','2']);
    f.navigate('/termek-id-3');
    await until(() => f.ready() && f.history()[0] === '3');
    assert.deepEqual(f.history(), ['3','7','6','5','4','2']);
    const before = f.history();
    f.navigate('/termek-id-3?test=1#details');
    await until(f.ready);
    assert.deepEqual(f.history(), before);
    assert.ok(f.calls.filter(c => c.type === 'list').every(c => c.flag === true && c.ids.length <= 6));
  } finally { f.close(); }
});
test('Leading zero and case-sensitive SKU are preserved, slug is resolved to canonical ID', async () => {
  const f = fixture({ path: '/termek-id-ab_0001', delayedApp: true });
  try {
    f.products.set('AB_0001', product('AB_0001'));
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    assert.deepEqual(f.history(), ['AB_0001']);
    assert.deepEqual(f.cards(), ['AB_0001']);
  } finally { f.close(); }
});
test('Late container and replacement container remount the cards without new requests', async () => {
  const f = fixture({ noTarget: true });
  try {
    await until(f.ready);
    assert.deepEqual(f.history(), ['111139']);
    f.mountTarget();
    await until(() => f.cards().length === 1);
    const count = f.calls.length;
    f.w.document.getElementById(targetId).remove();
    f.mountTarget();
    await until(() => f.cards().length === 1);
    assert.equal(f.calls.length, count);
    assert.equal(f.w.document.querySelectorAll('#one-recent-products-style').length, 1);
  } finally { f.close(); }
});
test('Slower current-product response from an abandoned route cannot update history', async () => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const f = fixture({ path: '/termek-id-1', current: slug =>
    slug === '1' ? delayed : Promise.resolve({ data: product(slug) }) });
  try {
    await until(() => f.calls.some(c => c.slug === '1'));
    f.navigate('/termek-id-2');
    await until(() => f.ready() && f.history()[0] === '2');
    release({ data: product('1') });
    await pause(25);
    assert.deepEqual(f.history(), ['2']);
    assert.deepEqual(f.cards(), ['2']);
  } finally { f.close(); }
});
test('Previous buyer response is discarded; current ONe client is reused after buyer change', async () => {
  let release;
  let first = true;
  const delayed = new Promise(resolve => { release = resolve; });
  const f = fixture({ list: ids => {
    if (first) { first = false; return delayed; }
    return Promise.resolve({ data: ids.map(id => ({ ...sample, id, name: 'Aktuális vevő' })) });
  } });
  try {
    await until(() => f.calls.some(c => c.type === 'list'));
    f.mutate(s => { s.auth.accessToken = 'test-only-token'; s.account.client.id = 'buyer-2'; });
    await until(f.ready);
    release({ data: [{ ...sample, name: 'Régi vevő' }] });
    await pause(20);
    assert.equal(f.w.document.querySelector('.one-rv__name').textContent, 'Aktuális vevő');
    assert.equal(f.calls.at(-1).token, 'test-only-token');
    assert.ok(!f.w.document.cookie.includes('token'));
    assert.ok(!JSON.stringify(f.w.OneRecentlyViewed.getState()).includes('token'));
  } finally { f.close(); }
});
test('Consent denial prevents API requests and storage; later grant enables the module', async () => {
  let allowed = false;
  const f = fixture({ config: { canUseCookie: () => allowed } });
  try {
    await until(() => f.w.OneRecentlyViewed.getState().status === 'disabled');
    assert.equal(f.calls.length, 0);
    assert.equal(f.w.document.cookie, '');
    allowed = true;
    f.w.OneRecentlyViewed.refresh();
    await until(f.ready);
    allowed = false;
    f.w.OneRecentlyViewed.refresh();
    await until(() => f.w.OneRecentlyViewed.getState().status === 'disabled');
    assert.equal(f.w.document.getElementById(targetId).hidden, true);
  } finally { f.close(); }
});
test('Inactive, omitted and cross-origin products are excluded; names are text, not HTML', async () => {
  const f = fixture({ path: '/', delayedApp: true });
  try {
    f.seed(['1','2','3','4','5','6']);
    f.products.set('1', product('1', { name: '<img src=x onerror=alert(1)>' }));
    f.products.set('2', product('2', { status: 'DRAFT' }));
    f.products.set('3', product('3', { url: 'https://foreign.example/product-id-3' }));
    f.products.set('4', product('4', { url: 'javascript:alert(1)' }));
    f.products.delete('5');
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    assert.deepEqual(f.cards(), ['1','6']);
    assert.equal(f.w.document.querySelector('.one-rv__name').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(f.w.document.querySelectorAll('.one-rv__name img').length, 0);
  } finally { f.close(); }
});
test('Malformed cookie is replaced by a valid one on the next actual visit', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.w.document.cookie = cookieName + '=%broken; Path=/; Secure; SameSite=Lax';
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    assert.deepEqual(f.history(), ['111139']);
  } finally { f.close(); }
});
test('Blocked cookies produce no in-memory history fallback', async () => {
  const f = fixture({ delayedApp: true });
  try {
    Object.defineProperty(f.w.document, 'cookie', { configurable: true, get: () => '', set: () => {} });
    f.w.$nuxt = f.nuxt;
    await until(() => f.w.OneRecentlyViewed.getState().status === 'cookies-unavailable');
    assert.equal(f.calls.filter(c => c.type === 'list').length, 0);
    assert.equal(f.cards().length, 0);
  } finally { f.close(); }
});
test('403 is not retried and only sanitized error information is exposed', async () => {
  const f = fixture({ current: () => Promise.reject({
    response: { status: 403 }, config: { headers: { Authorization: 'never-emit-this' } }
  }) });
  try {
    await until(() => f.errors.length === 1);
    await pause(50);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.errors)), [{ stage: 'current-product', code: 403 }]);
    assert.equal(f.w.document.getElementById(targetId).hidden, true);
  } finally { f.close(); }
});
test('Transient failures have a finite three-attempt budget', async () => {
  const f = fixture({ current: () => Promise.reject(new Error('temporary')) });
  try {
    await until(() => f.errors.length === 3);
    await pause(50);
    assert.equal(f.calls.length, 3);
  } finally { f.close(); }
});
test('Duplicate script load does not install duplicate route hooks or duplicate cards', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    const original = f.w.OneRecentlyViewed;
    f.w.eval(source);
    await until(f.ready);
    assert.equal(f.w.OneRecentlyViewed, original);
    assert.equal(f.routerHooks.size, 1);
    assert.equal(f.subscribers.size, 1);
    assert.equal(f.cards().length, 1);
  } finally { f.close(); }
});
test('Native card click uses the ONe router; Ctrl-click remains a normal anchor', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    const link = f.w.document.querySelector('.one-rv__link');
    const normal = new f.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    assert.equal(link.dispatchEvent(normal), false);
    const modified = new f.w.MouseEvent('click', {
      bubbles: true, cancelable: true, button: 0, ctrlKey: true
    });
    assert.equal(link.dispatchEvent(modified), true);
  } finally { f.close(); }
});
test('Non-product page does not add its path and revisit does reorder the current product', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    f.navigate('/termek-id-1'); await until(() => f.ready() && f.history()[0] === '1');
    f.navigate('/search?q=termek-id-2'); await until(f.ready);
    assert.deepEqual(f.history(), ['1','111139']);
    f.navigate(fixturePath); await until(() => f.ready() && f.history()[0] === '111139');
    assert.deepEqual(f.history(), ['111139','1']);
  } finally { f.close(); }
});
test('Clear removes only the module cookie; destroy removes subscriptions and observers', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    f.w.document.cookie = 'unrelated=keep; Path=/; Secure';
    f.w.OneRecentlyViewed.clear();
    assert.deepEqual(f.history(), []);
    assert.ok(f.w.document.cookie.includes('unrelated=keep'));
    assert.equal(f.w.document.getElementById(targetId).hidden, true);
    f.w.OneRecentlyViewed.destroy();
    assert.equal(f.subscribers.size, 0); assert.equal(f.routerHooks.size, 0);
    assert.equal(f.w.OneRecentlyViewed, undefined);
  } finally { f.close(); }
});
test('Vue clearing the children of the same target remounts content without refetching', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    const count = f.calls.length;
    f.w.document.getElementById(targetId).replaceChildren();
    await until(() => f.cards().length === 1);
    assert.equal(f.calls.length, count);
  } finally { f.close(); }
});
test('Popstate rechecks the actual current path and reorders a previous product', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    f.navigate('/termek-id-1'); await until(() => f.ready() && f.history()[0] === '1');
    f.w.history.replaceState({}, '', fixturePath);
    f.w.dispatchEvent(new f.w.PopStateEvent('popstate'));
    await until(() => f.ready() && f.history()[0] === '111139');
    assert.deepEqual(f.history(), ['111139','1']);
  } finally { f.close(); }
});
test('An announced but cancelled route does not poll indefinitely or record its product', async () => {
  const f = fixture({ config: { appWaitMs: 25 } });
  try {
    await until(f.ready);
    f.w.dispatchEvent(new f.w.CustomEvent('one-route-change', {
      detail: { to: { path: '/termek-id-2' } }
    }));
    await until(f.ready);
    assert.deepEqual(f.history(), ['111139']);
    assert.ok(!f.calls.some(c => c.slug === '2'));
  } finally { f.close(); }
});
