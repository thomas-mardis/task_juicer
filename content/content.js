// content/content.js
const DEBUG = true;
const TARGET_STATUSES = ["dev complete", "done"];
const BOOT_DEADZONE_MS = 1200;
const bootTs = Date.now();

const DETAIL_STATUS_SELECTOR = 'button#issue\\.fields\\.status-view\\.status-button > span:nth-of-type(1)';
const ROW_BUTTON_SELECTORS = [
    'button[aria-label$="Change status"]',
    'button[aria-label*="Change status"]',
    '[role="button"][aria-label$="Change status"]',
    '[role="button"][aria-label*="Change status"]',
    'td [role="button"][aria-label*="Change status"]',
    'td button[aria-label*="Change status"]'
];
const ROW_BUTTON_SELECTOR_ANY = ROW_BUTTON_SELECTORS.join(',');

const log  = (...a) => DEBUG && console.log("[Juicer]", ...a);
const norm = s => (s || "").trim().toLowerCase();

// ------- Overlay (for precise positioning + the glow ring) -------
function ensureOverlay() {
    let ov = document.getElementById("__juice_overlay__");
    if (!ov) {
        ov = Object.assign(document.createElement("div"), { id: "__juice_overlay__" });
        Object.assign(ov.style, {
            position: "absolute", left: "0", top: "0", width: "0", height: "0",
            pointerEvents: "none", zIndex: "2147483647"
        });
        document.body.appendChild(ov);
    }
    return ov;
}
function placeOverlayOver(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ov = ensureOverlay();
    ov.style.transform = `translate(${window.scrollX + r.left}px, ${window.scrollY + r.top}px)`;
    ov.style.width = `${r.width}px`;
    ov.style.height = `${r.height}px`;
    return { r, ov };
}
function boomRing(el) {
    const { ov } = placeOverlayOver(el) || {};
    if (!ov) return;
    const ring = document.createElement("div");
    Object.assign(ring.style, {
        position: "absolute", inset: 0, borderRadius: "50%",
        boxShadow: "0 0 40px 15px rgba(255,200,100,.8), 0 0 120px 60px rgba(255,100,0,.35)",
        animation: "__boom 650ms ease-out forwards"
    });
    ov.appendChild(ring);
    if (!document.getElementById("__boom_css")) {
        const st = document.createElement("style"); st.id = "__boom_css";
        st.textContent = `@keyframes __boom{0%{transform:scale(0);opacity:1}70%{transform:scale(1.2);opacity:.9}100%{transform:scale(1.6);opacity:0}}`;
        document.head.appendChild(st);
    }
    setTimeout(() => ring.remove(), 700);
}

// ------- Effect trigger -------
function runEffect(el) {
    // effects.js defines JUICER.runRandomEffect
    try { JUICER.runRandomEffect(el); } catch (e) { console.error(e); }
    boomRing(el);
}
function becameTarget(now, last) {
    const became = TARGET_STATUSES.some(s => now.includes(s));
    const was    = TARGET_STATUSES.some(s => last.includes(s));
    return became && !was;
}

// =========================
// Issue Detail watcher
// =========================
let detailBound = false;
function bindDetailWatcher() {
    if (detailBound) return true;

    const readDetail = () => {
        const el  = document.querySelector(DETAIL_STATUS_SELECTOR);
        const txt = el ? norm(el.textContent || el.innerText) : "";
        return { el, txt };
    };
    const first = readDetail();
    if (!first.el) return false;

    detailBound = true;
    let lastEl = first.el;
    let lastTx = first.txt;
    log("detail view found. text:", lastTx);
    placeOverlayOver(lastEl);

    const mo = new MutationObserver(() => {
        const { el, txt } = readDetail();
        if (!el) return;
        if (el !== lastEl) { log("detail element replaced"); lastEl = el; placeOverlayOver(el); }
        if (txt && txt !== lastTx) {
            log("detail change:", lastTx, "→", txt);
            if (Date.now() - bootTs > BOOT_DEADZONE_MS && becameTarget(txt, lastTx)) runEffect(el);
            lastTx = txt;
        }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });

    const onScroll = () => placeOverlayOver(lastEl);
    const onResize = () => placeOverlayOver(lastEl);
    const ro = new ResizeObserver(() => placeOverlayOver(lastEl));
    ro.observe(lastEl);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });

    cleanupFns.push(() => { try{mo.disconnect();}catch{} try{ro.disconnect();}catch{} removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); detailBound = false; });
    return true;
}

