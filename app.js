/* مُعين v1.7 — مساحة المبرمج العربي */

const DATA_KEY = "mueen_data_v2";
const THEME_KEY = "mueen_theme";
const FONT_KEY = "mueen_font_size";
// ✅ إصلاح 1: أضفنا "editor" إلى قائمة الصفحات
const PAGES = [
  "home", "tasks", "snippets", "tools", "notes",
  "projects", "focus", "templates", "achievements", "extra-tools", "settings", "convert", "guide", "editor"
];

const emptyData = {
  tasks: [],
  snippets: [],
  notes: [],
  projects: [],
  focusSessions: [],
  usedDays: [],
  settings: { fontSize: "normal", lastExportAt: "", backupNudgeAt: "", zen: false }
};

const SNIPPET_LANGS = ["JavaScript", "HTML", "CSS", "Python", "SQL", "JSON", "أخرى"];

let data = loadData();
let taskFilter = "all";
let snippetFilter = "all";
let activeTool = null;
let paletteIndex = 0;
let timer = {
  seconds: 25 * 60,
  duration: 25 * 60,
  breakSeconds: 5 * 60,
  running: false,
  mode: "تركيز",
  interval: null,
  taskId: "",
  projectId: ""
};

function loadData() {
  try {
    const old = JSON.parse(localStorage.getItem(DATA_KEY));
    return {
      ...emptyData,
      ...(old || {}),
      tasks: Array.isArray(old?.tasks) ? old.tasks : [],
      snippets: Array.isArray(old?.snippets) ? old.snippets : [],
      notes: Array.isArray(old?.notes) ? old.notes : [],
      projects: Array.isArray(old?.projects) ? old.projects : [],
      focusSessions: Array.isArray(old?.focusSessions) ? old.focusSessions : [],
      usedDays: Array.isArray(old?.usedDays) ? old.usedDays : [],
      settings: { ...emptyData.settings, ...(old?.settings || {}) }
    };
  } catch {
    return structuredClone(emptyData);
  }
}

function saveData() {
  const today = new Date().toISOString().slice(0, 10);
  if (!data.usedDays.includes(today)) data.usedDays.push(today);
  data.usedDays = [...new Set(data.usedDays)].sort();
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  updateCounters();
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[c]));
}

function dateText(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function projectName(id) {
  return data.projects.find((p) => p.id === id)?.name || "";
}

function projectOptions(selected = "") {
  return `<option value="">بدون مشروع</option>${data.projects.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
}

function toast(message, error = false) {
  let el = document.getElementById("mueenToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "mueenToast";
    el.style.cssText = "position:fixed;z-index:1000;right:20px;bottom:88px;max-width:calc(100% - 40px);padding:12px 16px;border-radius:12px;color:#fff;box-shadow:0 8px 25px rgba(0,0,0,.2);font-size:14px;transition:opacity .2s";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.background = error ? "#b42318" : "#12312e";
  el.style.opacity = "1";
  clearTimeout(el.timer);
  el.timer = setTimeout(() => { el.style.opacity = "0"; }, 2800);
}

function streakCount() {
  const days = [...new Set(data.usedDays)].sort();
  if (!days.length) return 0;
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.includes(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (key === todayISO()) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    if (streak > 400) break;
  }
  return streak;
}

function weekFocusMinutes() {
  const from = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return data.focusSessions.reduce((sum, s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= from ? sum + (Number(s.minutes) || 25) : sum;
  }, 0);
}

function updateCounters() {
  const open = data.tasks.filter((x) => !x.completed).length;
  const a = document.getElementById("homeTasksCount");
  const b = document.getElementById("homeSnippetsCount");
  const c = document.getElementById("homeNotesCount");
  const d = document.getElementById("homeStreakCount");
  if (a) a.textContent = open;
  if (b) b.textContent = data.snippets.length;
  if (c) c.textContent = data.notes.length;
  if (d) d.textContent = streakCount();
}

function modal(title, html, submit) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "mueen-modal-backdrop";
  backdrop.innerHTML = `<div class="mueen-modal" role="dialog" aria-modal="true"><div class="mueen-modal-header"><h2>${esc(title)}</h2><button class="mueen-close" type="button" aria-label="إغلاق">×</button></div><div class="mueen-modal-body">${html}</div></div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector(".mueen-close").onclick = closeModal;
  backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };
  const form = backdrop.querySelector("form");
  if (form && submit) {
    form.onsubmit = (e) => {
      e.preventDefault();
      submit(new FormData(form), backdrop);
    };
    form.querySelector("input, textarea, select")?.focus();
  }
  return backdrop;
}

function closeModal() {
  document.querySelectorAll(".mueen-modal-backdrop").forEach((x) => x.remove());
}

function page(name, title, eyebrow, description) {
  const main = document.querySelector(".page-container");
  const id = `${name}Page`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("section");
    el.id = id;
    el.className = "mueen-extra-page";
    main.appendChild(el);
  }
  el.innerHTML = `<div class="page-heading simple-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p class="page-description">${esc(description)}</p></div><div class="extra-page-actions"></div></div><div class="extra-page-content"></div>`;
  return el;
}

function showPage(name) {
  if (!PAGES.includes(name)) name = "home";
  document.querySelectorAll(".page, .mueen-extra-page").forEach((el) => {
    el.classList.toggle("active-page", el.id === `${name}Page`);
  });
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === name);
  });
  closeMenu();
  closePalette();
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "home") renderHome();
  if (name === "projects") renderProjects();
  if (name === "focus") renderFocus();
  if (name === "templates") {
    if (typeof window.renderTemplateStudio === "function") window.renderTemplateStudio();
    else renderTemplates();
  }
  if (name === "achievements") renderAchievements();
  if (name === "settings") renderSettings();
  if (name === "extra-tools") renderExtraTools();
  if (name === "convert" && typeof window.renderCodeConverter === "function") window.renderCodeConverter();
  if (name === "guide" && typeof window.renderSiteGuide === "function") window.renderSiteGuide();
  // ✅ إصلاح 3: ربط صفحة editor بالدالة
  if (name === "editor" && typeof window.renderEditorStudio === "function") window.renderEditorStudio();
}

function recommendedTask() {
  const open = data.tasks.filter((t) => !t.completed);
  const today = todayISO();
  const dueToday = open.filter((t) => t.dueDate === today);
  const high = open.filter((t) => t.priority === "high");
  return dueToday[0] || high[0] || open[0] || null;
}

function renderHome() {
  const rec = recommendedTask();
  const streak = streakCount();
  const label = document.getElementById("streakLabel");
  const title = document.getElementById("heroTitle");
  const text = document.getElementById("heroText");
  const actions = document.getElementById("heroActions");
  if (label) label.textContent = streak ? `${streak} يوم متتالي` : "جاهز للإنجاز";
  if (rec) {
    if (title) title.textContent = rec.title;
    if (text) text.textContent = `${rec.priority === "high" ? "أولوية عالية" : "مهمتك التالية"}${rec.project ? ` · ${projectName(rec.project)}` : ""}${rec.dueDate ? ` · ${dateText(rec.dueDate)}` : ""}`;
    if (actions) {
      actions.innerHTML = `
        <button class="primary-button" type="button" id="heroFocus">بدء تركيز 25 د</button>
        <button class="small-action" type="button" data-page="tasks">كل المهام</button>`;
      actions.querySelector("#heroFocus").onclick = () => startFocusOn(rec.id, rec.project || "");
    }
  } else {
    if (title) title.textContent = "ماذا ستنجز اليوم؟";
    if (text) text.textContent = "لا توجد مهام مفتوحة. أضف مهمة صغيرة وابدأ.";
    if (actions) {
      actions.innerHTML = `<button class="primary-button" type="button" data-page="tasks">أضف مهمة ←</button>`;
      actions.querySelector("[data-page]").onclick = () => showPage("tasks");
    }
  }

  const board = document.getElementById("todayBoard");
  if (!board) return;
  const today = todayISO();
  const due = data.tasks.filter((t) => !t.completed && t.dueDate === today);
  const leftover = data.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today);
  const favs = data.snippets.filter((s) => s.favorite).slice(0, 4);
  board.innerHTML = `
    <article class="today-card">
      <h3>مستحق اليوم ولم يُكمل</h3>
      ${due.length || leftover.length ? [...due.map((t) => rowTask(t, "اليوم")), ...leftover.map((t) => rowTask(t, "متأخر"))].join("") : "<p class='page-description'>لا يوجد ضغط لهذا اليوم. أحسنت.</p>"}
    </article>
    <article class="today-card">
      <h3>أكواد مثبتة</h3>
      ${favs.length ? favs.map((s) => `<div class="today-item"><span>${esc(s.title)}</span><button data-copy-home="${s.id}">نسخ</button></div>`).join("") : "<p class='page-description'>ثبّت قصاصة مهمة لتظهر هنا.</p>"}
      <p class="shortcut-hint">بحث شامل: / &nbsp;&nbsp; أوامر سريعة: Ctrl + K</p>
    </article>`;
  board.querySelectorAll("[data-done]").forEach((b) => {
    b.onclick = () => {
      const t = data.tasks.find((x) => x.id === b.dataset.done);
      if (!t) return;
      t.completed = true;
      saveData();
      renderHome();
      renderTasks();
    };
  });
  board.querySelectorAll("[data-focus-task]").forEach((b) => {
    b.onclick = () => startFocusOn(b.dataset.focusTask);
  });
  board.querySelectorAll("[data-copy-home]").forEach((b) => {
    b.onclick = async () => {
      const s = data.snippets.find((x) => x.id === b.dataset.copyHome);
      if (!s) return;
      try { await navigator.clipboard.writeText(s.code); toast("تم نسخ الكود"); }
      catch { toast("تعذر النسخ", true); }
    };
  });
}

