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
  measurementUnits: { quantityMin: 1, quantityInterval: 1, packingQuantity: 1,
    orderUnitDescription: 'db', contentUnitDescription: 'db' },
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
    url: '/termek-id-' + id.toLowerCase(), photos: [], measurementUnits: sample.measurementUnits,
    ...overrides };
}
function fixture(options = {}) {
  const jar = new CookieJar();
  const dom = new JSDOM('<!doctype html><html><head></head><body>' +
    (options.noTarget ? '' : '<div id="' + targetId + '" hidden style="display:none"></div>') +
    '</body></html>', {
    url: (options.origin || 'https://besttool.hu') + (options.path || fixturePath), runScripts: 'outside-only',
    pretendToBeVisual: true, cookieJar: jar
  });
  const w = dom.window;
  const products = new Map([['111139', sample]]);
  for (let i = 1; i <= 8; i++) products.set(String(i), product(String(i)));
  const subscribers = new Set(), routerHooks = new Set(), calls = [], errors = [];
  const state = { auth: { accessToken: null, sub: null, org: null },
    account: { client: { id: null } }, config: { tenantKey: 'fetis', currency: 'HUF', accessMode: 'OPEN' },
    layout: { currency: { code: 'HUF', iso: 'hu-HU', symbol: '' }, priceGross: false }, cart: { selectedCart: 'cart-1' },
    plugins: { allComponents: {} },
    stocks: { defaultWarehouse: 'CENTRAL', warehouses: { allIds: ['CENTRAL','LOCAL'], byId: {
      CENTRAL: { id: 'CENTRAL', name: 'Központi raktár', type: 'CENTRAL' },
      LOCAL: { id: 'LOCAL', name: 'Helyi raktár', type: 'LOCAL', parent: 'CENTRAL' }
    } } } };
  const route = { name: (options.path && !options.path.includes('-id-')) ? 'index' : 'product-page' };
  const nuxt = {
    $route: route,
    $config: { BASE_URL: options.apiBase || 'https://api-prod.onecommerce.shop' },
    $store: {
      state,
      _actions: { 'cart/addProductToCart': [() => {}] },
      subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
      async dispatch(action, payload) {
        calls.push({ type: 'cart', action, payload: JSON.parse(JSON.stringify(payload)), token: state.auth.accessToken });
        if (options.cart) return options.cart(action, payload, state);
        calls.push({ type: 'cart-refresh' });
      }
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
    } }, pricing: { app: {
      async fetchPricingForProducts(payload) {
        calls.push({ type: 'price', payload: JSON.parse(JSON.stringify(payload)), token: state.auth.accessToken,
          url: nuxt.$config.BASE_URL + '/api/v1/pricing/app/auth-optional/get-price' });
        if (options.price) return options.price(payload, state);
        return { data: payload.products.map(p => ({ productId: p.productId, quantity: p.quantity,
          priceNet: 100 * p.quantity, priceGross: 127 * p.quantity, tax: 27, additionalCosts: [] })) };
      }
    } }, stock: { app: {
      async post(path, payload, requestOptions) {
        calls.push({ type: 'stock', method: 'POST', path, payload: JSON.parse(JSON.stringify(payload)),
          options: JSON.parse(JSON.stringify(requestOptions)), token: null,
          url: nuxt.$config.BASE_URL + '/api/v1/stock/app/public' + path });
        if (options.stock) return options.stock(payload, state);
        return { data: Object.fromEntries(payload.skus.map(id => [id, { stockVisibilityMode: 'VISIBLE',
          available: true, warehouses: payload.warehouses.map(warehouseId => ({ warehouseId,
            warehouseLabel: warehouseId === 'CENTRAL' ? 'Központi raktár' : 'Helyi raktár',
            quantity: 12, largestQuantity: 12, available: true })) }])) };
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
    assert.equal(f.calls.filter(call => call.type === 'price').at(-1).token, 'test-only-token');
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

test('Prices and stock use the current ONe clients, POST bodies, canonical IDs and current cart', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.state.auth.accessToken = 'fixture-buyer-token';
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    const price = f.calls.find(call => call.type === 'price');
    assert.deepEqual(price.payload, { products: [{ productId: '111139', quantity: 1 }] });
    assert.equal(price.token, 'fixture-buyer-token');
    const stock = f.calls.find(call => call.type === 'stock');
    assert.equal(stock.method, 'POST');
    assert.equal(stock.path, '/products/stocks');
    assert.deepEqual(stock.payload, { skus: ['111139'], warehouses: ['CENTRAL','LOCAL'], cartId: 'cart-1' });
    assert.deepEqual(stock.options, { authentication: 'public' });
    assert.ok(f.w.document.querySelector('.one-rv__price').textContent.includes('100'));
    assert.match(f.w.document.querySelector('.one-rv__price').textContent, /Ft.*nettó/);
    assert.equal(f.w.document.querySelectorAll('.one-rv__stock-row').length, 2);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
    assert.deepEqual(f.history(), ['111139']);
    assert.equal(f.jar.getCookiesSync(f.w.location.origin).length, 1);
    assert.ok(!f.w.document.cookie.includes('price') && !f.w.document.cookie.includes('token'));
  } finally { f.close(); }
});

test('The module uses the preprod app clients without contacting prod', async () => {
  const f = fixture({ origin: 'https://preprod.besttool.hu', apiBase: 'https://api-preprod.login.shop' });
  try {
    await until(f.ready);
    for (const call of f.calls.filter(call => call.url)) {
      assert.ok(call.url.startsWith('https://api-preprod.login.shop/'));
      assert.ok(!call.url.includes('api-prod.'));
    }
    assert.equal(f.jar.getCookiesSync('https://besttool.hu/').length, 0);
  } finally { f.close(); }
});

test('Prices use minimum order quantity times packing; the cart receives order units', async () => {
  const f = fixture({ path: '/termek-id-1', delayedApp: true });
  try {
    f.products.set('1', product('1', { measurementUnits: { quantityMin: 2, quantityInterval: 2,
      packingQuantity: 6, orderUnitDescription: 'doboz', contentUnitDescription: 'db' } }));
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    assert.equal(f.calls.find(call => call.type === 'price').payload.products[0].quantity, 12);
    assert.match(f.w.document.querySelector('.one-rv__price').textContent, /1\s?200.*2 doboz/);
    f.w.document.querySelector('.one-rv__cart').click();
    await until(() => f.calls.some(call => call.type === 'cart-refresh'));
    assert.deepEqual(f.calls.find(call => call.type === 'cart').payload,
      { cartId: 'cart-1', newProduct: { productId: '1', amountOfProducts: 2 }, warehouseId: 'CENTRAL' });
    await until(() => f.ready() && f.w.document.querySelector('.one-rv__feedback').textContent === 'Kosárba helyezve.');
  } finally { f.close(); }
});

test('Fractional minimum quantities are preserved; invalid and overflowing units cannot be ordered', async () => {
  const f = fixture({ path: '/', delayedApp: true });
  try {
    f.seed(['1','2','3']);
    f.products.set('1', product('1', { measurementUnits: { quantityMin: 0.25, quantityInterval: 0.25,
      packingQuantity: 2, orderUnitDescription: 'm', contentUnitDescription: 'm' } }));
    f.products.set('2', product('2', { measurementUnits: { quantityMin: 0, quantityInterval: 1, packingQuantity: 1 } }));
    f.products.set('3', product('3', { measurementUnits: { quantityMin: 1e308, quantityInterval: 1, packingQuantity: 1e308 } }));
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    assert.deepEqual(f.calls.find(call => call.type === 'price').payload, { products: [{ productId: '1', quantity: 0.5 }] });
    const buttons = [...f.w.document.querySelectorAll('.one-rv__cart')];
    assert.deepEqual(buttons.map(button => button.disabled), [false,true,true]);
  } finally { f.close(); }
});

test('Gross/net and currency switches refresh the displayed customer prices', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    f.mutate(state => { state.layout.priceGross = true; });
    await until(f.ready);
    assert.match(f.w.document.querySelector('.one-rv__price').textContent, /127.*bruttó/);
    f.mutate(state => { state.layout.currency.code = 'EUR'; });
    await until(f.ready);
    assert.match(f.w.document.querySelector('.one-rv__price').textContent, /EUR|€/);
  } finally { f.close(); }
});

