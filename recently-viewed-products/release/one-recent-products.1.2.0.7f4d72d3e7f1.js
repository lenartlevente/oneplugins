/*!
MIT License

Copyright (c) 2026 Levente Lenart

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* ONe / besttool.hu recently viewed products, v1.2.0.
 * Front Office build inspected: 9.137.2, 2026-10-08.
 * Persistence: one session cookie with at most six SKU IDs.
 * Uses ONe's existing API client; never copies credentials.
 */
(function (w, d) {
  'use strict';
  if (w.OneRecentlyViewed) {
    if (w.OneRecentlyViewed.version === '1.2.0' || typeof w.OneRecentlyViewed.destroy !== 'function') {
      w.OneRecentlyViewed.refresh(); return;
    }
    w.OneRecentlyViewed.destroy();
  }
  // Appearance is maintained in the central stylesheet, including legacy upgrades.
  var legacyStyle = d.getElementById('one-recent-products-style');
  if (legacyStyle && legacyStyle.tagName === 'STYLE') legacyStyle.remove();
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
  var LIMIT = 6, destroyed = false, revision = 0, timer = null, cartPending = false;
  var observer = null, boundApp = null, unsubscribe = null, removeRouterHook = null;
  var savedView = null, mountedTarget = null, mountedSection = null;
  var cartNotice = null;
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
    var stocks = state.stocks || {}, cart = state.cart || {}, layout = state.layout || {};
    var cartPlugins = cartPluginIds(nuxt);
    // Compared only in volatile memory; no token decoding or persistence.
    return [auth.accessToken, auth.sub, auth.org,
      account.client && account.client.id, cfg.tenantKey, stocks.defaultWarehouse,
      warehouseIds(nuxt).join('\n'), cart.selectedCart, layout.priceGross,
      currency(nuxt), pricesEnabled(nuxt), purchaseEnabled(nuxt),
      cartPlugins === null ? null : cartPlugins.join('\n'),
      nuxt.$config && nuxt.$config.BASE_URL];
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
          contextSnapshot = next; cartNotice = null; invalidate();
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
      var units = product.measurementUnits || {};
      var quantity = units.quantityMin == null ? 1 : Number(units.quantityMin);
      var interval = units.quantityInterval == null ? 1 : Number(units.quantityInterval);
      var packing = units.packingQuantity == null ? 1 : Number(units.packingQuantity);
      var validQuantity = positive(quantity) && positive(interval) && positive(packing) && positive(quantity * packing);
      return url ? { id: product.id, name: product.name, url: url, image: imageUrl(product),
        product: product, quantity: quantity, packing: packing, validQuantity: validQuantity,
        pricingQuantity: validQuantity ? Number((quantity * packing).toPrecision(12)) : null,
        orderUnit: units.orderUnitDescription || units.orderUnitCode || '',
        contentUnit: units.contentUnitDescription || units.contentUnitCode || '',
        price: null, stock: null } : null;
    }).filter(Boolean);
  }
  function positive(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
  function nonnegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
  function pricesEnabled(nuxt) { return !nuxt.$utils || nuxt.$utils.hasPricesEnabled !== false; }
  function purchaseEnabled(nuxt) {
    if (nuxt.$utils && typeof nuxt.$utils.isAnonymousAndPurchaseDisabled === 'boolean') {
      return !nuxt.$utils.isAnonymousAndPurchaseDisabled;
    }
    var state = nuxt.$store.state || {};
    var authenticated = nuxt.$auth ? nuxt.$auth.isAuthenticated === true :
      !!(state.auth && state.auth.accessToken);
    if (authenticated) return true;
    if (nuxt.$tenantConfig && typeof nuxt.$tenantConfig.isPurchaseEnabled === 'boolean') {
      return nuxt.$tenantConfig.isPurchaseEnabled;
    }
    return !!(state.config && state.config.accessMode === 'OPEN');
  }
  function warehouseIds(nuxt) {
    var stocks = nuxt.$store.state.stocks || {}, warehouses = stocks.warehouses || {};
    var ids = Array.isArray(warehouses.allIds) ? warehouses.allIds.filter(validId) : [];
    if (validId(stocks.defaultWarehouse) && ids.indexOf(stocks.defaultWarehouse) < 0) {
      ids = [stocks.defaultWarehouse].concat(ids);
    }
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  }
  function selectedWarehouse(nuxt) { return (nuxt.$store.state.stocks || {}).defaultWarehouse; }
  function selectedCart(nuxt) { return (nuxt.$store.state.cart || {}).selectedCart; }
  function currency(nuxt) {
    var state = nuxt.$store.state || {}, layout = state.layout || {}, cfg = state.config || {};
    var value = layout.currency || cfg.currency;
    if (value && typeof value === 'object') value = value.code;
    return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
  }
  function numberText(value) { return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 6 }).format(value); }
  function moneyText(amount, code) {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: code,
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
  function priceElement(card, nuxt) {
    var block = element('div', 'one-rv__price price_column'), code = currency(nuxt);
    var gross = !!((nuxt.$store.state.layout || {}).priceGross);
    var amount = card.price && (gross ? card.price.priceGross : card.price.priceNet);
    if (!card.price || !pricesEnabled(nuxt) || !code || !nonnegative(amount)) {
      block.classList.add('one-rv__price--unknown');
      block.textContent = 'Ár nem elérhető'; return block;
    }
    var catalog = gross ? card.price.catalogPriceGross : card.price.catalogPriceNet;
    if (positive(catalog) && catalog > amount) {
      var info = element('div', 'one-rv__price-info');
      var previous = element('del', 'one-rv__catalog-price crossed', moneyText(catalog, code));
      previous.setAttribute('aria-label', 'Listaár: ' + moneyText(catalog, code));
      info.appendChild(previous);
      var discount = Math.round((catalog - amount) / catalog * 100);
      if (discount > 0) {
        var badge = element('span', 'one-rv__discount discount', '-' + discount + ' %');
        badge.setAttribute('aria-label', 'Kedvezmény: ' + discount + ' százalék');
        info.appendChild(badge);
      }
      block.appendChild(info);
    }
    block.appendChild(element('p', 'one-rv__price-value transactional_price', moneyText(amount, code)));
    var unit = (card.quantity === 1 ? '' : numberText(card.quantity) + ' ') + card.orderUnit;
    block.appendChild(element('p', 'one-rv__price-unit gr_net_unit',
      '(' + (gross ? 'Bruttó' : 'Nettó') + (unit ? '/' + unit : '') + ')'));
    return block;
  }
  function warehouseClassId(id) {
    // Preserve common IDs; encode punctuation (including the escape marker) without collisions.
    return id.replace(/[^A-Za-z0-9-]/g, function (character) {
      return '_' + character.charCodeAt(0).toString(16) + '_';
    });
  }
  function stockState(stock, row) {
    if (!nonnegative(row.quantity)) return 'unknown';
    if (positive(row.quantity)) return 'available';
    if (positive(stock.overallQuantity) || stock.rows.some(function (item) { return positive(item.quantity); })) return 'other-stock';
    if (stock.overallQuantity === 0 || stock.rows.every(function (item) { return nonnegative(item.quantity); })) return 'unavailable';
    return 'unknown';
  }
  async function enrich(cards, nuxt, version, path, ctx) {
    var pricing = nuxt.$api.pricing && nuxt.$api.pricing.app;
    var stocks = nuxt.$api.stock && nuxt.$api.stock.app;
    var ids = cards.map(function (card) { return card.id; }), warehouses = warehouseIds(nuxt);
    var priceCards = cards.filter(function (card) { return card.validQuantity; });
    // Both requests use the live ONe SDK: base URL, tenant and token refresh stay with ONe.
    var jobs = [
      (async function () {
        if (!priceCards.length || !pricesEnabled(nuxt)) return;
        try {
          if (!pricing || typeof pricing.fetchPricingForProducts !== 'function') throw new Error('Missing pricing method');
          var response = await request(pricing.fetchPricingForProducts({ products: priceCards.map(function (card) {
            return { productId: card.id, quantity: card.pricingQuantity };
          }) }));
          if (!stillCurrent(version, path, ctx)) return;
          if (!Array.isArray(response)) throw new Error('Unexpected price response');
          priceCards.forEach(function (card) {
            var price = response.find(function (entry) { return entry && entry.productId === card.id; });
            if (price && nonnegative(price.priceNet) && nonnegative(price.priceGross) &&
              positive(price.quantity) && Math.abs(price.quantity - card.pricingQuantity) <=
                Math.max(1, card.pricingQuantity) * 1e-9) card.price = price;
          });
        } catch (error) { if (stillCurrent(version, path, ctx)) emitError('price', error); }
      })(),
      (async function () {
        if (!ids.length || !warehouses.length) return;
        try {
          if (!stocks || typeof stocks.post !== 'function') throw new Error('Missing stock POST method');
          var query = { skus: ids, warehouses: warehouses };
          if (validId(selectedCart(nuxt))) query.cartId = selectedCart(nuxt);
          // The named SDK stock helper uses GET in 9.137.2; explicitly use the requested POST.
          var response = await request(stocks.post('/products/stocks', query, { authentication: 'public' }));
          if (!stillCurrent(version, path, ctx)) return;
          if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('Unexpected stock response');
          cards.forEach(function (card) {
            var stock = Object.prototype.hasOwnProperty.call(response, card.id) ? response[card.id] : null;
            if (stock && Array.isArray(stock.warehouses) &&
              (stock.stockVisibilityMode === 'VISIBLE' || stock.stockVisibilityMode === 'HIDDEN')) {
              card.stock = { visibility: stock.stockVisibilityMode, available: stock.available === true,
                overallQuantity: nonnegative(stock.overallQuantity) ? stock.overallQuantity : null,
                rows: stock.warehouses.filter(function (row) { return row && warehouses.indexOf(row.warehouseId) >= 0; }) };
            }
          });
        } catch (error) { if (stillCurrent(version, path, ctx)) emitError('stock', error); }
      })()
    ];
    await Promise.all(jobs);
  }
  function nativeCartHandler(nuxt) {
    var pending = [nuxt], visited = new Set(), count = 0;
    while (pending.length && count++ < 2000) {
      var component = pending.shift();
      if (!component || visited.has(component) || component._isDestroyed || component._isBeingDestroyed) continue;
      visited.add(component);
      if (typeof component.addToCart === 'function' && typeof component.defaultAddToCartFlow === 'function' &&
        typeof component.runValidators === 'function' && typeof component.getOrFetchProduct === 'function') return component;
      if (Array.isArray(component.$children)) pending.push.apply(pending, component.$children);
    }
    return null;
  }
  function cartDispatchAvailable(nuxt) {
    var actions = nuxt.$store._actions;
    return typeof nuxt.$store.dispatch === 'function' && actions &&
      Array.isArray(actions['cart/addProductToCart']) && actions['cart/addProductToCart'].length > 0;
  }
  function cartPluginIds(nuxt) {
    var plugins = nuxt.$store.state.plugins;
    var components = plugins && plugins.allComponents;
    if (!components || typeof components !== 'object' || Array.isArray(components)) return null;
    return Object.keys(components).map(function (key) { return components[key]; })
      .filter(function (component) { return component && component.raw &&
        component.raw.type === 'app_add_to_cart' && typeof component.pluginId === 'string'; })
      .map(function (component) { return component.pluginId; }).sort();
  }
  function requiresCartPlugin(card, nuxt) {
    var productPlugins = Object.keys(card.product.pluginsData || {});
    if (!productPlugins.length) return false;
    var cartPlugins = cartPluginIds(nuxt);
    // Product metadata such as productHelper is not an add-to-cart plugin.
    return cartPlugins === null || cartPlugins.some(function (id) { return productPlugins.indexOf(id) >= 0; });
  }
  function cartReason(card, nuxt) {
    if (!purchaseEnabled(nuxt)) return 'A vásárláshoz jelentkezz be.';
    if (!validId(selectedCart(nuxt)) || !validId(selectedWarehouse(nuxt))) return 'A kosár jelenleg nem érhető el.';
    if (!card.validQuantity) return 'A rendelési mennyiség nem érhető el.';
    if (!card.price || !pricesEnabled(nuxt) || !currency(nuxt)) return 'Ár nélkül nem rendelhető.';
    if (card.product.cannotOrderAboveStock === true) {
      if (!card.stock) return 'A rendelhető készlet nem érhető el.';
      if (card.stock.visibility === 'HIDDEN' && !card.stock.available) return 'Jelenleg nem rendelhető.';
      if (card.stock.visibility === 'VISIBLE') {
        var stocks = nuxt.$store.state.stocks || {}, byId = (stocks.warehouses || {}).byId || {};
        var selected = byId[selectedWarehouse(nuxt)] || {};
        var central = selected.parent || Object.keys(byId).find(function (id) { return byId[id].type === 'CENTRAL'; });
        var allowed = [selectedWarehouse(nuxt), central].filter(function (id, i, ids) { return validId(id) && ids.indexOf(id) === i; });
        var rows = card.stock.rows.filter(function (row) { return allowed.indexOf(row.warehouseId) >= 0; });
        if (!rows.length || rows.some(function (row) { return !nonnegative(row.quantity); })) return 'A rendelhető készlet nem érhető el.';
        var quantity = rows.reduce(function (sum, row) { return sum + row.quantity; }, 0);
        if (quantity + 1e-9 < card.pricingQuantity) return 'Nincs elegendő rendelhető készlet.';
      }
    }
    if (typeof config.addToCart === 'function' || nativeCartHandler(nuxt)) return '';
    if (requiresCartPlugin(card, nuxt)) return 'A rendelés a termékoldalon folytatható.';
    return cartDispatchAvailable(nuxt) ? '' : 'A kosár jelenleg nem érhető el.';
  }
  async function addToCart(card, view, button, feedback) {
    if (cartPending || !stillCurrent(view.version, view.path, view.context)) return;
    var nuxt = app(), reason = cartReason(card, nuxt);
    if (reason) { feedback.textContent = reason; return; }
    cartPending = true; button.setAttribute('aria-busy', 'true');
    feedback.textContent = 'Kosárba helyezés folyamatban…'; syncCartButtons();
    try {
      var handler = nativeCartHandler(nuxt), result, added = false;
      // No timeout/retry wrapper for writes: a late acknowledgement must not cause a duplicate add.
      if (typeof config.addToCart === 'function') {
        result = await config.addToCart({ product: card.product, quantity: card.quantity,
          cartId: selectedCart(nuxt), warehouseId: selectedWarehouse(nuxt), nuxt: nuxt });
        added = result === true || !!(result && result.id === card.id);
      } else if (handler) {
        result = await handler.addToCart(card.id, card.quantity, 'recently-viewed');
        added = !!(result && result.id === card.id);
      } else {
        await nuxt.$store.dispatch('cart/addProductToCart', { cartId: selectedCart(nuxt),
          newProduct: { productId: card.id, amountOfProducts: card.quantity },
          warehouseId: selectedWarehouse(nuxt) });
        added = true;
      }
      if (stillCurrent(view.version, view.path, view.context)) {
        feedback.textContent = added ? 'Kosárba helyezve.' : 'Kövesd a webshop kosárüzenetét.';
        if (added) {
          cartNotice = { id: card.id, context: view.context, until: Date.now() + 8000 };
          d.dispatchEvent(new w.CustomEvent('one-recent-products-cart-added', {
            detail: { productId: card.id, quantity: card.quantity }
          }));
          // Refresh quantity-specific prices and reservations after a confirmed write.
          invalidate();
        }
      }
    } catch (error) {
      if (stillCurrent(view.version, view.path, view.context)) {
        feedback.textContent = 'Nem kaptunk visszaigazolást. Ellenőrizd a kosarat, mielőtt újra próbálkozol.';
        emitError('cart', error);
      }
    } finally { cartPending = false; button.removeAttribute('aria-busy'); syncCartButtons(); }
  }
  function syncCartButtons() {
    if (!savedView || !mountedSection) return;
    var nuxt = app();
    mountedSection.querySelectorAll('button[data-one-rv-cart]').forEach(function (button) {
      var card = savedView.cards.find(function (item) { return item.id === button.getAttribute('data-one-rv-cart'); });
      var reason = nuxt && card ? cartReason(card, nuxt) : 'A kosár jelenleg nem érhető el.';
      button.disabled = cartPending || !!reason;
      var feedback = d.getElementById(button.getAttribute('aria-describedby'));
      if (feedback) {
        if (feedback.textContent === feedback.getAttribute('data-one-rv-reason')) feedback.textContent = reason;
        feedback.setAttribute('data-one-rv-reason', reason);
      }
    });
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
    var section = element('section', 'one-rv');
    var heading = element('h2', 'one-rv__title', config.title);
    heading.id = config.targetId + '-heading';
    section.setAttribute('aria-labelledby', heading.id);
    section.setAttribute('data-one-rv-owned', 'true');
    section.appendChild(heading);
    var list = element('ul', 'one-rv__grid');
    view.cards.forEach(function (card) {
      var item = element('li', 'one-rv__item'), panel = element('article', 'one-rv__card');
      var link = element('a', 'one-rv__link'), nuxt = app();
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
      panel.appendChild(link);
      panel.appendChild(element('span', 'one-rv__sku', 'Cikkszám: ' + card.id));
      panel.appendChild(priceElement(card, nuxt));
      if (card.price && Array.isArray(card.price.additionalCosts) && card.price.additionalCosts.some(function (cost) {
        return cost && cost.alreadyIncludedInPrice === false &&
          (positive(cost.priceNet) || positive(cost.priceGross));
      })) panel.appendChild(element('p', 'one-rv__feedback', 'További költségek a kosárban.'));
      if (card.stock && card.stock.visibility === 'VISIBLE' && card.stock.rows.length) {
        var stocksBox = element('div', 'one-rv__stocks fetis-stockbox');
        var stocksList = element('ul', 'one-rv__warehouse-list fetis-stockbox__warehouses');
        stocksList.setAttribute('aria-label', 'Raktárkészlet');
        card.stock.rows.forEach(function (row) {
          var state = stockState(card.stock, row);
          var stockRow = element('li', 'one-rv__stock-row fetis-stockbox__warehouse-row ' +
            'one-rv__warehouse-' + warehouseClassId(row.warehouseId) +
            ' one-rv__stock-row--' + state + ' fetis-stockbox__warehouse-row--' + state);
          stockRow.setAttribute('data-warehouse-id', row.warehouseId);
          stockRow.setAttribute('data-stock-state', state);
          var stockValue = nonnegative(row.quantity) ? numberText(row.quantity) +
            (card.contentUnit ? ' ' + card.contentUnit : '') : 'Nem elérhető';
          var warehouse = ((nuxt.$store.state.stocks || {}).warehouses || {}).byId || {};
          var label = row.warehouseLabel || (warehouse[row.warehouseId] || {}).name || row.warehouseId;
          var dot = element('span', 'one-rv__stock-dot fetis-stockbox__status-dot');
          dot.setAttribute('aria-hidden', 'true');
          var states = { available: 'Készleten', 'other-stock': 'Másik raktárban van készlet',
            unavailable: 'Nincs készleten', unknown: 'A készletadat nem elérhető' };
          stockRow.setAttribute('aria-label', label + ': ' + stockValue + '. ' + states[state] + '.');
          stockRow.appendChild(dot);
          stockRow.appendChild(element('span', 'one-rv__stock-name fetis-stockbox__warehouse-name', label));
          stockRow.appendChild(element('span', 'one-rv__stock-value fetis-stockbox__warehouse-quantity', stockValue));
          stocksList.appendChild(stockRow);
        });
        stocksBox.appendChild(stocksList); panel.appendChild(stocksBox);
      } else {
        var stockMessage = card.stock && card.stock.visibility === 'HIDDEN' ?
          (card.stock.available ? 'Elérhető' : 'Jelenleg nem elérhető') : 'Készlet nem elérhető';
        panel.appendChild(element('p', 'one-rv__stocks', stockMessage));
      }
      var button = element('button', 'one-rv__cart btn one-button btn-primary', 'Kosárba');
      button.type = 'button'; button.setAttribute('data-one-rv-cart', card.id);
      button.setAttribute('aria-label', card.name + (card.validQuantity ? ' – ' + numberText(card.quantity) +
        (card.orderUnit ? ' ' + card.orderUnit : '') : '') + ' kosárba helyezése');
      var notice = cartNotice && cartNotice.id === card.id && cartNotice.until > Date.now() &&
        equalContext(cartNotice.context, view.context) ? 'Kosárba helyezve.' : '';
      var feedback = element('p', 'one-rv__feedback', cartReason(card, nuxt) || notice);
      feedback.setAttribute('data-one-rv-reason', cartReason(card, nuxt));
      feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
      feedback.id = config.targetId + '-status-' + list.children.length;
      button.setAttribute('aria-describedby', feedback.id);
      button.addEventListener('click', function () { addToCart(card, view, button, feedback); });
      panel.appendChild(button); panel.appendChild(feedback);
      item.appendChild(panel); list.appendChild(item);
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
    syncCartButtons();
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
      var cards = cardsFromProducts(ids, products);
      await enrich(cards, nuxt, version, path, ctx);
      if (!stillCurrent(version, path, ctx)) return;
      savedView = { version: version, path: path, context: ctx, cards: cards };
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
        } else if (savedView) { mount(savedView); syncCartButtons(); }
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
    version: '1.2.0', refresh: invalidate,
    clear: function () {
      revision += 1; w.clearTimeout(timer); timer = null;
      clearCookie(); savedView = null; cartNotice = null; lastRecordedPath = w.location.pathname;
      status = 'empty'; hide();
    },
    getState: function () {
      return { version: '1.2.0', status: status,
        itemsCount: savedView ? savedView.cards.length : 0, persistence: 'session-cookie' };
    },
    destroy: function () {
      destroyed = true; revision += 1; w.clearTimeout(timer);
      if (observer) observer.disconnect();
      if (unsubscribe) unsubscribe();
      if (removeRouterHook) removeRouterHook();
      listeners.forEach(function (off) { off(); });
      savedView = null; cartNotice = null;
      hide(); delete w.OneRecentlyViewed;
    }
  };
  if (d.readyState === 'loading') listen(d, 'DOMContentLoaded', start);
  else start();
})(window, document);