function rowTask(t, badge) {
  return `<div class="today-item"><span><strong>${esc(t.title)}</strong> · ${badge}</span><span class="chip-row"><button data-done="${t.id}">تم</button><button data-focus-task="${t.id}">تركيز</button></span></div>`;
}

function updateDate() {
  const now = new Date();
  const d = document.getElementById("currentDay");
  const n = document.getElementById("currentDate");
  if (d) d.textContent = now.toLocaleDateString("ar", { weekday: "long" });
  if (n) n.textContent = now.toLocaleDateString("ar", { day: "numeric", month: "short" });
}

function setupTheme() {
  const apply = (theme) => {
    const dark = theme === "dark";
    document.body.classList.toggle("dark", dark);
    const a = document.getElementById("themeButton");
    const b = document.getElementById("mobileThemeButton");
    if (a) a.innerHTML = dark ? "<span>☾</span> الوضع الفاتح" : "<span>☼</span> الوضع الداكن";
    if (b) b.textContent = dark ? "☾" : "☼";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c1a18" : "#0f766e");
  };
  const toggle = () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    apply(next);
  };
  document.getElementById("themeButton")?.addEventListener("click", toggle);
  document.getElementById("mobileThemeButton")?.addEventListener("click", toggle);
  apply(localStorage.getItem(THEME_KEY) || "light");
}

function openMenu() {
  document.getElementById("sidebar")?.classList.add("mobile-open");
  const overlay = document.getElementById("menuOverlay");
  overlay?.classList.add("active");
  if (overlay) overlay.hidden = false;
  document.body.classList.add("menu-open");
  document.getElementById("menuButton")?.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  document.getElementById("sidebar")?.classList.remove("mobile-open");
  const overlay = document.getElementById("menuOverlay");
  overlay?.classList.remove("active");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("menu-open");
  document.getElementById("menuButton")?.setAttribute("aria-expanded", "false");
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => { if (button.dataset.page) showPage(button.dataset.page); });
  });
  const sidebar = document.getElementById("sidebar");
  document.getElementById("menuButton")?.addEventListener("click", () => {
    sidebar?.classList.contains("mobile-open") ? closeMenu() : openMenu();
  });
  document.getElementById("closeMenuButton")?.addEventListener("click", closeMenu);
  document.getElementById("menuOverlay")?.addEventListener("click", closeMenu);
  document.getElementById("searchButton")?.addEventListener("click", () => openPalette("search"));
  document.getElementById("commandButton")?.addEventListener("click", () => openPalette("command"));
  sidebar?.addEventListener("click", (e) => { if (e.target.closest("[data-page]")) closeMenu(); });
  document.addEventListener("keydown", onKeys);
  window.addEventListener("hashchange", () => {
    const name = location.hash.replace("#", "");
    if (PAGES.includes(name)) showPage(name);
  });
  window.addEventListener("online", () => showBanner("أنت متصل. بياناتك ما تزال محفوظة على هذا الجهاز."));
  window.addEventListener("offline", () => showBanner("تعمل دون إنترنت. كل الميزات المحلية متاحة."));
}

function onKeys(e) {
  const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
  if (e.key === "Escape") {
    closeModal();
    closeMenu();
    closePalette();
    if (document.body.classList.contains("zen-mode")) setZen(false);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openPalette("command");
    return;
  }
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); openPalette("search"); }
  if (e.key.toLowerCase() === "n") { showPage("tasks"); addTask(); }
  if (e.key.toLowerCase() === "s") { showPage("snippets"); addSnippet(); }
  if (e.key.toLowerCase() === "f") showPage("focus");
  if (e.key.toLowerCase() === "t") showPage("templates");
}

function showBanner(text, actionLabel, action) {
  const el = document.getElementById("statusBanner");
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `<span>${esc(text)}</span><span class="chip-row">${actionLabel ? `<button id="bannerAction">${esc(actionLabel)}</button>` : ""}<button id="bannerClose">إخفاء</button></span>`;
  el.querySelector("#bannerClose").onclick = () => { el.hidden = true; };
  if (actionLabel) el.querySelector("#bannerAction").onclick = () => { el.hidden = true; action?.(); };
}

function addExtraMenu() {
  const bottom = document.querySelector(".sidebar-bottom");
  if (!bottom || document.getElementById("extraMenu")) return;
  const box = document.createElement("div");
  box.id = "extraMenu";
  box.className = "extra-menu";
  box.innerHTML = `<div class="menu-title">مساحة العمل</div>
    <button class="menu-button" data-page="editor"><span class="menu-icon">▤</span><span><strong>استوديو الملفات</strong><small>استورد، عاين، عدّل، حمّل ZIP</small></span></button>
    <button class="menu-button" data-page="projects"><span class="menu-icon">▦</span><span><strong>المشاريع</strong><small>المهام والكود والملاحظات</small></span></button>
    <button class="menu-button" data-page="focus"><span class="menu-icon">◷</span><span><strong>مؤقت التركيز</strong><small>اختصار F</small></span></button>
    <button class="menu-button" data-page="templates"><span class="menu-icon">▤</span><span><strong>القوالب الجاهزة</strong><small>اختصار T</small></span></button>
    <button class="menu-button" data-page="achievements"><span class="menu-icon">★</span><span><strong>سجل الإنجاز</strong><small>تابع تقدمك</small></span></button>
    <button class="menu-button" data-page="extra-tools"><span class="menu-icon">⌘</span><span><strong>أدوات إضافية</strong><small>حاسبات سريعة</small></span></button>
    <button class="menu-button" data-page="convert"><span class="menu-icon">{→}</span><span><strong>تحويل اللغات</strong><small>Python وJavaScript</small></span></button>
    <button class="menu-button" data-page="guide"><span class="menu-icon">?</span><span><strong>دليل الموقع</strong><small>كيف تستخدم مُعين</small></span></button>
    <div class="menu-title">البيانات</div>
    <button class="menu-button" id="exportButton"><span class="menu-icon">↓</span><span><strong>تصدير نسخة احتياطية</strong><small>ملف JSON</small></span></button>
    <button class="menu-button" id="importButton"><span class="menu-icon">↑</span><span><strong>استيراد ودمج</strong><small>بدون حذف إجباري</small></span></button>
    <div class="menu-title">الإعدادات</div>
    <button class="menu-button" data-page="settings"><span class="menu-icon">⚙</span><span><strong>الإعدادات</strong><small>المظهر والاختصارات</small></span></button>
    <button class="menu-button" id="aboutButton"><span class="menu-icon">i</span><span><strong>عن مُعين</strong><small>الإصدار 1.7</small></span></button>`;
  bottom.insertBefore(box, bottom.querySelector("#themeButton"));
  const file = document.createElement("input");
  file.type = "file";
  file.id = "backupFile";
  file.accept = "application/json";
  file.hidden = true;
  bottom.appendChild(file);
  box.querySelectorAll("[data-page]").forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));
  box.querySelector("#aboutButton").onclick = () => toast("مُعين v1.7: مساحة المبرمج العربي لإنجاز العمل وحفظ الكود");
  box.querySelector("#exportButton").onclick = exportBackup;
  box.querySelector("#importButton").onclick = () => file.click();
  file.onchange = importBackup;
}