test('The old buyer price response is discarded after an auth change', async () => {
  let release, first = true;
  const delayed = new Promise(resolve => { release = resolve; });
  const f = fixture({ price: body => {
    if (first) { first = false; return delayed; }
    return { data: body.products.map(p => ({ productId: p.productId, quantity: p.quantity, priceNet: 222, priceGross: 282 })) };
  } });
  try {
    await until(() => f.calls.some(call => call.type === 'price'));
    f.mutate(state => { state.auth.accessToken = 'buyer-B'; state.account.client.id = 'B'; });
    await until(f.ready);
    release({ data: [{ productId: '111139', quantity: 1, priceNet: 999, priceGross: 1269 }] });
    await pause(25);
    assert.match(f.w.document.querySelector('.one-rv__price').textContent, /222/);
    assert.ok(!f.w.document.querySelector('.one-rv__price').textContent.includes('999'));
  } finally { f.close(); }
});

test('Warehouse changes discard old stock responses and use the new cart/warehouse context', async () => {
  let release, first = true;
  const delayed = new Promise(resolve => { release = resolve; });
  const f = fixture({ stock: body => {
    if (first) { first = false; return delayed; }
    return { data: { '111139': { stockVisibilityMode: 'VISIBLE', available: true,
      warehouses: [{ warehouseId: 'LOCAL', warehouseLabel: 'Új raktár', quantity: 7 }] } } };
  } });
  try {
    await until(() => f.calls.some(call => call.type === 'stock'));
    f.mutate(state => { state.stocks.defaultWarehouse = 'LOCAL'; state.cart.selectedCart = 'cart-2'; });
    await until(f.ready);
    release({ data: { '111139': { stockVisibilityMode: 'VISIBLE', available: true,
      warehouses: [{ warehouseId: 'CENTRAL', warehouseLabel: 'Régi raktár', quantity: 999 }] } } });
    await pause(25);
    assert.equal(f.w.document.querySelector('.one-rv__stock-row').textContent, 'Új raktár7 db');
    f.w.document.querySelector('.one-rv__cart').click();
    await until(() => f.calls.some(call => call.type === 'cart'));
    assert.equal(f.calls.find(call => call.type === 'cart').payload.warehouseId, 'LOCAL');
    assert.equal(f.calls.find(call => call.type === 'cart').payload.cartId, 'cart-2');
  } finally { f.close(); }
});

