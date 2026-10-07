// @ts-nocheck
/* مُعين — استوديو الملفات v3.0
   ✅ زر تشغيل يفتح المعاينة ملء الشاشة
   ✅ Console مدمج يلتقط logs + الأخطاء
   ✅ CodeMirror (تلوين + بحث + أرقام أسطر)
   ✅ شجرة ملفات بمجلدات قابلة للطي
   ✅ IndexedDB (مشاريع كبيرة حتى 50MB+)
   ✅ حفظ يدوي + تلقائي بعد 3 دقائق سكون
*/
(() => {
  const PAGE_ID = "editorPage";
  const DB_NAME = "mueen_editor_db";
  const DB_VERSION = 1;
  const STORE = "projects";
  const PROJECT_ID = "default";
  const AUTOSAVE_IDLE_MS = 3 * 60 * 1000; // 3 دقائق
  const MAX_TEXT_SIZE = 3 * 1024 * 1024;
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
  const CDN = {
    cmCss: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css",
    cmTheme: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/dracula.min.css",
    cmJs: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js",
    cmModes: [
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/xml/xml.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/css/css.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/htmlmixed/htmlmixed.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/markdown/markdown.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/python/python.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/yaml/yaml.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/sql/sql.min.js"
    ],
    cmAddons: [
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closebrackets.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/selection/active-line.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/fold/foldcode.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/fold/foldgutter.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/fold/foldgutter.css",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/dialog/dialog.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/dialog/dialog.css",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/search/searchcursor.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/search/search.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/search/jump-to-line.min.js"
    ],
    jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
  };

  let state = {
    files: {},
    openTabs: [],
    activeTab: "",
    previewPath: "",
    liveReload: true,
    showConsole: true,
    folderClosed: {},
    consoleLogs: [],
    dirty: false,
    lastSaved: 0
  };

  let cm = null;
  let idleTimer = null;
  let cmLoading = null;

  const TEXT_EXTS = ["html","htm","css","js","mjs","jsx","ts","tsx","json","md","txt","py","java","php","sql","xml","yml","yaml","toml","sh","bash","env","c","cpp","h","hpp","rb","go","rs","vue","svelte","gitignore"];
  const IMAGE_EXTS = ["png","jpg","jpeg","gif","svg","webp","ico","bmp","avif"];
  const MIME_MAP = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", ico: "image/x-icon", bmp: "image/bmp", avif: "image/avif", svg: "image/svg+xml"
  };

  /* ============ أدوات ============ */
  const escapeHtml = (v = "") => String(v).replace(/[&<>'"]/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"
  }[c]));
  const extOf = (p) => (p.match(/\.([^.]+)$/) || ["",""])[1].toLowerCase();
  const baseName = (p) => p.split("/").pop() || p;
  const dirName = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
  const isImage = (p) => IMAGE_EXTS.includes(extOf(p));
  const isSvg = (p) => extOf(p) === "svg";
  const isBinaryImage = (p) => isImage(p) && !isSvg(p);
  const toast = (m, e) => { if (typeof window.toast === "function") window.toast(m, e); };

  const cmModeFor = (path) => {
    const e = extOf(path);
    if (["html","htm"].includes(e)) return "htmlmixed";
    if (e === "css") return "css";
    if (["js","mjs","jsx","ts","tsx"].includes(e)) return "javascript";
    if (e === "json") return { name: "javascript", json: true };
    if (e === "md") return "markdown";
    if (e === "py") return "python";
    if (["yml","yaml"].includes(e)) return "yaml";
    if (e === "sql") return "sql";
    if (["xml","svg"].includes(e)) return "xml";
    return null;
  };

  /* ============ IndexedDB ============ */
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbPut(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function dbGet(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function loadState() {
    try {
      const rec = await dbGet(PROJECT_ID);
      if (rec && rec.state) {
        state.files = rec.state.files || {};
        state.openTabs = (rec.state.openTabs || []).filter(p => state.files[p]);
        state.activeTab = state.files[rec.state.activeTab] ? rec.state.activeTab : (state.openTabs[0] || "");
        state.previewPath = state.files[rec.state.previewPath] ? rec.state.previewPath : "";
        state.folderClosed = rec.state.folderClosed || {};
        state.lastSaved = rec.savedAt || 0;
      }
    } catch (e) { console.warn("IndexedDB load error:", e); }
  }
  async function saveState(silent) {
    try {
      await dbPut({
        id: PROJECT_ID,
        savedAt: Date.now(),
        state: {
          files: state.files,
          openTabs: state.openTabs,
          activeTab: state.activeTab,
          previewPath: state.previewPath,
          folderClosed: state.folderClosed
        }
      });
      state.dirty = false;
      state.lastSaved = Date.now();
      if (!silent) toast("💾 تم الحفظ");
      return true;
    } catch (e) {
      console.error("Save error:", e);
      if (!silent) toast("فشل الحفظ — قد يكون التخزين ممتلئًا", true);
      return false;
    }
  }

  /* ============ عمليات الملفات ============ */
  function addTextFile(path, content) {
    path = path.replace(/^\/+/, "").replace(/\/+/g, "/");
    if (!path) return false;
    if (content.length > MAX_TEXT_SIZE) return false;
    state.files[path] = { content, size: content.length, isBinary: false, addedAt: Date.now() };
    return true;
  }
  function addBinaryFile(path, dataUrl, size) {
    path = path.replace(/^\/+/, "").replace(/\/+/g, "/");
    if (!path) return false;
    if (size > MAX_IMAGE_SIZE) return false;
    state.files[path] = { content: dataUrl, size, isBinary: true, addedAt: Date.now() };
    return true;
  }
  function deleteFile(path) {
    const prefix = path.endsWith("/") ? path : path + "/";
    Object.keys(state.files).forEach(k => { if (k === path || k.startsWith(prefix)) delete state.files[k]; });
    state.openTabs = state.openTabs.filter(p => state.files[p]);
    if (!state.files[state.activeTab]) state.activeTab = state.openTabs[0] || "";
    if (!state.files[state.previewPath]) state.previewPath = "";
    state.dirty = true;
    saveState(true); render();
  }
  function openFile(path) {
    if (!state.files[path]) return;
    if (!state.openTabs.includes(path)) state.openTabs.push(path);
    state.activeTab = path;
    saveState(true); render();
  }
  function closeTab(path) {
    state.openTabs = state.openTabs.filter(p => p !== path);
    if (state.activeTab === path) state.activeTab = state.openTabs[state.openTabs.length - 1] || "";
    saveState(true); render();
  }
  function renameFile(path) {
    const f = state.files[path];
    if (!f) return;
    const np = prompt("الاسم الجديد:", path);
    if (!np || np === path) return;
    const clean = np.replace(/^\/+/, "").replace(/\/+/g, "/");
    delete state.files[path];
    state.files[clean] = f;
    state.openTabs = state.openTabs.map(p => p === path ? clean : p);
    if (state.activeTab === path) state.activeTab = clean;
    if (state.previewPath === path) state.previewPath = clean;
    state.dirty = true;
    saveState(true); render();
  }

  /* ============ الاستيراد ============ */
  function readAsText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || "")); r.onerror = rej; r.readAsText(file, "utf-8"); }); }
  function readAsDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || "")); r.onerror = rej; r.readAsDataURL(file); }); }

  async function importFiles(list) {
    const arr = Array.from(list);
    if (!arr.length) return;
    let okT = 0, okI = 0, skip = 0;
    for (const f of arr) {
      const e = extOf(f.name);
      const path = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
      try {
        if (isSvg(path)) { if (addTextFile(path, await readAsText(f))) okT++; else skip++; continue; }
        if (isBinaryImage(path)) {
          if (f.size > MAX_IMAGE_SIZE) { skip++; continue; }
          if (addBinaryFile(path, await readAsDataURL(f), f.size)) okI++; else skip++;
          continue;
        }
        const isTxt = TEXT_EXTS.includes(e) || f.type.startsWith("text/") || f.type === "application/json" || f.type === "";
        if (!isTxt || f.size > MAX_TEXT_SIZE) { skip++; continue; }
        if (addTextFile(path, await readAsText(f))) okT++; else skip++;
      } catch { skip++; }
    }
    state.dirty = true;
    await saveState(true);
    render();
    toast(`نص: ${okT} · صور: ${okI}${skip ? ` · تُخطّي: ${skip}` : ""}`);
  }

  async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = CDN.jszip; s.onload = () => res(window.JSZip); s.onerror = rej; document.head.appendChild(s); });
  }

  async function importZip(file) {
    try {
      const JSZip = await ensureJSZip();
      const zip = await JSZip.loadAsync(file);
      let okT = 0, okI = 0, skip = 0;
      const entries = []; zip.forEach((p, e) => entries.push({ p, e }));
      for (const { p, e } of entries) {
        if (e.dir) continue;
        if (p.startsWith("__MACOSX/") || p.includes(".DS_Store") || p.endsWith("Thumbs.db")) continue;
        const clean = p.replace(/^\/+/, "");
        try {
          if (isSvg(clean)) { if (addTextFile(clean, await e.async("text"))) okT++; else skip++; continue; }
          if (isBinaryImage(clean)) {
            const b64 = await e.async("base64");
            const url = `data:${MIME_MAP[extOf(clean)] || "application/octet-stream"};base64,${b64}`;
            const sz = Math.round(b64.length * 3 / 4);
            if (addBinaryFile(clean, url, sz)) okI++; else skip++;
            continue;
          }
          if (!TEXT_EXTS.includes(extOf(clean))) { skip++; continue; }
          if (addTextFile(clean, await e.async("text"))) okT++; else skip++;
        } catch { skip++; }
      }
      state.dirty = true;
      await saveState(true);
      render();
      toast(`ZIP — نص: ${okT} · صور: ${okI}${skip ? ` · تُخطّي: ${skip}` : ""}`);
    } catch { toast("فشل قراءة ZIP", true); }
  }

  /* ============ التصدير ============ */
  function dl(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  function dataUrlToBlob(u) {
    const [meta, b64] = u.split(",");
    const mime = (meta.match(/data:([^;]+)/) || ["","application/octet-stream"])[1];
    const bin = atob(b64), by = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
    return new Blob([by], { type: mime });
  }
  function dlSingle(path) {
    const f = state.files[path]; if (!f) return;
    if (f.isBinary) dl(dataUrlToBlob(f.content), baseName(path));
    else dl(new Blob([f.content], { type: "text/plain;charset=utf-8" }), baseName(path));
  }
  async function dlAllZip() {
    const ps = Object.keys(state.files);
    if (!ps.length) return toast("لا توجد ملفات", true);
    try {
      const JSZip = await ensureJSZip();
      const zip = new JSZip();
      ps.forEach(p => {
        const f = state.files[p];
        if (f.isBinary) zip.file(p, f.content.split(",")[1] || "", { base64: true });
        else zip.file(p, f.content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      dl(blob, `mueen-${new Date().toISOString().slice(0,10)}.zip`);
      toast("تم تحميل المشروع");
    } catch { toast("تعذر إنشاء ZIP", true); }
  }

  /* ============ بناء المعاينة ============ */
  function pickPreviewHtml() {
    if (state.previewPath && state.files[state.previewPath]) return state.previewPath;
    if (state.files["index.html"]) return "index.html";
    if (state.activeTab && ["html","htm"].includes(extOf(state.activeTab))) return state.activeTab;
    return Object.keys(state.files).find(p => ["html","htm"].includes(extOf(p))) || "";
  }
  function resolvePath(base, rel) {
    if (!rel) return rel;
    if (/^(https?:|data:|\/\/|#|mailto:|tel:)/.test(rel)) return rel;
    if (rel.startsWith("/")) return rel.slice(1);
    const parts = (base ? base.split("/") : []).concat(rel.split("/"));
    const st = [];
    parts.forEach(p => { if (p === "" || p === ".") return; if (p === "..") st.pop(); else st.push(p); });
    return st.join("/");
  }
  function imageToDataUrl(path) {
    const f = state.files[path]; if (!f || !isImage(path)) return null;
    if (f.isBinary) return f.content;
    try { return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(f.content)))}`; }
    catch { return `data:image/svg+xml;utf8,${encodeURIComponent(f.content)}`; }
  }
  function resolveCssUrls(css, baseDir) {
    return css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, (m, url) => {
      if (/^(data:|https?:|\/\/|#)/.test(url)) return m;
      const r = resolvePath(baseDir, url);
      const d = imageToDataUrl(r);
      return d ? `url("${d}")` : m;
    });
  }
  function resolveHtmlAssets(html, baseDir) {
    html = html.replace(/(<(?:img|source|video|audio|input)[^>]*\s(?:src|poster)=["'])([^"']+)(["'])/gi, (m, pre, url, post) => {
      if (/^(data:|https?:|\/\/|#)/.test(url)) return m;
      const r = resolvePath(baseDir, url), d = imageToDataUrl(r);
      return d ? pre + d + post : m;
    });
    html = html.replace(/(<link[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*href=["'])([^"']+)(["'])/gi, (m, pre, url, post) => {
      if (/^(data:|https?:|\/\/|#)/.test(url)) return m;
      const r = resolvePath(baseDir, url), d = imageToDataUrl(r);
      return d ? pre + d + post : m;
    });
    html = html.replace(/(\sstyle=["'])([^"']*)(["'])/gi, (m, pre, styles, post) => pre + resolveCssUrls(styles, baseDir) + post);
    return html;
  }

  // حقن سكريبت التقاط console
  const CONSOLE_HOOK = `<script>
(function(){
  var send = function(type, args){
    try {
      var safe = [];
      for (var i=0;i<args.length;i++){
        var a = args[i];
        try { safe.push(typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)); }
        catch(e){ safe.push(String(a)); }
      }
      parent.postMessage({ __mueenConsole: true, type: type, args: safe }, '*');
    } catch(e){}
  };
  ['log','warn','error','info','debug'].forEach(function(m){
    var orig = console[m];
    console[m] = function(){ send(m, arguments); try{ orig.apply(console, arguments); }catch(e){} };
  });
  window.addEventListener('error', function(e){
    send('error', [(e.message || 'خطأ') + ' — السطر ' + (e.lineno || '?')]);
  });
  window.addEventListener('unhandledrejection', function(e){
    send('error', ['Unhandled Promise: ' + (e.reason && e.reason.message || e.reason || '')]);
  });
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if (a && a.href && /^https?:/i.test(a.href)) { e.preventDefault(); parent.postMessage({ __mueenConsole: true, type: 'info', args: ['🔗 رابط: ' + a.href] }, '*'); }
  }, true);
})();
</script>`;

  function buildPreviewHtml() {
    const hp = pickPreviewHtml();
    if (!hp) return "";
    let html = state.files[hp].content;
    const base = dirName(hp);

    // إدراج سكريبت التقاط console في أول <head>
    const hook = CONSOLE_HOOK;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => m + "\n" + hook);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (m) => m + "\n<head>" + hook + "</head>");
    } else {
      html = hook + html;
    }

    html = html.replace(/<link\s+[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (m, href) => {
      const r = resolvePath(base, href);
      if (state.files[r] && !state.files[r].isBinary) return `<style>\n${resolveCssUrls(state.files[r].content, dirName(r))}\n</style>`;
      return m;
    });
    html = html.replace(/<script\s+[^>]*src=["']([^"']+\.(?:js|mjs))["'][^>]*>\s*<\/script>/gi, (m, src) => {
      const r = resolvePath(base, src);
      if (state.files[r] && !state.files[r].isBinary) return `<script>\n${state.files[r].content}\n</script>`;
      return m;
    });
    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => `<style>\n${resolveCssUrls(css, base)}\n</style>`);
    html = resolveHtmlAssets(html, base);
    return html;
  }

  /* ============ CodeMirror ============ */
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }
  async function ensureCodeMirror() {
    if (window.CodeMirror) return;
    if (cmLoading) return cmLoading;
    cmLoading = (async () => {
      loadCss(CDN.cmCss);
      loadCss(CDN.cmTheme);
      await loadScript(CDN.cmJs);
      for (const m of CDN.cmModes) await loadScript(m);
      for (const a of CDN.cmAddons) {
        if (a.endsWith(".css")) loadCss(a);
        else await loadScript(a);
      }
    })();
    return cmLoading;
  }

  function initEditor(container, path, content) {
    if (cm) { cm.toTextArea && cm.toTextArea(); }
    container.innerHTML = "";
    const mode = cmModeFor(path);
    cm = CodeMirror(container, {
      value: content,
      mode: mode,
      theme: "dracula",
      lineNumbers: true,
      lineWrapping: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
      tabSize: 2,
      indentUnit: 2,
      extraKeys: {
        "Ctrl-F": "findPersistent",
        "Cmd-F": "findPersistent",
        "Ctrl-H": "replace",
        "Cmd-H": "replace",
        "Ctrl-S": () => { saveNow(); },
        "Cmd-S": () => { saveNow(); },
        "Tab": (cmi) => cmi.replaceSelection("  ")
      }
    });
    cm.on("change", () => {
      if (!state.activeTab || !state.files[state.activeTab]) return;
      state.files[state.activeTab].content = cm.getValue();
      state.files[state.activeTab].size = cm.getValue().length;
      state.dirty = true;
      resetIdleTimer();
      if (state.liveReload) { clearTimeout(cm._previewT); cm._previewT = setTimeout(refreshModalPreview, 600); }
      updateCursorInfo();
    });
    cm.on("cursorActivity", updateCursorInfo);
    setTimeout(() => cm.refresh(), 100);
    updateCursorInfo();
  }

  function updateCursorInfo() {
    const el = document.getElementById("esCursorInfo");
    if (!el || !cm) return;
    const c = cm.getCursor();
    el.textContent = `سطر ${c.line + 1} · عمود ${c.ch + 1}`;
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (state.dirty) saveNow(true);
    }, AUTOSAVE_IDLE_MS);
  }

  async function saveNow(silent) {
    const ok = await saveState(silent);
    if (ok) updateSaveInfo();
  }

  function updateSaveInfo() {
    const el = document.getElementById("esSaveInfo");
    if (!el) return;
    el.textContent = state.lastSaved ? `آخر حفظ: ${new Date(state.lastSaved).toLocaleTimeString("ar")}` : "لم يُحفظ بعد";
    el.style.color = state.dirty ? "#f59e0b" : "var(--muted)";
  }

  /* ============ Console ============ */
  function onConsoleMessage(e) {
    const d = e.data;
    if (!d || !d.__mueenConsole) return;
    addConsoleLog(d.type, d.args.join(" "));
  }
  function addConsoleLog(type, text) {
    state.consoleLogs.push({ type, text, ts: Date.now() });
    if (state.consoleLogs.length > 300) state.consoleLogs.shift();
    renderConsole();
  }
  function renderConsole() {
    const box = document.getElementById("esConsoleBody");
    if (!box) return;
    if (!state.consoleLogs.length) {
      box.innerHTML = `<div class="es-console-empty">لا رسائل بعد. اضغط ▶ تشغيل لبدء المشروع.</div>`;
      return;
    }
    box.innerHTML = state.consoleLogs.map(l => {
      const cls = l.type === "error" ? "err" : l.type === "warn" ? "warn" : l.type === "info" ? "info" : "log";
      const time = new Date(l.ts).toLocaleTimeString("ar", { hour12: false });
      return `<div class="es-console-line ${cls}"><span class="es-console-time">${time}</span><span class="es-console-type">${l.type}</span><span class="es-console-text">${escapeHtml(l.text)}</span></div>`;
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  /* ============ نافذة المعاينة ملء الشاشة ============ */
  function openPreviewModal() {
    const modal = document.getElementById("esModal");
    if (!modal) return;
    if (!pickPreviewHtml()) {
      return toast("لا يوجد ملف HTML للمعاينة — أضف index.html", true);
    }
    modal.hidden = false;
    document.body.classList.add("es-modal-open");
    refreshModalPreview();
    // مسح logs القديمة
    state.consoleLogs = [];
    renderConsole();
  }
  function closePreviewModal() {
    const modal = document.getElementById("esModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("es-modal-open");
  }
  function refreshModalPreview() {
    const f = document.getElementById("esModalFrame");
    if (!f) return;
    f.srcdoc = buildPreviewHtml() || "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:40px;text-align:center;color:#888'><p>لا يوجد HTML</p></body></html>";
  }
  function openPreviewInNewTab() {
    const html = buildPreviewHtml();
    if (!html) return toast("لا يوجد HTML", true);
    const w = window.open();
    if (!w) return toast("السماح بالنوافذ المنبثقة مطلوب", true);
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ============ شجرة الملفات ============ */
  function buildTree(paths) {
    const root = { name: "", folders: {}, files: [] };
    paths.forEach(p => {
      const parts = p.split("/");
      let n = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const f = parts[i];
        if (!n.folders[f]) n.folders[f] = { name: f, folders: {}, files: [] };
        n = n.folders[f];
      }
      n.files.push({ name: parts[parts.length - 1], path: p });
    });
    return root;
  }
  const iconFor = (p) => {
    const e = extOf(p);
    if (["html","htm"].includes(e)) return "🌐";
    if (e === "css") return "🎨";
    if (["js","mjs","jsx","ts","tsx"].includes(e)) return "⚡";
    if (e === "json") return "📋";
    if (e === "md") return "📝";
    if (["png","jpg","jpeg","gif","webp","ico","bmp","avif"].includes(e)) return "🖼";
    if (e === "svg") return "🎭";
    return "📄";
  };

  function renderTreeNode(node, prefix, depth) {
    const folderKeys = Object.keys(node.folders).sort();
    const fileList = node.files.slice().sort((a,b) => a.name.localeCompare(b.name));
    let html = "";
    folderKeys.forEach(k => {
      const folderPath = prefix ? prefix + "/" + k : k;
      const closed = !!state.folderClosed[folderPath];
      const childPrefix = folderPath;
      const childrenHtml = closed ? "" : renderTreeNode(node.folders[k], childPrefix, depth + 1);
      html += `<div class="es-folder ${closed ? "closed" : ""}" data-folder="${escapeHtml(folderPath)}" style="padding-inline-start:${6 + depth * 12}px">
        <span class="es-arrow">${closed ? "▸" : "▾"}</span>
        <span class="es-ic">📁</span>
        <span class="es-name">${escapeHtml(k)}</span>
      </div>`;
      if (!closed) html += childrenHtml;
    });
    fileList.forEach(f => {
      const active = f.path === state.activeTab ? " active" : "";
      html += `<div class="es-file${active}" data-open="${escapeHtml(f.path)}" style="padding-inline-start:${6 + depth * 12}px">
        <span class="es-ic">${iconFor(f.path)}</span>
        <span class="es-name" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
        <button class="es-btn" data-rename="${escapeHtml(f.path)}" title="تغيير الاسم">✎</button>
        <button class="es-btn es-del" data-del="${escapeHtml(f.path)}" title="حذف">×</button>
      </div>`;
    });
    return html;
  }

  /* ============ CSS ============ */
  function injectStyles() {
    if (document.getElementById("esStyles")) return;
    const s = document.createElement("style");
    s.id = "esStyles";
    s.textContent = `
      body.es-modal-open { overflow: hidden; }
      .es-wrap { display: grid; grid-template-columns: 240px 1fr; gap: 10px; min-height: 72vh; }
      .es-side { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 8px; overflow-y: auto; max-height: 78vh; }
      .es-side-actions { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
      .es-side-actions button { flex: 1 1 auto; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-soft); color: var(--text); padding: 6px 8px; font-size: 11px; cursor: pointer; }
      .es-side-actions button:hover { color: var(--primary); border-color: var(--primary); }
      .es-folder, .es-file { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; overflow: hidden; user-select: none; }
      .es-folder { color: var(--muted); font-weight: 600; }
      .es-folder:hover, .es-file:hover { background: var(--surface-soft); }
      .es-file.active { background: var(--surface-soft); color: var(--primary); font-weight: 700; }
      .es-arrow { width: 12px; text-align: center; flex: 0 0 12px; font-size: 10px; }
      .es-ic { width: 18px; text-align: center; flex: 0 0 18px; }
      .es-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
      .es-btn { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 0 3px; font-size: 13px; }
      .es-btn:hover { color: var(--primary); }
      .es-btn.es-del:hover { color: #b42318; }
      .es-empty { color: var(--muted); font-size: 12px; padding: 30px 10px; text-align: center; line-height: 1.8; }

      .es-main { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: grid; grid-template-rows: auto auto 1fr auto; min-height: 72vh; overflow: hidden; }
      .es-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border); overflow-x: auto; background: var(--surface-soft); padding: 4px 4px 0; }
      .es-tab { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; border: 1px solid var(--border); border-bottom: 0; border-radius: 8px 8px 0 0; background: var(--surface); color: var(--muted); padding: 6px 10px; font-size: 12px; cursor: pointer; }
      .es-tab.active { color: var(--primary); font-weight: 700; }
      .es-tab .es-tab-x { border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 14px; padding: 0 2px; }
      .es-tab .es-tab-x:hover { color: #b42318; }

      .es-toolbar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--surface); }
      .es-toolbar button { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); padding: 6px 10px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
      .es-toolbar button:hover { border-color: var(--primary); }
      .es-toolbar .primary { background: var(--primary); color: #fff; border-color: var(--primary); font-weight: 700; }
      .es-toolbar .primary:hover { background: var(--primary-dark); }
      .es-toolbar .es-spacer { flex: 1; }
      .es-toolbar label { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); cursor: pointer; }
      .es-toolbar #esSaveInfo { font-size: 11px; color: var(--muted); margin-inline-start: 8px; }

      .es-editor-wrap { min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
      .es-editor { flex: 1; min-height: 400px; overflow: auto; }
      .es-editor .CodeMirror { height: 100% !important; min-height: 400px; font-size: 13px; }
      .es-editor-info { display: flex; justify-content: space-between; gap: 8px; padding: 4px 10px; background: var(--surface-soft); border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }

      .es-console { border-top: 1px solid var(--border); background: #0d1a18; color: #d1fae5; max-height: 240px; display: grid; grid-template-rows: auto 1fr; }
      .es-console[hidden] { display: none; }
      .es-console-head { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: #06120f; border-bottom: 1px solid #1c3b36; font-size: 12px; }
      .es-console-head strong { color: #7fa89e; }
      .es-console-head button { border: 1px solid #1c3b36; background: transparent; color: #7fa89e; border-radius: 6px; padding: 2px 8px; cursor: pointer; font-size: 11px; }
      .es-console-head button:hover { color: #d1fae5; }
      .es-console-head .es-console-count { color: #4a6a61; font-size: 11px; margin-inline-start: auto; margin-inline-end: 6px; }
      .es-console-body { overflow: auto; padding: 6px 0; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; }
      .es-console-empty { color: #4a6a61; padding: 20px; text-align: center; font-family: inherit; }
      .es-console-line { display: grid; grid-template-columns: 60px 60px 1fr; gap: 8px; padding: 2px 10px; border-bottom: 1px solid #122522; }
      .es-console-time { color: #4a6a61; }
      .es-console-type { text-transform: uppercase; font-weight: 700; font-size: 10px; }
      .es-console-line.log .es-console-type { color: #7fa89e; }
      .es-console-line.info .es-console-type { color: #60a5fa; }
      .es-console-line.info { background: rgba(96,165,250,.06); }
      .es-console-line.warn .es-console-type { color: #f59e0b; }
      .es-console-line.warn { background: rgba(245,158,11,.06); }
      .es-console-line.err .es-console-type { color: #ef4444; }
      .es-console-line.err { background: rgba(239,68,68,.08); color: #fecaca; }
      .es-console-text { word-break: break-word; white-space: pre-wrap; }

      /* نافذة المعاينة ملء الشاشة */
      .es-modal { position: fixed; inset: 0; z-index: 9999; background: #0a0f0d; display: grid; grid-template-rows: auto 1fr; }
      .es-modal[hidden] { display: none !important; }
      .es-modal-head { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: #06120f; border-bottom: 1px solid #1c3b36; color: #d1fae5; }
      .es-modal-head strong { color: #7fa89e; }
      .es-modal-head select { border: 1px solid #1c3b36; border-radius: 6px; background: #0d1a18; color: #d1fae5; padding: 4px 8px; font-size: 12px; }
      .es-modal-head button { border: 1px solid #1c3b36; background: transparent; color: #7fa89e; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; }
      .es-modal-head button:hover { color: #d1fae5; border-color: #2b4b46; }
      .es-modal-head .es-modal-close { margin-inline-start: auto; font-size: 18px; padding: 4px 12px; }
      .es-modal-body { display: grid; place-items: center; overflow: auto; padding: 0; }
      .es-modal-body iframe { width: 100%; height: 100%; border: 0; background: #fff; }
      .es-modal-body.mobile { padding: 16px; }
      .es-modal-body.mobile iframe { width: 375px; max-width: 100%; height: 100%; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
      .es-modal-body.tablet { padding: 16px; }
      .es-modal-body.tablet iframe { width: 768px; max-width: 100%; height: 100%; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }

      @media (max-width: 800px) {
        .es-wrap { grid-template-columns: 1fr; }
        .es-side { max-height: 200px; }
        .es-editor .CodeMirror { font-size: 12px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ============ الصفحة ============ */
  function ensurePage() {
    let p = document.getElementById(PAGE_ID);
    if (p) return p;
    const c = document.querySelector(".page-container");
    if (!c) return null;
    p = document.createElement("section");
    p.id = PAGE_ID;
    p.className = "mueen-extra-page";
    c.appendChild(p);
    return p;
  }

  function render() {
    injectStyles();
    const page = ensurePage();
    if (!page) return;

    const filePaths = Object.keys(state.files).sort();
    const tree = buildTree(filePaths);
    const previewCandidates = filePaths.filter(p => ["html","htm"].includes(extOf(p)));
    const activeIsImage = state.activeTab && isImage(state.activeTab);
    const activeIsBinaryImage = activeIsImage && isBinaryImage(state.activeTab);

    page.innerHTML = `
      <div class="page-heading simple-heading">
        <div>
          <p class="eyebrow">استوديو الملفات</p>
          <h1>تحرير وتشغيل مشروع كامل</h1>
          <p class="page-description">استورد مجلدًا أو ZIP، حرّر الأكواد مع تلوين، شغّل المشروع ملء الشاشة، وشاهد الأخطاء في Console.</p>
        </div>
      </div>
      <div class="extra-page-content">
        <div class="es-wrap">
          <aside class="es-side">
            <div class="es-side-actions">
              <button type="button" id="esAddFile">+ ملف</button>
              <button type="button" id="esImport">📥 ملفات</button>
              <button type="button" id="esImportFolder">📂 مجلد</button>
              <button type="button" id="esImportZip">🗜 ZIP</button>
            </div>
            <div id="esTree">${filePaths.length ? renderTreeNode(tree, "", 0) : `<div class="es-empty">لا توجد ملفات بعد.<br>استورد مجلدًا أو ZIP.</div>`}</div>
          </aside>

          <section class="es-main">
            <div class="es-tabs">
              ${state.openTabs.length ? state.openTabs.map(p => `
                <div class="es-tab${p === state.activeTab ? " active" : ""}" data-open="${escapeHtml(p)}">
                  <span>${escapeHtml(baseName(p))}</span>
                  <button class="es-tab-x" data-close="${escapeHtml(p)}">×</button>
                </div>`).join("") : `<div class="es-tab" style="opacity:.5;cursor:default">افتح ملفًا للتحرير</div>`}
            </div>

            <div class="es-toolbar">
              <button type="button" class="primary" id="esRun" title="تشغيل المعاينة ملء الشاشة">▶ تشغيل</button>
              <button type="button" id="esSave" title="حفظ (Ctrl+S)">💾 حفظ</button>
              <button type="button" id="esReload" title="تحديث المعاينة">🔄</button>
              <label><input type="checkbox" id="esLive" ${state.liveReload ? "checked" : ""}> Live</label>
              <button type="button" id="esConsoleToggle">${state.showConsole ? "▼ Console" : "▲ Console"}</button>
              <span id="esSaveInfo">${state.lastSaved ? "آخر حفظ: " + new Date(state.lastSaved).toLocaleTimeString("ar") : "لم يُحفظ بعد"}</span>
              <span class="es-spacer"></span>
              <button type="button" id="esDlOne" title="تحميل الملف الحالي">⬇</button>
              <button type="button" id="esDlZip" title="تحميل الكل ZIP">🗜</button>
              <button type="button" id="esClearAll" title="مسح الكل">🗑</button>
            </div>

            <div class="es-editor-wrap">
              <div class="es-editor" id="esEditor"></div>
              <div class="es-editor-info">
                <span id="esFileName">${state.activeTab ? escapeHtml(state.activeTab) : "—"}</span>
                <span id="esCursorInfo">سطر 1 · عمود 1</span>
              </div>
            </div>

            <div class="es-console" id="esConsole" ${state.showConsole ? "" : "hidden"}>
              <div class="es-console-head">
                <strong>Console</strong>
                <button type="button" id="esConsoleClear">مسح</button>
                <span class="es-console-count" id="esConsoleCount"></span>
              </div>
              <div class="es-console-body" id="esConsoleBody"></div>
            </div>
          </section>
        </div>
      </div>
    `;

    // نافذة المعاينة
    if (!document.getElementById("esModal")) {
      const modal = document.createElement("div");
      modal.id = "esModal";
      modal.className = "es-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="es-modal-head">
          <strong>▶ معاينة المشروع</strong>
          <select id="esModalDevice">
            <option value="desktop">💻 كمبيوتر</option>
            <option value="tablet">▢ تابلت</option>
            <option value="mobile">📱 هاتف</option>
          </select>
          <select id="esModalPick">
            ${previewCandidates.length
              ? previewCandidates.map(p => `<option value="${escapeHtml(p)}" ${p === (state.previewPath || pickPreviewHtml()) ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")
              : `<option value="">لا يوجد HTML</option>`}
          </select>
          <button type="button" id="esModalReload">🔄 تحديث</button>
          <button type="button" id="esModalNewTab">فتح في نافذة جديدة</button>
          <button type="button" class="es-modal-close" id="esModalClose">✕</button>
        </div>
        <div class="es-modal-body" id="esModalBody">
          <iframe id="esModalFrame" sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups allow-pointer-lock"></iframe>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector("#esModalClose").onclick = closePreviewModal;
      modal.querySelector("#esModalReload").onclick = refreshModalPreview;
      modal.querySelector("#esModalNewTab").onclick = openPreviewInNewTab;
      modal.querySelector("#esModalDevice").onchange = (e) => {
        modal.querySelector("#esModalBody").className = "es-modal-body " + e.target.value;
      };
      modal.querySelector("#esModalPick").onchange = (e) => {
        state.previewPath = e.target.value;
        saveState(true);
        refreshModalPreview();
      };
    }

    /* ============ ربط الأحداث ============ */
    // شجرة
    page.querySelectorAll("[data-folder]").forEach(el => {
      el.addEventListener("click", () => {
        const f = el.dataset.folder;
        state.folderClosed[f] = !state.folderClosed[f];
        saveState(true);
        render();
      });
    });
    page.querySelectorAll("[data-open]").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-close]") || e.target.closest("[data-rename]") || e.target.closest("[data-del]")) return;
        openFile(el.dataset.open);
      });
    });
    page.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); closeTab(el.dataset.close); }));
    page.querySelectorAll("[data-rename]").forEach(el => el.addEventListener("click", (e) => { e.stopPropagation(); renameFile(el.dataset.rename); }));
    page.querySelectorAll("[data-del]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = el.dataset.del;
        if (confirm(`حذف "${p}"؟`)) deleteFile(p);
      });
    });

    // إضافة ملف
    page.querySelector("#esAddFile").onclick = () => {
      const n = prompt("اسم الملف (مثال: index.html أو css/app.css):", "new.html");
      if (!n) return;
      if (state.files[n]) return toast("الملف موجود", true);
      addTextFile(n, "");
      state.dirty = true;
      saveState(true);
      openFile(n);
    };

    // مدخلات الملفات
    const fInput = document.createElement("input");
    fInput.type = "file"; fInput.multiple = true;
    fInput.accept = ".html,.htm,.css,.js,.mjs,.jsx,.ts,.tsx,.json,.md,.txt,.py,.java,.php,.sql,.xml,.yml,.yaml,.toml,.sh,.env,.c,.cpp,.h,.hpp,.rb,.go,.rs,.vue,.svelte,.png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.avif,image/*";
    fInput.onchange = () => importFiles(fInput.files);

    const dInput = document.createElement("input");
    dInput.type = "file"; dInput.multiple = true; dInput.webkitdirectory = true;
    dInput.onchange = () => importFiles(dInput.files);

    const zInput = document.createElement("input");
    zInput.type = "file"; zInput.accept = ".zip";
    zInput.onchange = () => { if (zInput.files[0]) importZip(zInput.files[0]); };

    page.querySelector("#esImport").onclick = () => fInput.click();
    page.querySelector("#esImportFolder").onclick = () => dInput.click();
    page.querySelector("#esImportZip").onclick = () => zInput.click();

    // تشغيل
    page.querySelector("#esRun").onclick = openPreviewModal;
    page.querySelector("#esSave").onclick = () => saveNow(false);
    page.querySelector("#esReload").onclick = () => {
      if (document.getElementById("esModal").hidden) openPreviewModal();
      else refreshModalPreview();
    };
    page.querySelector("#esLive").onchange = (e) => { state.liveReload = e.target.checked; };
    page.querySelector("#esConsoleToggle").onclick = () => {
      state.showConsole = !state.showConsole;
      const c = page.querySelector("#esConsole");
      c.hidden = !state.showConsole;
      page.querySelector("#esConsoleToggle").textContent = state.showConsole ? "▼ Console" : "▲ Console";
      if (cm) setTimeout(() => cm.refresh(), 50);
    };
    page.querySelector("#esConsoleClear").onclick = () => { state.consoleLogs = []; renderConsole(); };
    page.querySelector("#esDlOne").onclick = () => { if (state.activeTab) dlSingle(state.activeTab); else toast("افتح ملفًا", true); };
    page.querySelector("#esDlZip").onclick = dlAllZip;
    page.querySelector("#esClearAll").onclick = async () => {
      if (!Object.keys(state.files).length) return;
      if (!confirm("حذف جميع الملفات؟")) return;
      state.files = {}; state.openTabs = []; state.activeTab = ""; state.previewPath = ""; state.consoleLogs = [];
      state.dirty = true;
      await saveState(true);
      render();
    };

    // المحرر
    const editorEl = page.querySelector("#esEditor");
    if (state.activeTab && state.files[state.activeTab]) {
      if (activeIsBinaryImage) {
        const url = imageToDataUrl(state.activeTab);
        editorEl.innerHTML = `<div style="display:grid;place-items:center;padding:20px;min-height:400px;background:repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 0 0 / 20px 20px;overflow:auto"><img src="${url}" style="max-width:100%;max-height:60vh;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.15)"></div>`;
      } else {
        // تحميل CodeMirror
        ensureCodeMirror().then(() => {
          initEditor(editorEl, state.activeTab, state.files[state.activeTab].content);
        }).catch(() => {
          // fallback: textarea
          editorEl.innerHTML = `<textarea id="esFallback" dir="ltr" style="width:100%;min-height:400px;border:0;outline:0;background:#10201e;color:#d1fae5;padding:14px;font:13px/1.6 monospace">${escapeHtml(state.files[state.activeTab].content)}</textarea>`;
          const ta = editorEl.querySelector("#esFallback");
          ta.addEventListener("input", () => {
            state.files[state.activeTab].content = ta.value;
            state.dirty = true;
            resetIdleTimer();
          });
        });
      }
    } else {
      editorEl.innerHTML = `<div class="es-empty" style="padding:80px 20px">اختر ملفًا من الشجرة للتحرير</div>`;
    }

    // console info
    const cnt = page.querySelector("#esConsoleCount");
    if (cnt) cnt.textContent = state.consoleLogs.length ? `${state.consoleLogs.length} رسالة` : "";
    renderConsole();
    updateSaveInfo();
  }

  /* ============ رسائل iframe ============ */
  window.addEventListener("message", onConsoleMessage);

  // اختصارات لوحة المفاتيح
  document.addEventListener("keydown", (e) => {
    if (document.getElementById(PAGE_ID)?.classList.contains("active-page")) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow(false);
      }
      if (e.key === "Escape" && !document.getElementById("esModal").hidden) {
        closePreviewModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        openPreviewModal();
      }
    }
  });

  // حفظ عند إغلاق الصفحة
  window.addEventListener("beforeunload", () => {
    if (state.dirty) saveState(true);
  });

  /* ============ التهيئة ============ */
  (async () => {
    await loadState();
    window.renderEditorStudio = render;
    window.MUEEN_EDITOR = {
      render,
      save: () => saveNow(false),
      get files() { return state.files; },
      import: importFiles,
      exportZip: dlAllZip
    };
    if (location.hash === "#editor") {
      const el = document.getElementById(PAGE_ID);
      if (el && el.classList.contains("active-page")) render();
    }
  })();
})();