function paletteItems(mode, q) {
  const query = q.trim().toLowerCase();
  const commands = [
    { type: "أمر", title: "مهمة جديدة", run: () => { showPage("tasks"); addTask(); } },
    { type: "أمر", title: "قصاصة جديدة", run: () => { showPage("snippets"); addSnippet(); } },
    { type: "أمر", title: "ملاحظة جديدة", run: () => { showPage("notes"); addNote(); } },
    { type: "أمر", title: "مؤقت التركيز", run: () => showPage("focus") },
    { type: "أمر", title: "القوالب", run: () => showPage("templates") },
    { type: "أمر", title: "المشاريع", run: () => showPage("projects") },
    { type: "أمر", title: "استوديو الملفات", run: () => showPage("editor") },
    { type: "أمر", title: "تصدير نسخة", run: exportBackup },
    { type: "أمر", title: "تحويل لغة الكود", run: () => showPage("convert") },
  ];
  const items = [
    ...commands,
    ...data.tasks.map((t) => ({ type: "مهمة", title: t.title, run: () => showPage("tasks") })),
    ...data.snippets.map((s) => ({ type: "كود", title: s.title, run: () => showPage("snippets") })),
    ...data.notes.map((n) => ({ type: "ملاحظة", title: n.title, run: () => showPage("notes") })),
    ...data.projects.map((p) => ({ type: "مشروع", title: p.name, run: () => showPage("projects") }))
  ];
  return items.filter((x) => !query || `${x.type} ${x.title}`.toLowerCase().includes(query)).slice(0, 20);
}

function openPalette() {
  const host = document.getElementById("commandPalette");
  if (!host) return;
  host.hidden = false;
  const items = paletteItems("all", "");
  paletteIndex = 0;
  host.innerHTML = `<div class="command-box"><input id="paletteInput" placeholder="ابحث في المهام والكود والملاحظات أو اكتب أمرًا..."><div class="command-results" id="paletteResults"></div></div>`;
  const input = host.querySelector("#paletteInput");
  const render = () => {
    const list = paletteItems("all", input.value);
    paletteIndex = Math.max(0, Math.min(paletteIndex, list.length - 1));
    host.querySelector("#paletteResults").innerHTML = list.map((x, i) => `<button class="command-item ${i === paletteIndex ? "active" : ""}" data-i="${i}"><strong>${esc(x.title)}</strong><small>${esc(x.type)}</small></button>`).join("") || `<p class="page-description" style="padding:16px">لا توجد نتائج</p>`;
    host._list = list;
    host.querySelectorAll(".command-item").forEach((b) => {
      b.onclick = () => { list[Number(b.dataset.i)]?.run(); closePalette(); };
    });
  };
  render();
  input.focus();
  input.oninput = render;
  input.onkeydown = (e) => {
    const list = host._list || [];
    if (e.key === "ArrowDown") { e.preventDefault(); paletteIndex += 1; render(); }
    if (e.key === "ArrowUp") { e.preventDefault(); paletteIndex -= 1; render(); }
    if (e.key === "Enter") { e.preventDefault(); list[paletteIndex]?.run(); closePalette(); }
  };
  host.onclick = (e) => { if (e.target === host) closePalette(); };
}

function closePalette() {
  const host = document.getElementById("commandPalette");
  if (host) { host.hidden = true; host.innerHTML = ""; }
}

function addTask(existing = null) {
  const t = existing || {};
  modal(existing ? "تعديل المهمة" : "مهمة جديدة",
    `<form><label>العنوان<input name="title" required maxlength="120" value="${esc(t.title || "")}" placeholder="مثال: مراجعة الواجهة"></label><label>المشروع<select name="project">${projectOptions(t.project)}</select></label><label>الأولوية<select name="priority"><option value="low" ${t.priority === "low" ? "selected" : ""}>منخفضة</option><option value="medium" ${!t.priority || t.priority === "medium" ? "selected" : ""}>متوسطة</option><option value="high" ${t.priority === "high" ? "selected" : ""}>عالية</option></select></label><label>الموعد<input name="dueDate" type="date" value="${esc(t.dueDate || "")}"></label><div class="mueen-form-actions"><button class="primary-button">حفظ</button></div></form>`,
    (f) => {
      const title = String(f.get("title") || "").trim();
      if (!title) return toast("اكتب عنوان المهمة", true);
      const values = { title, project: f.get("project") || "", priority: f.get("priority"), dueDate: f.get("dueDate") || "", updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, values);
      else data.tasks.unshift({ id: uid(), ...values, completed: false, createdAt: new Date().toISOString() });
      saveData(); renderTasks(); renderHome(); closeModal(); toast("تم حفظ المهمة");
    });
}

function renderTasks() {
  const list = document.getElementById("tasksList");
  if (!list) return;
  const today = todayISO();
  const items = data.tasks.filter((t) => {
    if (taskFilter === "open") return !t.completed;
    if (taskFilter === "done") return t.completed;
    if (taskFilter === "today") return !t.completed && t.dueDate === today;
    return true;
  });
  if (!items.length) {
    list.className = "empty-state";
    list.innerHTML = `<div class="empty-icon">✓</div><h2>لا توجد مهام هنا</h2><p>أضف مهمة وابدأ الإنجاز.</p><button class="primary-button" id="emptyAddTask">إضافة مهمة</button>`;
    document.getElementById("emptyAddTask").onclick = () => addTask();
    return;
  }
  list.className = "mueen-list";
  list.innerHTML = items.map((t) => {
    const meta = `${t.project ? `مشروع: ${esc(projectName(t.project))}` : ""}${t.dueDate ? ` · الموعد: ${dateText(t.dueDate)}` : ` · ${dateText(t.createdAt)}`}`;
    return `<article class="mueen-item ${t.completed ? "is-done" : ""}"><button class="check-button" data-check="${t.id}">${t.completed ? "✓" : ""}</button><div class="item-main"><h3>${esc(t.title)}</h3><p>${meta}</p></div><span class="priority ${t.priority || "medium"}">${t.priority === "high" ? "عالية" : t.priority === "low" ? "منخفضة" : "متوسطة"}</span><div class="item-actions"><button data-focus-task="${t.id}">تركيز</button><button data-edit="${t.id}">تعديل</button><button data-delete="${t.id}">حذف</button></div></article>`;
  }).join("");
  list.querySelectorAll("[data-check]").forEach((b) => b.onclick = () => {
    const t = data.tasks.find((x) => x.id === b.dataset.check); if (!t) return;
    t.completed = !t.completed; saveData(); renderTasks(); renderHome();
  });
  list.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => addTask(data.tasks.find((x) => x.id === b.dataset.edit)));
  list.querySelectorAll("[data-focus-task]").forEach((b) => b.onclick = () => startFocusOn(b.dataset.focusTask));
  list.querySelectorAll("[data-delete]").forEach((b) => b.onclick = () => {
    if (confirm("حذف المهمة؟")) { data.tasks = data.tasks.filter((x) => x.id !== b.dataset.delete); saveData(); renderTasks(); renderHome(); toast("تم حذف المهمة"); }
  });
}