test('A stock-hidden response exposes availability without exposing quantities', async () => {
  const f = fixture({ stock: () => ({ data: { '111139': { stockVisibilityMode: 'HIDDEN', available: true,
    warehouses: [{ warehouseId: 'CENTRAL', warehouseLabel: 'Titkos raktár', quantity: 987654 }] } } }) });
  try {
    await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__stocks').textContent, 'Elérhető');
    assert.equal(f.w.document.querySelectorAll('.one-rv__stock-row').length, 0);
    assert.ok(!f.w.document.body.textContent.includes('987654'));
  } finally { f.close(); }
});

test('Missing/null/mismatched prices are not zero prices; an explicit free price stays valid', async () => {
  const f = fixture({ path: '/', delayedApp: true, price: () => ({ data: [
    { productId: '1', quantity: 1, priceNet: null, priceGross: null },
    { productId: '2', quantity: 2, priceNet: 50, priceGross: 64 },
    { productId: '3', quantity: 1, priceNet: 0, priceGross: 0 }
  ] }) });
  try {
    f.seed(['1','2','3','4']); f.w.$nuxt = f.nuxt;
    await until(f.ready);
    const cards = [...f.w.document.querySelectorAll('.one-rv__card')];
    assert.deepEqual(cards.map(card => card.querySelector('.one-rv__cart').disabled), [true,true,false,true]);
    assert.equal(cards[0].querySelector('.one-rv__price').textContent, 'Ár nem elérhető');
    assert.match(cards[2].querySelector('.one-rv__price').textContent, /^0.*Ft/);
  } finally { f.close(); }
});

test('A price failure keeps product navigation and stock; no price can be added to cart', async () => {
  const f = fixture({ price: () => Promise.reject({ response: { status: 403 },
    config: { headers: { Authorization: 'never-emit-price-token' } } }) });
  try {
    await until(f.ready);
    assert.deepEqual(f.cards(), ['111139']);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    assert.equal(f.w.document.querySelectorAll('.one-rv__stock-row').length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(f.errors)), [{ stage: 'price', code: 403 }]);
    assert.equal(f.calls.filter(call => call.type === 'price').length, 1);
  } finally { f.close(); }
});

test('Stock failure is unknown stock; backorderable products remain orderable', async () => {
  const f = fixture({ stock: () => Promise.reject({ response: { status: 503 } }) });
  try {
    await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__stocks').textContent, 'Készlet nem elérhető');
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
  } finally { f.close(); }
});

