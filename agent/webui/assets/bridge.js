// Go <-> page bridge, loaded on every app window.
//
// Page -> Go:  window.ui.action('next', optionalPayload)
//   Go binds a single function `goAction(name, payloadJSON)` per window.
// Go -> page:  Go calls window.__setState({...}); elements with
//   [data-bind="key"]        get their textContent set to state.key
//   [data-bind-width="key"]   get style.width set to state.key + '%'
//   [data-show="key"]         are hidden unless state.key is truthy
//   a 'uistate' CustomEvent is dispatched with the full state as detail.

(function () {
  // If a click lands before Go's goAction binding is injected (a race on the
  // very first page load), hold the action and flush it once goAction shows up.
  var queued = [];
  function send(name, payload) {
    if (typeof window.goAction === 'function') {
      window.goAction(String(name), payload === undefined ? null : payload);
      return true;
    }
    return false;
  }
  var flushTimer = setInterval(function () {
    if (typeof window.goAction !== 'function') return;
    clearInterval(flushTimer);
    while (queued.length) { var q = queued.shift(); send(q[0], q[1]); }
  }, 50);

  window.ui = {
    action: function (name, payload) {
      if (!send(name, payload)) queued.push([name, payload]);
    },
    onState: function (fn) {
      window.addEventListener('uistate', function (e) { fn(e.detail); });
    },
  };

  window.__setState = function (data) {
    var s = typeof data === 'string' ? JSON.parse(data) : data;
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var k = el.getAttribute('data-bind');
      if (s[k] !== undefined && s[k] !== null) el.textContent = s[k];
    });
    document.querySelectorAll('[data-bind-width]').forEach(function (el) {
      var k = el.getAttribute('data-bind-width');
      if (s[k] !== undefined && s[k] !== null) el.style.width = s[k] + '%';
    });
    document.querySelectorAll('[data-bind-src]').forEach(function (el) {
      var k = el.getAttribute('data-bind-src');
      if (s[k]) el.src = s[k];
    });
    document.querySelectorAll('[data-bind-class]').forEach(function (el) {
      // "key:className" — toggle className when state.key is truthy
      var spec = el.getAttribute('data-bind-class').split(':');
      if (spec[0] in s) el.classList.toggle(spec[1], !!s[spec[0]]);
    });
    document.querySelectorAll('[data-show]').forEach(function (el) {
      var k = el.getAttribute('data-show');
      el.hidden = !s[k];
    });
    window.dispatchEvent(new CustomEvent('uistate', { detail: s }));
  };

  // Nothing in these windows navigates by URL; make stray anchors inert.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && !a.hasAttribute('data-allow-nav')) e.preventDefault();
  });

  // Tell Go the page is ready so it can push the initial state deterministically
  // (rather than racing a timer).
  function ready() { window.ui.action('__ready'); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
