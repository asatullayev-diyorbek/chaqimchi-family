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
  window.ui = {
    action: function (name, payload) {
      if (typeof window.goAction === 'function') {
        window.goAction(String(name), payload === undefined ? null : payload);
      }
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
})();
