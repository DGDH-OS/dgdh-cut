/* AUTO-GENERATED door 1. OPS/tools/theme/sync.sh uit dgdh-theme.js. NIET HANDMATIG WIJZIGEN. */
/*
 * DGDH theme runtime. EEN BRON: 1. OPS/tools/theme/dgdh-theme.js (sync.sh kopieert naar apps).
 * Blokkerend in <head> inlinen (voor de eerste paint). Zonder framework, ~3 KB.
 *
 * Voorkeur: cookie `dgdh-theme` = system | light | dark op .dgdh-os.com (Lax, Secure, 1 jaar, niet httpOnly).
 * Cookie is leidend voor snelheid. Ingelogd: de Suite bewaart de keuze ook in suite.user_preferences
 * (GET/PUT https://id.dgdh-os.com/api/theme, credentials) zodat een nieuw apparaat klopt.
 * API: window.DgdhTheme.{get(), effective(), set(pref), mountSwitch(el), onChange(fn)}.
 */
(function () {
  var NAME = "dgdh-theme";
  var PREFS = ["system", "light", "dark"];
  var COLORS = { light: "#f5f3ee", dark: "#121212" };
  var API = "https://id.dgdh-os.com/api/theme";
  var d = document.documentElement;
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : { matches: false };
  var listeners = [];

  function readCookie() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + NAME + "=([^;]*)"));
    return m && PREFS.indexOf(m[1]) > -1 ? m[1] : null;
  }
  function writeCookie(pref) {
    var host = location.hostname;
    var dom = /(^|\.)dgdh-os\.com$/.test(host) ? "; Domain=.dgdh-os.com" : "";
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = NAME + "=" + pref + dom + "; Path=/; Max-Age=31536000; SameSite=Lax" + secure;
  }
  function effective(pref) {
    return pref === "system" ? (mq.matches ? "dark" : "light") : pref;
  }
  function metas(pref) {
    var head = document.head;
    var old = head.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    function add(color, media) {
      var m = document.createElement("meta");
      m.name = "theme-color";
      m.content = color;
      if (media) m.media = media;
      head.appendChild(m);
    }
    if (pref === "system") {
      add(COLORS.light, "(prefers-color-scheme: light)");
      add(COLORS.dark, "(prefers-color-scheme: dark)");
    } else add(COLORS[pref]);
    var cs = head.querySelector('meta[name="color-scheme"]');
    if (!cs) {
      cs = document.createElement("meta");
      cs.name = "color-scheme";
      head.appendChild(cs);
    }
    cs.content = pref === "system" ? "light dark" : pref;
  }
  function apply(pref) {
    if (pref === "system") d.removeAttribute("data-theme");
    else d.setAttribute("data-theme", pref);
    d.setAttribute("data-theme-pref", pref);
    d.setAttribute("data-theme-effective", effective(pref));
    if (document.head) metas(pref);
    for (var i = 0; i < listeners.length; i++) listeners[i](pref, effective(pref));
  }
  function current() {
    return readCookie() || "system";
  }
  function push(pref) {
    try {
      fetch(API, {
        method: "PUT",
        credentials: "include",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: pref }),
      }).catch(function () {});
    } catch (e) {}
  }
  function set(pref) {
    if (PREFS.indexOf(pref) < 0) return;
    writeCookie(pref);
    apply(pref);
    push(pref);
  }
  // Nieuw apparaat: geen cookie maar wel een Suite-voorkeur ophalen (stil falen als niet ingelogd).
  function hydrate() {
    if (readCookie() || !window.fetch) return;
    try {
      if (sessionStorage.getItem(NAME + "-asked")) return;
      sessionStorage.setItem(NAME + "-asked", "1");
    } catch (e) {}
    fetch(API, { credentials: "include" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (j && PREFS.indexOf(j.theme) > -1 && j.theme !== "system") {
          writeCookie(j.theme);
          apply(j.theme);
        }
      })
      .catch(function () {});
  }

  var ICON = {
    system:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    light:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  };
  var LABEL = { system: "Systeem", light: "Licht", dark: "Donker" };

  /** Toegankelijke segmented control (radiogroup, pijltoetsen, 44px). Aanroepen met een leeg element. */
  function mountSwitch(el) {
    if (!el || el.getAttribute("data-mounted")) return;
    el.setAttribute("data-mounted", "1");
    el.className = (el.className ? el.className + " " : "") + "dgdh-theme-switch";
    el.setAttribute("role", "radiogroup");
    el.setAttribute("aria-label", "Weergave");
    var btns = PREFS.map(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("data-pref", p);
      b.setAttribute("aria-label", LABEL[p]);
      b.title = LABEL[p];
      b.innerHTML = ICON[p];
      b.addEventListener("click", function () {
        set(p);
      });
      b.addEventListener("keydown", function (e) {
        var i = PREFS.indexOf(p);
        var n = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : null;
        if (n === null) return;
        e.preventDefault();
        var t = btns[(n + 3) % 3];
        t.focus();
        set(PREFS[(n + 3) % 3]);
      });
      el.appendChild(b);
      return b;
    });
    function sync(pref) {
      btns.forEach(function (b) {
        var on = b.getAttribute("data-pref") === pref;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
    }
    sync(current());
    listeners.push(sync);
  }

  // OS-wissel live volgen als Systeem gekozen is; andere tab/app wijzigt cookie: bij terugkeer overnemen.
  function onOs() {
    if (current() === "system") apply("system");
  }
  if (mq.addEventListener) mq.addEventListener("change", onOs);
  else if (mq.addListener) mq.addListener(onOs);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && d.getAttribute("data-theme-pref") !== current()) apply(current());
  });

  apply(current());
  // <head> bestaat bij inline plaatsing al; metas() draait dan direct. Anders bij DOM klaar.
  if (!document.head) document.addEventListener("DOMContentLoaded", function () { metas(current()); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hydrate);
  else hydrate();
  document.addEventListener("DOMContentLoaded", function () {
    var nodes = document.querySelectorAll("[data-dgdh-theme-switch]");
    for (var i = 0; i < nodes.length; i++) mountSwitch(nodes[i]);
  });

  window.DgdhTheme = {
    get: current,
    effective: function () {
      return effective(current());
    },
    set: set,
    mountSwitch: mountSwitch,
    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },
  };
})();