test('Cannot-order-above-stock products use selected plus central warehouse and content units', async () => {
  const f = fixture({ path: '/', delayedApp: true, stock: () => ({ data: {
    '1': { stockVisibilityMode: 'VISIBLE', available: true, warehouses: [
      { warehouseId: 'CENTRAL', quantity: 1 }, { warehouseId: 'LOCAL', quantity: 1 }
    ] },
    '2': { stockVisibilityMode: 'VISIBLE', available: true, warehouses: [
      { warehouseId: 'CENTRAL', quantity: 1 }, { warehouseId: 'LOCAL', quantity: 0 }
    ] },
    '3': { stockVisibilityMode: 'HIDDEN', available: false, warehouses: [] }
  } }) });
  try {
    f.seed(['1','2','3','4']);
    for (const id of ['1','2','3','4']) f.products.set(id, product(id, {
      cannotOrderAboveStock: true, measurementUnits: { ...sample.measurementUnits, packingQuantity: 2 }
    }));
    f.state.stocks.defaultWarehouse = 'LOCAL';
    f.w.$nuxt = f.nuxt;
    await until(f.ready);
    assert.deepEqual([...f.w.document.querySelectorAll('.one-rv__cart')].map(b => b.disabled), [false,true,true,true]);
  } finally { f.close(); }
});

test('Price permission and guest purchasing restrictions are respected', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.nuxt.$utils = { hasPricesEnabled: false, isAnonymousAndPurchaseDisabled: true };
    f.w.$nuxt = f.nuxt; await until(f.ready);
    assert.equal(f.calls.filter(call => call.type === 'price').length, 0);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    f.mutate(() => { f.nuxt.$utils.hasPricesEnabled = true; f.nuxt.$utils.isAnonymousAndPurchaseDisabled = false; });
    await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
  } finally { f.close(); }
});

test('A native product cart handler is preferred and plugin flows are not bypassed', async () => {
  const f = fixture({ delayedApp: true });
  const nativeCalls = [];
  try {
    f.products.set('111139', { ...sample, pluginsData: { special: { value: true } } });
    f.state.plugins.allComponents.special = { pluginId: 'special', raw: { type: 'app_add_to_cart' } };
    f.nuxt.$children = [{ $children: [{
      defaultAddToCartFlow() {}, runValidators() {}, getOrFetchProduct() {},
      async addToCart(id, quantity, source) { nativeCalls.push({ id, quantity, source }); return sample; }
    }] }];
    f.w.$nuxt = f.nuxt; await until(f.ready);
    f.w.document.querySelector('.one-rv__cart').click();
    await until(() => nativeCalls.length === 1);
    assert.deepEqual(nativeCalls, [{ id: '111139', quantity: 1, source: 'recently-viewed' }]);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 0);
  } finally { f.close(); }
});

test('Plugin products and missing registered cart actions fail closed without a native handler', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.products.set('111139', { ...sample, pluginsData: { special: {} } });
    f.state.plugins.allComponents.special = { pluginId: 'special', raw: { type: 'app_add_to_cart' } };
    f.w.$nuxt = f.nuxt; await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    f.products.set('111139', sample);
    f.nuxt.$store._actions = {};
    f.w.OneRecentlyViewed.refresh(); await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 0);
  } finally { f.close(); }
});

test('Informational product metadata permits the registered native cart action', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.products.set('111139', { ...sample, pluginsData: { productHelper: { value: true } } });
    f.state.plugins.allComponents.helper = { pluginId: 'productHelper', raw: { type: 'iframe_front' } };
    f.w.$nuxt = f.nuxt; await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
    f.w.document.querySelector('.one-rv__cart').click();
    await until(() => f.calls.some(call => call.type === 'cart-refresh'));
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 1);
  } finally { f.close(); }
});

test('An unknown plugin registry fails closed and later registry changes refresh cart eligibility', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.products.set('111139', { ...sample, pluginsData: { special: {} } });
    delete f.state.plugins;
    f.w.$nuxt = f.nuxt; await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    f.mutate(state => { state.plugins = { allComponents: {} }; });
    await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
    f.mutate(state => { state.plugins.allComponents.special = { pluginId: 'special', raw: { type: 'app_add_to_cart' } }; });
    await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 0);
  } finally { f.close(); }
});

test('Double clicks cannot add the same product twice while a write is pending; clicks do not navigate', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ cart: () => pending });
  try {
    await until(f.ready);
    const button = f.w.document.querySelector('.one-rv__cart');
    button.click(); button.click();
    await until(() => f.calls.some(call => call.type === 'cart'));
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 1);
    assert.equal(button.disabled, true);
    assert.equal(button.closest('a'), null);
    assert.equal(f.w.location.pathname, fixturePath);
    release(); await until(() => f.ready() && f.w.document.querySelector('.one-rv__feedback').textContent === 'Kosárba helyezve.');
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
  } finally { f.close(); }
});