function addSnippet(existing = null, preset = {}) {
  const s = existing || preset || {};
  const options = SNIPPET_LANGS.map((l) => `<option ${s.language === l ? "selected" : ""}>${l}</option>`).join("");
  modal(existing ? "تعديل القصاصة" : "قصاصة كود جديدة",
    `<form><label>الاسم<input name="title" required value="${esc(s.title || "")}" placeholder="اسم القصاصة"></label><label>اللغة<select name="language">${options}</select></label><label>المشروع<select name="project">${projectOptions(s.project)}</select></label><label>الوسوم<input name="tags" value="${esc(s.tags || "")}" placeholder="api, css"></label><label>الكود<textarea name="code" required rows="9" dir="ltr">${esc(s.code || "")}</textarea></label><div class="mueen-form-actions"><button class="primary-button">حفظ</button></div></form>`,
    (f) => {
      const title = String(f.get("title") || "").trim();
      const code = String(f.get("code") || "");
      if (!title || !code.trim()) return toast("اكتب اسم القصاصة والكود", true);
      const v = { title, language: f.get("language"), project: f.get("project") || "", tags: f.get("tags") || "", code, updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, v);
      else data.snippets.unshift({ id: uid(), favorite: false, ...v, createdAt: new Date().toISOString() });
      saveData(); renderSnippets(document.querySelector("#snippetsPage .search-box input")?.value || ""); renderHome(); closeModal(); toast("تم حفظ القصاصة");
    });
}

function highlightCode(code) {
  return esc(code);
}

function renderSnippetFilters() {
  const bar = document.getElementById("snippetFilters");
  if (!bar) return;
  const langs = ["all", "favorite", ...new Set(data.snippets.map((s) => s.language).filter(Boolean))];
  bar.innerHTML = langs.map((l) => `<button class="filter-button ${snippetFilter === l ? "active" : ""}" data-sfilter="${l}">${l === "all" ? "الكل" : l === "favorite" ? "المفضلة" : esc(l)}</button>`).join("");
  bar.querySelectorAll("[data-sfilter]").forEach((b) => b.onclick = () => { snippetFilter = b.dataset.sfilter; renderSnippets(document.querySelector("#snippetsPage .search-box input")?.value || ""); });
}

function renderSnippets(q = "") {
  const list = document.getElementById("snippetsList");
  if (!list) return;
  renderSnippetFilters();
  const s = data.snippets.filter((x) => {
    const text = `${x.title} ${x.language} ${x.tags} ${x.code} ${projectName(x.project)}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (snippetFilter === "favorite") return !!x.favorite;
    if (snippetFilter !== "all") return x.language === snippetFilter;
    return true;
  });
  if (!s.length) {
    list.className = "empty-state";
    list.innerHTML = `<div class="empty-icon code-empty">{ }</div><h2>${q ? "لا توجد نتائج" : "مكتبتك فارغة"}</h2><p>احفظ أول قصاصة كود.</p><button class="primary-button" id="emptyAddSnippet">حفظ قصاصة</button>`;
    document.getElementById("emptyAddSnippet").onclick = () => addSnippet();
    return;
  }
  list.className = "mueen-list";
  list.innerHTML = s.map((x) => `<article class="mueen-item snippet-item"><div class="item-main"><div class="item-title-row"><h3>${esc(x.title)}</h3><span class="language-badge">${esc(x.language)}</span></div><p>${x.favorite ? "★ مثبت · " : ""}${esc(x.tags || "دون وسوم")}${x.project ? ` · ${esc(projectName(x.project))}` : ""}</p><pre dir="ltr">${highlightCode(x.code)}</pre></div><div class="item-actions"><button data-copy="${x.id}">نسخ</button><button data-convert="${x.id}">تحويل لغة</button><button data-fav="${x.id}" class="${x.favorite ? "fav-on" : ""}">${x.favorite ? "★ مثبت" : "☆ تثبيت"}</button><button data-dup="${x.id}">تكرار</button><button data-edit-snippet="${x.id}">تعديل</button><button data-delete-snippet="${x.id}">حذف</button></div></article>`).join("");
  list.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(data.snippets.find((x) => x.id === b.dataset.copy).code); toast("تم نسخ الكود"); }
    catch { toast("تعذر النسخ", true); }
  });
  list.querySelectorAll("[data-convert]").forEach((b) => b.onclick = () => {
    const item = data.snippets.find((x) => x.id === b.dataset.convert);
    if (!item) return;
    showPage("convert");
    setTimeout(() => {
      const from = document.getElementById("fromCode");
      const fromLang = document.getElementById("fromLang");
      if (from) from.value = item.code;
      if (fromLang) {
        const lang = item.language === "أخرى" ? "JavaScript" : item.language;
        if ([...fromLang.options].some((o) => o.value === lang)) fromLang.value = lang;
      }
    }, 50);
  });
  list.querySelectorAll("[data-fav]").forEach((b) => b.onclick = () => {
    const item = data.snippets.find((x) => x.id === b.dataset.fav); if (!item) return;
    item.favorite = !item.favorite; saveData(); renderSnippets(q); renderHome();
  });
  list.querySelectorAll("[data-dup]").forEach((b) => b.onclick = () => {
    const item = data.snippets.find((x) => x.id === b.dataset.dup); if (!item) return;
    data.snippets.unshift({ ...item, id: uid(), title: `${item.title} (نسخة)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    saveData(); renderSnippets(q); toast("تم تكرار القصاصة");
  });
  list.querySelectorAll("[data-edit-snippet]").forEach((b) => b.onclick = () => addSnippet(data.snippets.find((x) => x.id === b.dataset.editSnippet)));
  list.querySelectorAll("[data-delete-snippet]").forEach((b) => b.onclick = () => {
    if (confirm("حذف القصاصة؟")) { data.snippets = data.snippets.filter((x) => x.id !== b.dataset.deleteSnippet); saveData(); renderSnippets(q); toast("تم حذف القصاصة"); }
  });
}

async function pasteSnippet() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) return toast("الحافظة فارغة", true);
    addSnippet(null, { title: "من الحافظة", language: "JavaScript", code: text });
  } catch {
    toast("اسمح بالوصول للحافظة أو الصق يدويًا", true);
  }
}

function addNote(existing = null) {
  const n = existing || {};
  modal(existing ? "تعديل الملاحظة" : "ملاحظة جديدة",
    `<form><label>العنوان<input name="title" required value="${esc(n.title || "")}"></label><label>المشروع<select name="project">${projectOptions(n.project)}</select></label><label>الوسوم<input name="tags" value="${esc(n.tags || "")}"></label><label>المحتوى<textarea name="content" required rows="10">${esc(n.content || "")}</textarea></label><div class="mueen-form-actions"><button class="primary-button">حفظ</button></div></form>`,
    (f) => {
      const title = String(f.get("title") || "").trim();
      const content = String(f.get("content") || "").trim();
      if (!title || !content) return toast("اكتب العنوان والمحتوى", true);
      const v = { title, project: f.get("project") || "", tags: f.get("tags") || "", content, updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, v);
      else data.notes.unshift({ id: uid(), ...v, createdAt: new Date().toISOString() });
      saveData(); renderNotes(document.querySelector("#notesPage .search-box input")?.value || ""); closeModal(); toast("تم حفظ الملاحظة");
    });
}

function renderNotes(q = "") {
  const list = document.getElementById("notesList");
  if (!list) return;
  const notes = data.notes.filter((x) => `${x.title} ${x.tags} ${x.content} ${projectName(x.project)}`.toLowerCase().includes(q.toLowerCase()));
  if (!notes.length) {
    list.className = "empty-state";
    list.innerHTML = `<div class="empty-icon note-empty">▤</div><h2>${q ? "لا توجد نتائج" : "لا توجد ملاحظات"}</h2><p>اكتب فكرة مشروعك القادمة.</p><button class="primary-button" id="emptyAddNote">إضافة ملاحظة</button>`;
    document.getElementById("emptyAddNote").onclick = () => addNote();
    return;
  }
  list.className = "mueen-list";
  list.innerHTML = notes.map((x) => `<article class="mueen-item note-item"><div class="item-main"><h3>${esc(x.title)}</h3><p>${esc(x.tags || "دون وسوم")}${x.project ? ` · ${esc(projectName(x.project))}` : ""} · ${dateText(x.updatedAt || x.createdAt)}</p><div class="note-preview">${esc(x.content)}</div></div><div class="item-actions"><button data-edit-note="${x.id}">تعديل</button><button data-delete-note="${x.id}">حذف</button></div></article>`).join("");
  list.querySelectorAll("[data-edit-note]").forEach((b) => b.onclick = () => addNote(data.notes.find((x) => x.id === b.dataset.editNote)));
  list.querySelectorAll("[data-delete-note]").forEach((b) => b.onclick = () => {
    if (confirm("حذف الملاحظة؟")) { data.notes = data.notes.filter((x) => x.id !== b.dataset.deleteNote); saveData(); renderNotes(q); toast("تم حذف الملاحظة"); }
  });
}

