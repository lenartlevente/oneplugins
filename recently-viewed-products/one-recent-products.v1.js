/* ONe / besttool.hu recently viewed products, v1.0.0.
 * Front Office build inspected: 9.137.2, 2026-10-07.
 * Persistence: one session cookie with at most six SKU IDs.
 * Uses ONe's existing API client; never copies credentials.
 */
(function (w, d) {
  'use strict';
  if (w.OneRecentlyViewed) { w.OneRecentlyViewed.refresh(); return; }
  var script = d.currentScript;
  var config = Object.assign({
    targetId: 'one-recent-products-159b7d2a-5b87-4caa-a981-c6930a4a587f',
    cookieName: '__Host-one_recent_products',
    title: 'Legutóbb megtekintett termékek',
    requestTimeoutMs: 12000,
    appWaitMs: 15000,
    debounceMs: 120,
    retryDelayMs: 700,
    canUseCookie: function () { return true; }
  }, w.OneRecentProductsConfig || {});
  if (script && script.getAttribute('data-target-id')) {
    config.targetId = script.getAttribute('data-target-id');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(config.cookieName)) {
    throw new Error('Invalid recently viewed cookie name');
  }
  var LIMIT = 6, destroyed = false, revision = 0, timer = null;
  var observer = null, boundApp = null, unsubscribe = null, removeRouterHook = null;
  var savedView = null, mountedTarget = null, mountedSection = null;
  var lastRecordedPath = null, observedPath = w.location.pathname;
  var pendingPath = null, contextSnapshot = null, attempts = 0, status = 'starting';
  var readyDeadline = Date.now() + config.appWaitMs;
  var listeners = [];
  function listen(target, event, fn) {
    target.addEventListener(event, fn);
    listeners.push(function () { target.removeEventListener(event, fn); });
  }
  function permitted() {
    try { return config.canUseCookie() === true; } catch (_) { return false; }
  }
  function validId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 160 &&
      value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
  }
  function uniqueIds(ids) {
    if (!Array.isArray(ids)) return [];
    return ids.filter(function (id, i) {
      return validId(id) && ids.indexOf(id) === i;
    }).slice(0, LIMIT);
  }
  function readHistory() {
    var prefix = config.cookieName + '=';
    var part = d.cookie.split(';').map(function (s) { return s.trim(); })
      .find(function (s) { return s.indexOf(prefix) === 0; });
    if (!part) return [];
    try {
      var data = JSON.parse(decodeURIComponent(part.slice(prefix.length)));
      return data && data.v === 1 ? uniqueIds(data.ids) : [];
    } catch (_) { return []; }
  }
  function writeHistory(ids) {
    var value = encodeURIComponent(JSON.stringify({ v: 1, ids: uniqueIds(ids) }));
    if (config.cookieName.length + value.length > 3500) return false;
    // No Expires, Max-Age or Domain: host-only browser-session lifetime.
    d.cookie = config.cookieName + '=' + value + '; Path=/; SameSite=Lax; Secure';
    return JSON.stringify(readHistory()) === JSON.stringify(uniqueIds(ids));
  }
  function clearCookie() {
    d.cookie = config.cookieName + '=; Path=/; SameSite=Lax; Secure; Max-Age=0';
  }
  function app() {
    var nuxt = w.$nuxt;
    return nuxt && nuxt.$api && nuxt.$api.catalog && nuxt.$api.catalog.app &&
      nuxt.$store ? nuxt : null;
  }
  function context(nuxt) {
    var state = nuxt.$store.state || {};
    var auth = state.auth || {}, account = state.account || {}, cfg = state.config || {};
    // Compared only in volatile memory; no token decoding or persistence.
    return [auth.accessToken, auth.sub, auth.org,
      account.client && account.client.id, cfg.tenantKey];
  }
  function equalContext(a, b) {
    return !!a && !!b && a.length === b.length &&
      a.every(function (value, i) { return value === b[i]; });
  }
  function target() { return d.getElementById(config.targetId); }
  function hide() {
    var node = target();
    if (node) {
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
      node.style.setProperty('display', 'none', 'important');
    }
  }
  function emitError(stage, error) {
    // Original API errors can contain request headers: never emit them.
    var code = error && error.response && error.response.status;
    d.dispatchEvent(new w.CustomEvent('one-recent-products-error', {
      detail: { stage: stage, code: typeof code === 'number' ? code : 'unavailable' }
    }));
  }
  function schedule(delay) {
    if (destroyed) return;
    w.clearTimeout(timer);
    timer = w.setTimeout(run, delay == null ? config.debounceMs : delay);
  }
  function invalidate() {
    if (destroyed) return;
    revision += 1; savedView = null; attempts = 0; status = 'refreshing';
    readyDeadline = Date.now() + config.appWaitMs;
    hide(); schedule();
  }
  function bind(nuxt) {
    if (nuxt === boundApp) return;
    if (unsubscribe) unsubscribe();
    if (removeRouterHook) removeRouterHook();
    boundApp = nuxt;
    contextSnapshot = context(nuxt);
    if (typeof nuxt.$store.subscribe === 'function') {
      unsubscribe = nuxt.$store.subscribe(function () {
        var next = context(nuxt);
        if (!equalContext(next, contextSnapshot)) {
          contextSnapshot = next; invalidate();
        }
      });
    }
    if (nuxt.$router && typeof nuxt.$router.afterEach === 'function') {
      var off = nuxt.$router.afterEach(function () { pendingPath = null; invalidate(); });
      removeRouterHook = typeof off === 'function' ? off : null;
    }
  }
  function slugForPath(path) {
    var clean = path.replace(/\/+$/, ''), index = clean.lastIndexOf('-id-');
    if (index < 1) return null;
    try {
      var slug = decodeURIComponent(clean.slice(index + 4));
      return validId(slug) ? slug : null;
    } catch (_) { return null; }
  }
  function stillCurrent(version, path, ctx) {
    var nuxt = app();
    return !destroyed && permitted() && revision === version &&
      w.location.pathname === path && nuxt && equalContext(ctx, context(nuxt));
  }
  function request(promise) {
    return new Promise(function (resolve, reject) {
      var timeout = w.setTimeout(function () { reject(new Error('Request timeout')); },
        config.requestTimeoutMs);
      Promise.resolve(promise).then(function (response) {
        w.clearTimeout(timeout);
        resolve(response && Object.prototype.hasOwnProperty.call(response, 'data')
          ? response.data : response);
      }, function (error) { w.clearTimeout(timeout); reject(error); });
    });
  }
  function safeProductUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      var url = new w.URL(value, w.location.origin);
      return url.origin === w.location.origin && url.protocol === 'https:' &&
        !url.username && !url.password ? url.pathname + url.search + url.hash : null;
    } catch (_) { return null; }
  }
  function imageUrl(product) {
    var photos = Array.isArray(product.photos) ? product.photos : [];
    var value = photos[0] && photos[0].url;
    if (typeof value !== 'string' || !value) return null;
    try {
      var url = new w.URL(value, w.location.origin);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }
  function activeProduct(product) {
    return product && validId(product.id) && typeof product.name === 'string' &&
      product.name.length > 0 && (!product.status || product.status === 'ACTIVE');
  }
  function cardsFromProducts(ids, products) {
    if (!Array.isArray(products)) throw new Error('Unexpected product response');
    return ids.map(function (id) {
      var product = products.find(function (p) { return p && p.id === id; });
      if (!activeProduct(product)) return null;
      var url = safeProductUrl(product.url);
      return url ? { id: product.id, name: product.name, url: url, image: imageUrl(product) } : null;
    }).filter(Boolean);
  }
  function installStyle() {
    if (d.getElementById('one-recent-products-style')) return;
    var style = d.createElement('style');
    style.id = 'one-recent-products-style';
    style.textContent =
      '.one-rv{margin:24px 0;color:inherit;font-family:inherit}' +
      '.one-rv__title{font-size:1.25rem;font-weight:600;margin:0 0 16px}' +
      '.one-rv__grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px;list-style:none;padding:0;margin:0}' +
      '.one-rv__item{min-width:0;display:flex}' +
      '.one-rv__link{display:flex;flex-direction:column;width:100%;height:100%;padding:14px;border:1px solid #efefef;border-radius:4px;background:#fff;color:inherit;text-decoration:none!important}' +
      '.one-rv__link:hover{border-color:#1d71b8}' +
      '.one-rv__link:focus-visible{outline:3px solid #1d71b8;outline-offset:3px}' +
      '.one-rv__image{width:100%;height:130px;object-fit:contain;display:block;margin:0 0 12px}' +
      '.one-rv__placeholder{display:flex;align-items:center;justify-content:center;background:#f7f7f7;color:#666;font-size:.875rem}' +
      '.one-rv__name{font-size:.95rem;line-height:1.4;font-weight:500;margin:0 0 8px;overflow-wrap:anywhere}' +
      '.one-rv__sku{display:block;color:#666;font-size:.8rem;margin-top:auto;padding-top:8px}' +
      '.one-rv__cta{display:block;color:#1d71b8;font-size:.875rem;font-weight:500;margin-top:10px}' +
      '@media(max-width:1199px){.one-rv__grid{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
      '@media(max-width:575px){.one-rv__grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.one-rv__link{padding:10px}.one-rv__image{height:100px}}';
    var nonce = script && (script.nonce || script.getAttribute('nonce'));
    if (nonce) style.setAttribute('nonce', nonce);
    d.head.appendChild(style);
  }
  function element(tag, className, text) {
    var node = d.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function mount(view) {
    if (!view || !stillCurrent(view.version, view.path, view.context)) return;
    var container = target();
    if (!container) return;
    if (!view.cards.length) { hide(); return; }
    if (container === mountedTarget && mountedSection && container.contains(mountedSection)) return;
    installStyle();
    var section = element('section', 'one-rv');
    var heading = element('h2', 'one-rv__title', config.title);
    heading.id = config.targetId + '-heading';
    section.setAttribute('aria-labelledby', heading.id);
    section.setAttribute('data-one-rv-owned', 'true');
    section.appendChild(heading);
    var list = element('ul', 'one-rv__grid');
    view.cards.forEach(function (card) {
      var item = element('li', 'one-rv__item'), link = element('a', 'one-rv__link');
      link.href = card.url;
      link.setAttribute('data-one-rv-link', 'true');
      if (card.image) {
        var img = element('img', 'one-rv__image');
        img.src = card.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', function () { img.hidden = true; }, { once: true });
        link.appendChild(img);
      } else {
        var placeholder = element('span', 'one-rv__image one-rv__placeholder', 'Kép nélkül');
        placeholder.setAttribute('aria-hidden', 'true'); link.appendChild(placeholder);
      }
      link.appendChild(element('h3', 'one-rv__name', card.name));
      link.appendChild(element('span', 'one-rv__sku', 'Cikkszám: ' + card.id));
      link.appendChild(element('span', 'one-rv__cta', 'Megnézem'));
      item.appendChild(link); list.appendChild(item);
    });
    section.appendChild(list);
    section.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[data-one-rv-link]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.altKey) return;
      var nuxt = app();
      if (!nuxt || !nuxt.$router || typeof nuxt.$router.push !== 'function') return;
      var url = safeProductUrl(link.getAttribute('href'));
      if (!url) return;
      try {
        var navigation = nuxt.$router.push(url);
        event.preventDefault();
        if (navigation && typeof navigation.catch === 'function') {
          navigation.catch(function () { /* ONe handles duplicate/cancelled navigation. */ });
        }
      } catch (_) { /* Preserve ordinary anchor navigation. */ }
    });
    container.replaceChildren(section);
    mountedTarget = container; mountedSection = section;
    container.hidden = false; container.removeAttribute('aria-hidden');
    container.style.setProperty('display', 'block', 'important');
  }
  async function run() {
    timer = null;
    if (destroyed) return;
    if (!permitted()) { status = 'disabled'; savedView = null; hide(); return; }
    var nuxt = app();
    if (!nuxt) {
      status = 'waiting-for-one';
      if (Date.now() < readyDeadline) schedule(250);
      else { status = 'unavailable'; emitError('app', null); }
      return;
    }
    bind(nuxt);
    var path = w.location.pathname;
    if (pendingPath && pendingPath !== path && Date.now() < readyDeadline) {
      schedule(150); return;
    }
    pendingPath = null; observedPath = path;
    var ctx = context(nuxt), version = revision, stage = 'current-product';
    var catalog = nuxt.$api.catalog.app;
    try {
      var slug = slugForPath(path), route = nuxt.$route;
      if (route && route.name && route.name !== 'product-page') slug = null;
      if (slug) {
        if (typeof catalog.getProductBySlug !== 'function') throw new Error('Missing product method');
        var current = await request(catalog.getProductBySlug(slug));
        if (!stillCurrent(version, path, ctx)) return;
        if (!activeProduct(current) ||
          String(current.slug || current.id).toLowerCase() !== slug.toLowerCase()) {
          throw new Error('Product mismatch');
        }
        if (lastRecordedPath !== path) {
          var next = [current.id].concat(readHistory().filter(function (id) { return id !== current.id; }));
          if (!writeHistory(next.slice(0, LIMIT))) { status = 'cookies-unavailable'; hide(); return; }
          lastRecordedPath = path;
        }
      } else { lastRecordedPath = null; }
      var ids = readHistory();
      if (!ids.length) { status = 'empty'; savedView = null; hide(); return; }
      stage = 'product-list';
      if (typeof catalog.getProductsListById !== 'function') throw new Error('Missing product list method');
      status = 'loading';
      var products = await request(catalog.getProductsListById(true, ids));
      if (!stillCurrent(version, path, ctx)) return;
      savedView = { version: version, path: path, context: ctx, cards: cardsFromProducts(ids, products) };
      mountedSection = null;
      status = savedView.cards.length ? 'ready' : 'empty';
      attempts = 0; mount(savedView);
    } catch (error) {
      if (!stillCurrent(version, path, ctx)) return;
      status = 'unavailable'; savedView = null; hide(); emitError(stage, error);
      var code = error && error.response && error.response.status;
      if (code !== 401 && code !== 403 && code !== 404 && attempts < 2) {
        attempts += 1; schedule(config.retryDelayMs);
      }
    }
  }
  function start() {
    if (destroyed || observer) return;
    if (w.MutationObserver && d.body) {
      observer = new w.MutationObserver(function (mutations) {
        if (destroyed) return;
        if (mutations.every(function (m) { return mountedSection && mountedSection.contains(m.target); })) return;
        if (w.location.pathname !== observedPath) {
          observedPath = w.location.pathname; invalidate();
        } else if (savedView) { mount(savedView); }
      });
      observer.observe(d.body, { childList: true, subtree: true });
    }
    schedule(0);
  }
  listen(w, 'one-route-change', function (event) {
    pendingPath = event.detail && event.detail.to && event.detail.to.path || null;
    invalidate();
  });
  listen(w, 'popstate', function () { pendingPath = null; invalidate(); });
  listen(w, 'hashchange', function () { pendingPath = null; invalidate(); });
  listen(w, 'pageshow', function (event) { if (event.persisted) invalidate(); });
  listen(d, 'visibilitychange', function () { if (!d.hidden) invalidate(); });
  listen(d, 'one-recent-products-consent-change', invalidate);
  w.OneRecentlyViewed = {
    version: '1.0.0', refresh: invalidate,
    clear: function () {
      revision += 1; w.clearTimeout(timer); timer = null;
      clearCookie(); savedView = null; lastRecordedPath = w.location.pathname;
      status = 'empty'; hide();
    },
    getState: function () {
      return { version: '1.0.0', status: status,
        itemsCount: savedView ? savedView.cards.length : 0, persistence: 'session-cookie' };
    },
    destroy: function () {
      destroyed = true; revision += 1; w.clearTimeout(timer);
      if (observer) observer.disconnect();
      if (unsubscribe) unsubscribe();
      if (removeRouterHook) removeRouterHook();
      listeners.forEach(function (off) { off(); });
      hide(); delete w.OneRecentlyViewed;
    }
  };
  if (d.readyState === 'loading') listen(d, 'DOMContentLoaded', start);
  else start();
})(window, document);