test('A rejected cart write is not retried and its error contains no request credentials', async () => {
  const f = fixture({ cart: () => Promise.reject({ response: { status: 409 },
    config: { headers: { Authorization: 'never-emit-cart-token' } } }) });
  try {
    await until(f.ready); f.w.document.querySelector('.one-rv__cart').click();
    await until(() => f.errors.some(error => error.stage === 'cart'));
    await pause(30);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.errors)), [{ stage: 'cart', code: 409 }]);
    assert.match(f.w.document.querySelector('.one-rv__feedback').textContent, /Ellenőrizd a kosarat/);
  } finally { f.close(); }
});

test('A late cart write result for an old buyer cannot show success or send a cart-added event', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ cart: () => pending });
  let events = 0;
  try {
    f.w.document.addEventListener('one-recent-products-cart-added', () => events++);
    await until(f.ready); f.w.document.querySelector('.one-rv__cart').click();
    f.mutate(state => { state.auth.accessToken = 'new-buyer'; state.account.client.id = 'new-buyer'; });
    await until(f.ready);
    release(); await pause(20);
    assert.equal(events, 0);
    assert.ok(!f.w.document.body.textContent.includes('Kosárba helyezve.'));
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, false);
  } finally { f.close(); }
});

test('Image/name navigation stays in the native router, separate from the cart button', async () => {
  const f = fixture();
  try {
    await until(f.ready);
    const card = f.w.document.querySelector('.one-rv__card');
    assert.equal(card.querySelector('img').closest('a').getAttribute('href'), fixturePath);
    assert.equal(card.querySelector('h3').closest('a').getAttribute('href'), fixturePath);
    assert.equal(card.querySelector('button').closest('a'), null);
    assert.ok(!card.textContent.includes('Megnézem'));
    const event = new f.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    assert.equal(card.querySelector('h3').dispatchEvent(event), false);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 0);
  } finally { f.close(); }
});

test('Additional costs are disclosed without turning them into the displayed product price', async () => {
  const f = fixture({ price: () => ({ data: [{ productId: '111139', quantity: 1, priceNet: 100, priceGross: 127,
    additionalCosts: [{ alreadyIncludedInPrice: false, priceNet: 5, priceGross: 6.35 }] }] }) });
  try {
    await until(f.ready);
    assert.match(f.w.document.querySelector('.one-rv__price').textContent, /100/);
    assert.ok(f.w.document.body.textContent.includes('További költségek a kosárban.'));
  } finally { f.close(); }
});

test('A late native cart component enables plugin products and clears the previous disabled reason', async () => {
  const f = fixture({ delayedApp: true });
  try {
    f.products.set('111139', { ...sample, pluginsData: { special: {} } });
    f.state.plugins.allComponents.special = { pluginId: 'special', raw: { type: 'app_add_to_cart' } };
    f.w.$nuxt = f.nuxt; await until(f.ready);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    f.nuxt.$children = [{ defaultAddToCartFlow() {}, runValidators() {}, getOrFetchProduct() {},
      async addToCart() { return null; } }];
    f.w.document.body.appendChild(f.w.document.createElement('aside'));
    await until(() => !f.w.document.querySelector('.one-rv__cart').disabled);
    assert.equal(f.w.document.querySelector('.one-rv__feedback').textContent, '');
  } finally { f.close(); }
});

test('The read-request timeout cannot unlock a pending write or falsely confirm it', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ config: { requestTimeoutMs: 15 }, cart: () => pending });
  try {
    await until(f.ready); f.w.document.querySelector('.one-rv__cart').click();
    await pause(35);
    assert.equal(f.w.document.querySelector('.one-rv__cart').disabled, true);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 1);
    assert.equal(f.errors.filter(error => error.stage === 'cart').length, 0);
    release(); await until(() => f.ready() && !f.w.document.querySelector('.one-rv__cart').disabled);
  } finally { f.close(); }
});

test('An opened or rejected native plugin flow is not reported as a successful cart write', async () => {
  const f = fixture({ delayedApp: true });
  let events = 0;
  try {
    f.nuxt.$children = [{ defaultAddToCartFlow() {}, runValidators() {}, getOrFetchProduct() {},
      async addToCart() { return null; } }];
    f.w.document.addEventListener('one-recent-products-cart-added', () => events++);
    f.w.$nuxt = f.nuxt; await until(f.ready);
    f.w.document.querySelector('.one-rv__cart').click();
    await until(() => f.w.document.querySelector('.one-rv__feedback').textContent === 'Kövesd a webshop kosárüzenetét.');
    assert.equal(events, 0);
    assert.equal(f.calls.filter(call => call.type === 'cart').length, 0);
  } finally { f.close(); }
});