function createExtraPages() {
  page("projects", "المشاريع", "مساحة العمل", "اجمع المهام والقصاصات والملاحظات في مشروع واحد");
  page("focus", "مؤقت التركيز", "الإنتاجية", "اربط الجلسة بمهمة، ثم سجّل ما أنجزته");
  page("templates", "القوالب الجاهزة", "بداية سريعة", "قوالب عملية يمكنك تخصيصها وحفظها");
  page("achievements", "سجل الإنجاز", "التقدم", "شاهد نشاطك الأسبوعي وتتابع أيامك");
  page("extra-tools", "أدوات إضافية", "صندوق الأدوات", "تحويلات سريعة للمصممين والمبرمجين");
  page("settings", "الإعدادات", "التخصيص", "المظهر، الاختصارات، والنسخ الاحتياطي");
  page("convert", "تحويل اللغات", "الأدوات", "حوّل كودًا من لغة إلى أخرى ثم احفظه كقصاصة");
  page("guide", "دليل مُعين", "ابدأ من هنا", "شرح سريع لكل صفحة وميزة في الموقع");
  // ✅ إصلاح 2: أنشئ صفحة editor
  page("editor", "استوديو الملفات", "أدوات", "استورد مجلدًا أو ZIP مع الصور، عاين، عدّل، وحمّل");
}

function addProject(existing = null) {
  const p = existing || {};
  modal(existing ? "تعديل المشروع" : "مشروع جديد",
    `<form><label>اسم المشروع<input name="name" required value="${esc(p.name || "")}" placeholder="مثال: متجر إلكتروني"></label><label>الوصف<textarea name="description" rows="4">${esc(p.description || "")}</textarea></label><div class="mueen-form-actions"><button class="primary-button">حفظ المشروع</button></div></form>`,
    (f) => {
      const name = String(f.get("name") || "").trim();
      if (!name) return toast("اكتب اسم المشروع", true);
      const v = { name, description: f.get("description") || "", updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, v);
      else data.projects.unshift({ id: uid(), ...v, createdAt: new Date().toISOString() });
      saveData(); renderProjects(); closeModal(); toast("تم حفظ المشروع");
    });
}

function renderProjects() {
  const el = document.getElementById("projectsPage");
  if (!el) return;
  el.querySelector(".extra-page-actions").innerHTML = `<button class="primary-button" id="addProject">+ مشروع جديد</button>`;
  el.querySelector("#addProject").onclick = () => addProject();
  const content = el.querySelector(".extra-page-content");
  if (!data.projects.length) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">▦</div><h2>لا توجد مشاريع</h2><p>أنشئ مشروعًا لربط مهامك وكودك به.</p></div>`;
    return;
  }
  content.innerHTML = `<div class="project-grid">${data.projects.map((p) => {
    const tasks = data.tasks.filter((t) => t.project === p.id);
    const done = tasks.filter((t) => t.completed).length;
    const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const codes = data.snippets.filter((s) => s.project === p.id).length;
    const notes = data.notes.filter((n) => n.project === p.id).length;
    return `<article class="project-card"><h3>${esc(p.name)}</h3><p>${esc(p.description || "دون وصف")}</p><p>${done} من ${tasks.length} مهام · ${codes} كود · ${notes} ملاحظة</p><div class="progress-track"><div class="progress-value" style="width:${percent}%"></div></div><div class="item-actions" style="margin-top:12px"><button data-open-project="${p.id}">فتح</button><button data-focus-project="${p.id}">جلسة عمل</button><button data-edit-project="${p.id}">تعديل</button><button data-delete-project="${p.id}">حذف</button></div></article>`;
  }).join("")}</div><div id="projectDetail"></div>`;
  content.querySelectorAll("[data-edit-project]").forEach((b) => b.onclick = () => addProject(data.projects.find((p) => p.id === b.dataset.editProject)));
  content.querySelectorAll("[data-open-project]").forEach((b) => b.onclick = () => renderProjectDetail(b.dataset.openProject));
  content.querySelectorAll("[data-focus-project]").forEach((b) => b.onclick = () => startFocusOn("", b.dataset.focusProject));
  content.querySelectorAll("[data-delete-project]").forEach((b) => b.onclick = () => {
    if (confirm("حذف المشروع؟ لن تُحذف العناصر المرتبطة به.")) {
      data.projects = data.projects.filter((p) => p.id !== b.dataset.deleteProject);
      saveData(); renderProjects(); toast("تم حذف المشروع");
    }
  });
}