// =========================
// List / Epic rows watcher (with arming)
// =========================
let rowBound = false;
// Per-button state: { last, armed, armAt }
const rowState = new WeakMap();

function getRowButtons() {
    const seen = new Set(); const out = [];
    for (const s of ROW_BUTTON_SELECTORS) {
        document.querySelectorAll(s).forEach(el => { if (!seen.has(el)) { seen.add(el); out.push(el); }});
    }
    return out;
}
function parseStatusFromAria(label) {
    if (!label) return "";
    const m = label.match(/^(.+?)\s*-\s*change status$/i) || label.match(/^\s*status:\s*(.+)\s*$/i);
    return m ? (m[1] || "").trim().toLowerCase() : "";
}
function parseStatusFromText(el) {
    const node = el.querySelector('[data-testid*="status"]') || el.querySelector('span,div') || el;
    return (node.textContent || node.innerText || "").trim().toLowerCase();
}
function readRowStatus(el) {
    return parseStatusFromAria(el.getAttribute("aria-label")) || parseStatusFromText(el);
}
function armStateLater(el, ms = 900) {
    const st = rowState.get(el) || { last: "", armed: false, armAt: 0 };
    st.armAt = Date.now() + ms;
    rowState.set(el, st);
    setTimeout(() => { const s = rowState.get(el); if (s) s.armed = true; }, ms);
}
function shouldFire(el, now, last) {
    const s = rowState.get(el);
    if (!s) return false;
    if (!s.armed || Date.now() < s.armAt) return false;
    if (Date.now() - bootTs <= BOOT_DEADZONE_MS) return false;
    return becameTarget(now, last);
}

function bindRowWatcher() {
    if (rowBound) return true;
    const buttons = getRowButtons();
    if (buttons.length === 0) { log("row/list view: no status controls found yet"); return false; }

    rowBound = true;
    log("row/list view: found", buttons.length, "status controls");
    for (const btn of buttons) {
        const now = readRowStatus(btn);
        rowState.set(btn, { last: now, armed: false, armAt: 0 });
        armStateLater(btn, 900);
    }

    const io = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => { if (isIntersecting) placeOverlayOver(target); });
    });
    buttons.forEach(b => io.observe(b));

    const mo = new MutationObserver(() => {
        const btns = getRowButtons();
        for (const btn of btns) {
            const now  = readRowStatus(btn);
            const st   = rowState.get(btn) || { last: "", armed: false, armAt: 0 };
            if (now && now !== st.last) {
                log("row change:", st.last, "→", now, btn);
                if (shouldFire(btn, now, st.last)) runEffect(btn);
                st.last = now;
                if (!st.armed) armStateLater(btn, 900);
                rowState.set(btn, st);
            }
        }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label","aria-pressed","class"] });

    const clickHandler = (e) => {
        const el = e.target.closest(ROW_BUTTON_SELECTOR_ANY);
        if (!el) return;
        setTimeout(() => {
            const now = readRowStatus(el);
            const st  = rowState.get(el) || { last: "", armed: false, armAt: 0 };
            if (now && now !== st.last) {
                log("row click-change:", st.last, "→", now, el);
                if (shouldFire(el, now, st.last)) runEffect(el);
                st.last = now; rowState.set(el, st);
            }
        }, 250);
    };
    document.addEventListener("click", clickHandler, true);

    cleanupFns.push(() => { try{mo.disconnect();}catch{} try{io.disconnect();}catch{} document.removeEventListener("click", clickHandler, true); rowBound = false; });
    return true;
}

// Manual smoke test
addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && e.code === "KeyJ") {
        const el = document.querySelector(DETAIL_STATUS_SELECTOR) || document.querySelector(ROW_BUTTON_SELECTOR_ANY);
        log("manual fire (Alt+Shift+J). el?", !!el);
        if (el) runEffect(el);
    }
});

// Bootstrap + cleanup on route changes
const cleanupFns = [];
function cleanupAll() { while (cleanupFns.length) { try { cleanupFns.pop()(); } catch {} } }

function init() {
    log("init @", location.href, "confetti?", typeof window.confetti, "effects?", (JUICER?.effects?.length||0));
    bindDetailWatcher();
    bindRowWatcher();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { init(); setTimeout(init, 600); });
} else {
    init(); setTimeout(init, 600);
}

let _path = location.pathname;
setInterval(() => {
    if (location.pathname !== _path) {
        _path = location.pathname;
        log("route change → re-init");
        cleanupAll();
        setTimeout(init, 600);
    }
}, 400);