function renderProjectDetail(id) {
  const p = data.projects.find((x) => x.id === id);
  const box = document.getElementById("projectDetail");
  if (!p || !box) return;
  const tasks = data.tasks.filter((t) => t.project === id);
  const codes = data.snippets.filter((s) => s.project === id);
  const notes = data.notes.filter((n) => n.project === id);
  box.innerHTML = `<div class="today-card project-detail" style="margin-top:16px"><h3>مشروع: ${esc(p.name)}</h3>
    <p>${tasks.filter((t) => !t.completed).map((t) => `☐ ${esc(t.title)}`).join("<br>") || "لا مهام مفتوحة"}</p>
    <p>أكواد: ${codes.map((s) => esc(s.title)).join(" · ") || "لا قصاصات بعد"}</p>
    <p>ملاحظات: ${notes.map((n) => esc(n.title)).join(" · ") || "لا ملاحظات بعد"}</p></div>`;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

function startFocusOn(taskId = "", projectId = "") {
  const task = data.tasks.find((t) => t.id === taskId);
  timer.taskId = taskId;
  timer.projectId = projectId || task?.project || "";
  timer.mode = "تركيز";
  timer.seconds = timer.duration;
  showPage("focus");
  toast(task ? `جلسة على: ${task.title}` : "جلسة تركيز جاهزة");
}

function renderFocus() {
  const el = document.getElementById("focusPage");
  if (!el) return;
  const task = data.tasks.find((t) => t.id === timer.taskId);
  el.querySelector(".extra-page-actions").innerHTML = `<button class="small-action" id="zenToggle">${document.body.classList.contains("zen-mode") ? "إلغاء وضع التركيز" : "وضع بلا تشتيت"}</button>`;
  el.querySelector("#zenToggle").onclick = () => setZen(!document.body.classList.contains("zen-mode"));
  el.querySelector(".extra-page-content").innerHTML = `<div class="timer-card">
    <div class="timer-mode" id="timerMode">${timer.mode}${task ? ` · ${esc(task.title)}` : ""}</div>
    <div class="timer-display" id="timerDisplay">${timeText(timer.seconds)}</div>
    <div class="timer-actions">
      <button class="primary-button" id="timerStart">بدء</button>
      <button class="small-action" id="timerReset">إعادة ضبط</button>
    </div>
    <div class="timer-settings">
      <button data-mode="25-5">25 / 5</button>
      <button data-mode="50-10">50 / 10</button>
      <button data-mode="15-5">15 / 5</button>
    </div>
    <form id="focusLink" style="display:grid;gap:8px;margin-top:18px;text-align:right">
      <label>ربط بمهمة<select id="focusTask">${`<option value="">بدون مهمة</option>`}${data.tasks.filter((t) => !t.completed).map((t) => `<option value="${t.id}" ${t.id === timer.taskId ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select></label>
      <label>ربط بمشروع<select id="focusProject">${projectOptions(timer.projectId)}</select></label>
    </form>
    <p style="margin-top:20px;color:var(--muted)">جلسات هذا الأسبوع: <strong>${weekFocusMinutes()}</strong> دقيقة · المكتمل كله: <strong id="sessionCount">${data.focusSessions.length}</strong></p>
  </div>`;
  el.querySelector("#timerStart").onclick = toggleTimer;
  el.querySelector("#timerReset").onclick = resetTimer;
  el.querySelector("#focusTask").onchange = (e) => { timer.taskId = e.target.value; renderFocus(); };
  el.querySelector("#focusProject").onchange = (e) => { timer.projectId = e.target.value; };
  el.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => {
    const [w, br] = b.dataset.mode.split("-").map(Number);
    stopTimer();
    timer.duration = w * 60;
    timer.breakSeconds = br * 60;
    timer.seconds = timer.duration;
    timer.mode = "تركيز";
    updateTimerUI();
  });
  updateTimerUI();
}

function setZen(on) {
  document.body.classList.toggle("zen-mode", on);
  data.settings.zen = on;
  saveData();
  const btn = document.getElementById("zenToggle");
  if (btn) btn.textContent = on ? "إلغاء وضع التركيز" : "وضع بلا تشتيت";
}

function timeText(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function updateTimerUI() {
  const d = document.getElementById("timerDisplay");
  const s = document.getElementById("timerStart");
  const m = document.getElementById("timerMode");
  const c = document.getElementById("sessionCount");
  const task = data.tasks.find((t) => t.id === timer.taskId);
  if (d) d.textContent = timeText(timer.seconds);
  if (s) s.textContent = timer.running ? "إيقاف مؤقت" : "بدء";
  if (m) m.textContent = `${timer.mode}${task ? ` · ${task.title}` : ""}`;
  if (c) c.textContent = data.focusSessions.length;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.18);
  } catch {}
}

function notifyDone(text) {
  beep();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("مُعين", { body: text });
  }
}

function toggleTimer() {
  if (timer.running) { stopTimer(); return; }
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  timer.running = true;
  updateTimerUI();
  clearInterval(timer.interval);
  timer.interval = setInterval(() => {
    timer.seconds--;
    updateTimerUI();
    if (timer.seconds <= 0) finishSlice();
  }, 1000);
}

function finishSlice() {
  stopTimer();
  if (timer.mode === "تركيز") {
    const minutes = Math.round(timer.duration / 60);
    data.focusSessions.push({
      id: uid(), mode: timer.mode, minutes, taskId: timer.taskId,
      projectId: timer.projectId, createdAt: new Date().toISOString()
    });
    saveData();
    notifyDone("اكتملت جلسة التركيز");
    askSessionNote(minutes);
  } else {
    timer.mode = "تركيز";
    timer.seconds = timer.duration;
    updateTimerUI();
    toast("انتهت الاستراحة. جاهز لجولة جديدة");
  }
}

function askSessionNote(minutes) {
  modal("ماذا أنجزت؟",
    `<form><p>جلسة ${minutes} دقيقة اكتملت. اكتب سطرًا واحدًا ليظهر في سجل الإنجاز.</p><label>الملاحظة<textarea name="note" rows="3" placeholder="مثال: أصلحت خطأ التنسيق"></textarea></label><div class="mueen-form-actions"><button class="primary-button">حفظ</button><button class="small-action" type="button" id="skipNote">تخطي وخذ استراحة</button></div></form>`,
    (f) => {
      const note = String(f.get("note") || "").trim();
      if (note) {
        const last = data.focusSessions[data.focusSessions.length - 1];
        if (last) last.note = note;
        saveData();
      }
      startBreak();
      closeModal();
    });
  document.getElementById("skipNote")?.addEventListener("click", () => { startBreak(); closeModal(); });
}

function startBreak() {
  timer.mode = "استراحة";
  timer.seconds = timer.breakSeconds;
  updateTimerUI();
  toast(`استراحة ${Math.round(timer.breakSeconds / 60)} دقائق`);
}

function stopTimer() {
  clearInterval(timer.interval);
  timer.running = false;
  updateTimerUI();
}

function resetTimer() {
  stopTimer();
  timer.mode = "تركيز";
  timer.seconds = timer.duration;
  updateTimerUI();
}

const templates = [
  ["HTML أساسي", "صفحة HTML عربية متجاوبة", "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>مشروعي</title>\n</head>\n<body>\n  <h1>مرحبًا</h1>\n</body>\n</html>"],
  ["صفحة 404", "صفحة خطأ بسيطة", "<main style=\"font-family:Cairo,Arial;text-align:center;padding:80px 20px\">\n  <p>404</p>\n  <h1>الصفحة غير موجودة</h1>\n  <a href=\"/\">العودة للرئيسية</a>\n</main>"],
  ["README", "قالب توثيق مشروع", "# اسم المشروع\n\nوصف مختصر.\n\n## التشغيل\nافتح index.html\n"],
  [".gitignore", "ملف تجاهل شائع", "node_modules/\n.env\n.DS_Store\ndist/"]
];

function renderTemplates() {
  const el = document.getElementById("templatesPage");
  if (!el) return;
  el.querySelector(".extra-page-content").innerHTML = `<div class="template-grid">${templates.map((t, i) => `<article class="template-card"><h3>${t[0]}</h3><p>${t[1]}</p><button class="primary-button" data-template="${i}">نسخ القالب</button></article>`).join("")}</div>`;
  el.querySelectorAll("[data-template]").forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(templates[Number(b.dataset.template)][2]); toast("تم نسخ القالب"); }
    catch { toast("تعذر النسخ", true); }
  });
}

function renderAchievements() {
  const el = document.getElementById("achievementsPage");
  if (!el) return;
  const done = data.tasks.filter((x) => x.completed).length;
  const recent = [...data.focusSessions].slice(-5).reverse();
  el.querySelector(".extra-page-content").innerHTML = `<div class="achievement-grid">
    <article class="achievement-card"><div class="stat-large">${done}</div><p>مهمة مكتملة</p></article>
    <article class="achievement-card"><div class="stat-large">${data.snippets.length}</div><p>قصاصة محفوظة</p></article>
    <article class="achievement-card"><div class="stat-large">${data.focusSessions.length}</div><p>جلسة تركيز</p></article>
    <article class="achievement-card"><div class="stat-large">${streakCount()}</div><p>أيام متتالية</p></article>
    <article class="achievement-card"><div class="stat-large">${weekFocusMinutes()}</div><p>دقائق هذا الأسبوع</p></article>
    <article class="achievement-card"><div class="stat-large">${data.usedDays.length}</div><p>يوم استخدام</p></article>
  </div>
  <div class="today-card" style="margin-top:16px"><h3>آخر الجلسات</h3>${recent.length ? recent.map((s) => `<div class="today-item"><span>${dateText(s.createdAt)} · ${s.minutes || 25} د</span><span>${esc(s.note || data.tasks.find((t) => t.id === s.taskId)?.title || "جلسة")}</span></div>`).join("") : "<p class='page-description'>لا جلسات بعد.</p>"}</div>`;
}

function renderSettings() {
  const el = document.getElementById("settingsPage");
  if (!el) return;
  el.querySelector(".extra-page-content").innerHTML = `<div class="feature-card">
    <div class="setting-row"><div><strong>حجم الخط</strong><p>غيّر حجم النص في التطبيق</p></div><select id="fontSetting"><option value="normal">عادي</option><option value="large">كبير</option><option value="xlarge">كبير جدًا</option></select></div>
    <div class="setting-row"><div><strong>البيانات</strong><p>آخر تصدير: ${data.settings.lastExportAt ? dateText(data.settings.lastExportAt) : "لم يتم بعد"}</p></div><button class="primary-button" id="settingsExport">تصدير</button></div>
    <div class="setting-row"><div><strong>حذف البيانات</strong><p>حذف كل شيء من هذا الجهاز فقط</p></div><button class="danger-button" id="deleteAllData">حذف الكل</button></div>
    <div class="setting-row"><div><strong>اختصارات لوحة المفاتيح</strong><p>N مهمة · S كود · F تركيز · T قوالب · / بحث · Ctrl+K أوامر</p></div></div>
    <div class="setting-row"><div><strong>دليل الموقع</strong><p>شرح الصفحات والجولة التعريفية.</p></div><button class="primary-button" id="openGuide">فتح الدليل</button></div>
    <div class="setting-row"><div><strong>عن مُعين</strong><p>مُعين v2.0 — بياناتك المحلية ونسخك الاحتياطية تحت سيطرتك.</p></div></div>
  </div>
  <div id="googleSettingsSlot" style="margin-top:16px"></div>`;
  const select = el.querySelector("#fontSetting");
  select.value = data.settings.fontSize || "normal";
  select.onchange = () => {
    data.settings.fontSize = select.value;
    localStorage.setItem(FONT_KEY, select.value);
    applyFontSize(select.value);
    saveData();
  };
  el.querySelector("#settingsExport").onclick = exportBackup;
  el.querySelector("#openGuide")?.addEventListener("click", () => showPage("guide"));
  el.querySelector("#deleteAllData").onclick = () => {
    if (confirm("سيتم حذف كل بياناتك من هذا الجهاز. هل أنت متأكد؟")) {
      data = structuredClone(emptyData);
      saveData(); renderAll(); toast("تم حذف البيانات");
    }
  };
}

function applyFontSize(size) {
  document.body.classList.remove("font-large", "font-xlarge");
  if (size === "large") document.body.classList.add("font-large");
  if (size === "xlarge") document.body.classList.add("font-xlarge");
}

function renderExtraTools() {
  const el = document.getElementById("extra-toolsPage");
  if (!el) return;
  el.querySelector(".extra-page-content").innerHTML = `<div class="extra-tools-grid">
    <article class="extra-tool-card" data-extra="rem"><h3>PX إلى REM</h3><p>تحويل قيمة CSS بسرعة.</p></article>
    <article class="extra-tool-card" data-extra="radius"><h3>مولد Border Radius</h3><p>إنشاء كود الحواف المستديرة.</p></article>
    <article class="extra-tool-card" data-extra="shadow"><h3>مولد Box Shadow</h3><p>إنشاء ظل CSS جاهز.</p></article>
    <article class="extra-tool-card" data-extra="percent"><h3>حاسبة النسبة</h3><p>احسب نسبة من رقم.</p></article>
    <article class="extra-tool-card" data-extra="gradient"><h3>مولد Gradient</h3><p>أنشئ تدرجًا لونيًا.</p></article>
  </div>`;
  el.querySelectorAll("[data-extra]").forEach((b) => { b.onclick = () => openExtraTool(b.dataset.extra); });
}

function openExtraTool(type) {
  const bodies = {
    rem: `<form><label>PX<input name="px" type="number" value="16"></label><label>حجم الخط الأساسي<input name="base" type="number" value="16"></label><p id="toolResult"></p><button class="primary-button">تحويل</button></form>`,
    radius: `<form><label>القيمة<input name="value" type="number" value="16"></label><p id="toolResult" dir="ltr"></p><button class="primary-button">إنشاء</button></form>`,
    shadow: `<form><label>الإزاحة الأفقية<input name="x" type="number" value="0"></label><label>الإزاحة الرأسية<input name="y" type="number" value="8"></label><label>الضبابية<input name="blur" type="number" value="24"></label><p id="toolResult" dir="ltr"></p><button class="primary-button">إنشاء</button></form>`,
    percent: `<form><label>النسبة %<input name="percent" type="number" value="20"></label><label>الرقم<input name="number" type="number" value="100"></label><p id="toolResult"></p><button class="primary-button">حساب</button></form>`,
    gradient: `<form><label>اللون الأول<input name="a" type="color" value="#0f766e"></label><label>اللون الثاني<input name="b" type="color" value="#155e75"></label><p id="toolResult" dir="ltr"></p><button class="primary-button">إنشاء</button></form>`
  };
  modal("الأداة", bodies[type], (f, box) => {
    let r = "";
    if (type === "rem") r = `${Number(f.get("px")) / (Number(f.get("base")) || 16)}rem`;
    if (type === "radius") r = `border-radius: ${f.get("value")}px;`;
    if (type === "shadow") r = `box-shadow: ${f.get("x")}px ${f.get("y")}px ${f.get("blur")}px rgba(0,0,0,.15);`;
    if (type === "percent") r = `${(Number(f.get("number")) * Number(f.get("percent"))) / 100}`;
    if (type === "gradient") r = `background: linear-gradient(135deg, ${f.get("a")}, ${f.get("b")});`;
    box.querySelector("#toolResult").textContent = r;
  });
}

function exportBackup() {
  data.settings.lastExportAt = new Date().toISOString();
  saveData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mueen-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("تم تصدير النسخة الاحتياطية");
}

function mergeById(current, incoming) {
  const map = new Map(current.map((x) => [x.id, x]));
  incoming.forEach((item) => {
    if (!item || !item.id) { map.set(uid(), { ...item, id: uid() }); return; }
    const old = map.get(item.id);
    if (!old) map.set(item.id, item);
    else if (String(item.updatedAt || item.createdAt || "") >= String(old.updatedAt || old.createdAt || "")) map.set(item.id, { ...old, ...item });
  });
  return [...map.values()];
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const x = JSON.parse(reader.result);
      if (!Array.isArray(x.tasks) || !Array.isArray(x.snippets) || !Array.isArray(x.notes)) throw new Error();
      modal("استيراد النسخة", `<form><p>كيف تريد تطبيق الملف؟</p><label><input type="radio" name="mode" value="merge" checked> دمج مع البيانات الحالية</label><label><input type="radio" name="mode" value="replace"> استبدال كل شيء</label><div class="mueen-form-actions"><button class="primary-button">متابعة</button></div></form>`, (f) => {
        if (f.get("mode") === "replace") {
          data = {
            ...emptyData, ...x,
            tasks: x.tasks, snippets: x.snippets, notes: x.notes,
            projects: Array.isArray(x.projects) ? x.projects : [],
            focusSessions: Array.isArray(x.focusSessions) ? x.focusSessions : [],
            usedDays: Array.isArray(x.usedDays) ? x.usedDays : [],
            settings: { ...emptyData.settings, ...(x.settings || {}) }
          };
        } else {
          data.tasks = mergeById(data.tasks, x.tasks);
          data.snippets = mergeById(data.snippets, x.snippets);
          data.notes = mergeById(data.notes, x.notes);
          data.projects = mergeById(data.projects, x.projects || []);
          data.focusSessions = mergeById(data.focusSessions, x.focusSessions || []);
          data.usedDays = [...new Set([...(data.usedDays || []), ...(x.usedDays || [])])];
        }
        saveData(); applyFontSize(data.settings.fontSize || "normal"); renderAll(); closeModal(); toast("تم استيراد البيانات");
      });
    } catch { toast("ملف النسخة غير صالح", true); }
    e.target.value = "";
  };
  reader.readAsText(file);
}

function bindExistingButtons() {
  document.querySelectorAll(".add-button").forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = "1";
    b.onclick = () => {
      const id = b.closest(".page")?.id || "";
      if (id === "tasksPage") addTask();
      else if (id === "snippetsPage") addSnippet();
      else if (id === "notesPage") addNote();
    };
  });
  document.querySelectorAll("#tasksPage .filter-button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll("#tasksPage .filter-button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      taskFilter = b.dataset.filter || "all";
      renderTasks();
    };
  });
  document.querySelectorAll(".search-box input").forEach((input) => {
    input.oninput = () => {
      const id = input.closest(".page")?.id;
      if (id === "snippetsPage") renderSnippets(input.value);
      if (id === "notesPage") renderNotes(input.value);
    };
  });
  document.querySelectorAll(".tool-card").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.page) return showPage(b.dataset.page);
      openTool(b.dataset.tool || "json");
    };
  });
  document.getElementById("pasteSnippetButton")?.addEventListener("click", pasteSnippet);
}

function lineDiff(a, b) {
  const left = String(a).split("\n");
  const right = String(b).split("\n");
  const max = Math.max(left.length, right.length);
  const rows = [];
  for (let i = 0; i < max; i++) {
    const L = left[i], R = right[i];
    if (L === R) rows.push(`<div class="diff-line diff-same">${esc(R ?? "")}</div>`);
    else {
      if (L !== undefined) rows.push(`<div class="diff-line diff-del">- ${esc(L)}</div>`);
      if (R !== undefined) rows.push(`<div class="diff-line diff-add">+ ${esc(R)}</div>`);
    }
  }
  return `<div class="diff-view">${rows.join("")}</div>`;
}

function jsonErrorInfo(err, raw) {
  const m = String(err.message);
  const pos = m.match(/position\s+(\d+)/i);
  if (!pos) return m;
  const index = Number(pos[1]);
  const until = raw.slice(0, index);
  const line = until.split("\n").length;
  const col = until.length - until.lastIndexOf("\n");
  return `${m} — السطر ${line}، العمود ${col}`;
}

function openTool(type) {
  const titles = { json: "منسق JSON", colors: "مولد الألوان", base64: "Base64", compare: "مقارنة النصوص", count: "عداد النص", readme: "مولد README", gitignore: "مولد gitignore", time: "محوّل الوقت" };
  const bodies = {
    json: `<form><label>JSON<textarea name="input" required rows="8" dir="ltr"></textarea></label><label>العملية<select name="mode"><option value="format">تنسيق</option><option value="minify">تصغير</option></select></label><p id="jsonError" style="color:var(--danger)"></p><label>الناتج<textarea name="output" rows="8" readonly dir="ltr"></textarea></label><button class="primary-button">تنفيذ</button></form>`,
    colors: `<form><label>لون HEX<input name="hex" value="#0f766e"></label><div id="colorResult"></div><button class="primary-button">توليد</button></form>`,
    base64: `<form><label>العملية<select name="mode"><option value="encode">ترميز</option><option value="decode">فك الترميز</option></select></label><label>النص<textarea name="input" rows="7"></textarea></label><label>الناتج<textarea name="output" rows="7" readonly></textarea></label><button class="primary-button">تنفيذ</button></form>`,
    compare: `<form><label>النص الأول<textarea name="a" rows="6"></textarea></label><label>النص الثاني<textarea name="b" rows="6"></textarea></label><div id="compareResult"></div><button class="primary-button">مقارنة</button></form>`,
    count: `<form><label>النص<textarea name="input" rows="8"></textarea></label><p id="countResult"></p><button class="primary-button">عدّ</button></form>`,
    readme: `<form><label>اسم المشروع<input name="name" value="مشروعي"></label><label>الوصف<textarea name="desc" rows="3">وصف مختصر للمشروع.</textarea></label><label>الناتج<textarea name="output" rows="8" readonly dir="ltr"></textarea></label><button class="primary-button">إنشاء</button></form>`,
    gitignore: `<form><label>نوع المشروع<select name="kind"><option value="web">موقع HTML/JS</option><option value="node">Node.js</option><option value="python">Python</option></select></label><label>الناتج<textarea name="output" rows="8" readonly dir="ltr"></textarea></label><button class="primary-button">إنشاء</button></form>`,
    time: `<form><label>التاريخ والوقت المحلي<input name="local" type="datetime-local"></label><p id="timeResult"></p><button class="primary-button">تحويل</button></form>`
  };
  activeTool = type;
  const box = modal(titles[type] || "الأداة", bodies[type], (f, dlg) => {
    try {
      if (type === "json") {
        dlg.querySelector("#jsonError").textContent = "";
        const raw = f.get("input");
        try {
          const parsed = JSON.parse(raw);
          dlg.querySelector('[name="output"]').value = f.get("mode") === "minify" ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
        } catch (err) {
          dlg.querySelector("#jsonError").textContent = jsonErrorInfo(err, raw);
          throw err;
        }
      }
      if (type === "base64") {
        dlg.querySelector('[name="output"]').value = f.get("mode") === "encode"
          ? btoa(unescape(encodeURIComponent(f.get("input"))))
          : decodeURIComponent(escape(atob(f.get("input"))));
      }
      if (type === "compare") {
        const a = f.get("a") || "", b = f.get("b") || "";
        dlg.querySelector("#compareResult").innerHTML = a === b ? "<p>النصان متطابقان</p>" : lineDiff(a, b);
      }
      if (type === "colors") {
        let h = String(f.get("hex") || "").trim().replace("#", "");
        if (h.length === 3) h = h.split("").map((c) => c + c).join("");
        if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("bad hex");
        const n = parseInt(h, 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
        dlg.querySelector("#colorResult").innerHTML = `<span style="display:block;height:70px;border-radius:12px;background:#${h}"></span><p>#${h} · rgb(${r}, ${g}, ${bl})</p><p dir="ltr">--primary: #${h};<br>--primary-rgb: ${r}, ${g}, ${bl};</p>`;
      }
      if (type === "count") {
        const t = String(f.get("input") || "");
        const words = t.trim() ? t.trim().split(/\s+/).length : 0;
        dlg.querySelector("#countResult").textContent = `أحرف: ${t.length} · كلمات: ${words} · أسطر: ${t.split(/\n/).length}`;
      }
      if (type === "readme") {
        dlg.querySelector('[name="output"]').value = `# ${f.get("name")}\n\n${f.get("desc")}\n\n## التشغيل\n\nافتح index.html في المتصفح.\n`;
      }
      if (type === "gitignore") {
        const kind = f.get("kind");
        const map = {
          web: ".DS_Store\ndist/\n.env\n",
          node: "node_modules/\n.env\ndist/\ncoverage/\n.DS_Store\n",
          python: "__pycache__/\n.venv/\n.env\n*.pyc\n.DS_Store\n"
        };
        dlg.querySelector('[name="output"]').value = map[kind];
      }
      if (type === "time") {
        const raw = f.get("local");
        const dt = raw ? new Date(raw) : new Date();
        dlg.querySelector("#timeResult").innerHTML = `<p>محلي: ${dt.toLocaleString("ar")}</p><p dir="ltr">UTC: ${dt.toISOString()}</p>`;
      }
    } catch {
      toast("تأكد من صحة البيانات", true);
    }
  });
  if (type === "time") {
    const input = box.querySelector('[name="local"]');
    if (input) {
      const n = new Date();
      const pad = (x) => String(x).padStart(2, "0");
      input.value = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
    }
  }
}

function maybeBackupNudge() {
  const last = data.settings.lastExportAt ? new Date(data.settings.lastExportAt).getTime() : 0;
  const week = 7 * 24 * 60 * 60 * 1000;
  if (data.tasks.length + data.snippets.length + data.notes.length < 3) return;
  if (Date.now() - last < week) return;
  const nudged = data.settings.backupNudgeAt ? new Date(data.settings.backupNudgeAt).getTime() : 0;
  if (Date.now() - nudged < week) return;
  data.settings.backupNudgeAt = new Date().toISOString();
  saveData();
  showBanner("مر أسبوع على بياناتك. صدّر نسخة احتياطية لتبقى في أمان.", "تصدير", exportBackup);
}

function renderAll() {
  updateCounters();
  renderHome();
  renderTasks();
  renderSnippets();
  renderNotes();
  renderProjects();
  renderFocus();
  if (typeof window.renderTemplateStudio !== "function") renderTemplates();
  renderAchievements();
  renderSettings();
  renderExtraTools();
}

window.mueenSaveTemplateProject = function mueenSaveTemplateProject(name, description) {
  data.projects.unshift({ id: uid(), name, description: description || "قالب محفوظ من الاستوديو", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  saveData();
  toast("أُضيف المشروع من القالب");
};

createExtraPages();
setupNavigation();
addExtraMenu();
setupTheme();
applyFontSize(data.settings.fontSize || localStorage.getItem(FONT_KEY) || "normal");
updateDate();
bindExistingButtons();
renderAll();
saveData();
maybeBackupNudge();

const initial = location.hash.replace("#", "");
showPage(PAGES.includes(initial) ? initial : "home");


window.toast = toast;
window.addSnippet = addSnippet;
window.showPage = showPage;
window.Mueen = {
  get data() { return data; },
  mergeIncoming(incoming) {
    data.tasks = mergeById(data.tasks, incoming.tasks || []);
    data.snippets = mergeById(data.snippets, incoming.snippets || []);
    data.notes = mergeById(data.notes, incoming.notes || []);
    data.projects = mergeById(data.projects, incoming.projects || []);
    data.focusSessions = mergeById(data.focusSessions, incoming.focusSessions || []);
    data.usedDays = [...new Set([...(data.usedDays || []), ...(incoming.usedDays || [])])];
    saveData();
    renderAll();
  },
  replaceIncoming(incoming) {
    data = {
      ...emptyData,
      ...incoming,
      tasks: incoming.tasks || [],
      snippets: incoming.snippets || [],
      notes: incoming.notes || [],
      projects: incoming.projects || [],
      focusSessions: incoming.focusSessions || [],
      usedDays: incoming.usedDays || [],
      settings: { ...emptyData.settings, ...(incoming.settings || {}) }
    };
    saveData();
    applyFontSize(data.settings.fontSize || "normal");
    renderAll();
  }
};