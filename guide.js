/* دليل موقع مُعين + جولة قصيرة بدون شاشة سوداء */
(() => {
  const SEEN_KEY = "mueen_guide_seen_v15";

  const topics = [
    {
      id: "home",
      title: "الرئيسية",
      icon: "⌂",
      text: "هنا تشوف ملخص يومك: المهام المفتوحة، القصاصات، الملاحظات، وأيامك المتتالية. ابدأ من لوحة اليوم."
    },
    {
      id: "tasks",
      title: "المهام",
      icon: "✓",
      text: "أضف مهمة، حدّد أولويتها وتاريخها، واربطها بمشروع. يمكنك بدء جلسة تركيز مباشرة من المهمة."
    },
    {
      id: "snippets",
      title: "قصاصات الكود",
      icon: "{ }",
      text: "احفظ أكوادك حسب اللغة، ثبّت المهم، وابحث بالعنوان أو الوسم. اللصق من الحافظة متاح بزر واحد."
    },
    {
      id: "notes",
      title: "الملاحظات",
      icon: "▤",
      text: "اكتب فكرة أو قرارًا واربطه بمشروع حتى لا يضيع وسط المهام والكود."
    },
    {
      id: "projects",
      title: "المشاريع",
      icon: "▦",
      text: "اجمع المهام والكود والملاحظات تحت مشروع واحد، وتابع نسبة الإنجاز."
    },
    {
      id: "focus",
      title: "التركيز",
      icon: "◷",
      text: "جلسة 25 دقيقة مع استراحة. اربط الجلسة بمهمة، وبعدها سجّل ماذا أنجزت."
    },
    {
      id: "templates",
      title: "القوالب",
      icon: "▤",
      text: "ابدأ صفحة أو مكوّن جاهز، غيّر الألوان والخط، ثم انسخ أو حمّل الملفات."
    },
    {
      id: "tools",
      title: "الأدوات",
      icon: "⚙",
      text: "منسق JSON، الألوان، Base64، مقارنة النصوص، README وgitignore — أدوات سريعة بدون حساب."
    },
    {
      id: "convert",
      title: "تحويل اللغات",
      icon: "{→}",
      text: "حوّل كودًا بين Python وJavaScript ولغات قريبة. التحويل تقريبي وتعليمي، ويمكن حفظ الناتج كقصاصة."
    },
    {
      id: "settings",
      title: "الحفظ والحساب",
      icon: "☁",
      text: "بياناتك تُحفظ على جهازك أولًا. التصدير والاستيراد يعملان دائمًا. حساب Google طبقة ثانية اختيارية للمزامنة."
    }
  ];

  function showPage(name) {
    if (typeof window.showPage === "function") window.showPage(name);
  }

  function markSeen() {
    localStorage.setItem(SEEN_KEY, "1");
  }

  window.renderSiteGuide = function renderSiteGuide() {
    const el = document.getElementById("guidePage");
    if (!el) return;
    const content = el.querySelector(".extra-page-content");
    if (!content) return;
    el.querySelector(".extra-page-actions").innerHTML =
      `<button class="primary-button" id="startTourBtn" type="button">ابدأ الجولة</button>`;
    content.innerHTML = `
      <div class="guide-intro today-card">
        <h3>كيف يعمل مُعين؟</h3>
        <p>مُعين مساحة واحدة للمبرمج: مهام، كود، ملاحظات، تركيز، وقوالب. كل شيء محلي على جهازك حتى تسجّل دخول Google إذا أحببت.</p>
        <div class="item-actions" style="margin-top:12px">
          <button class="primary-button" id="guideStart2" type="button">جولة سريعة</button>
          <button type="button" data-page="tasks">أضف مهمة</button>
        </div>
      </div>
      <div class="guide-grid">
        ${topics.map((t) => `
          <article class="guide-card" data-go="${t.id}">
            <span class="guide-icon">${t.icon}</span>
            <h3>${t.title}</h3>
            <p>${t.text}</p>
            <span class="tool-arrow">افتح ←</span>
          </article>`).join("")}
      </div>
      <div class="today-card" style="margin-top:16px">
        <h3>اختصارات مفيدة</h3>
        <p>N مهمة جديدة · S قصاصة · F تركيز · T قوالب · / بحث · Ctrl+K لوحة الأوامر</p>
      </div>`;
    el.querySelector("#startTourBtn").onclick = startTour;
    content.querySelector("#guideStart2").onclick = startTour;
    content.querySelectorAll("[data-go]").forEach((card) => {
      card.onclick = () => showPage(card.dataset.go);
    });
    content.querySelector("[data-page='tasks']")?.addEventListener("click", () => showPage("tasks"));
  };

  function startTour() {
    markSeen();
    closeTour();
    let step = 0;
    const host = document.createElement("div");
    host.id = "mueenTour";
    host.className = "guide-tour";
    document.body.appendChild(host);

    const draw = () => {
      const item = topics[step];
      showPage(item.id === "settings" ? "settings" : item.id);
      host.innerHTML = `
        <div class="guide-tour-card" role="dialog" aria-label="جولة مُعين">
          <p class="eyebrow">${step + 1} / ${topics.length}</p>
          <h3>${item.icon} ${item.title}</h3>
          <p>${item.text}</p>
          <div class="item-actions">
            <button type="button" id="tourPrev" ${step === 0 ? "disabled" : ""}>السابق</button>
            <button type="button" id="tourSkip">إغلاق</button>
            <button class="primary-button" type="button" id="tourNext">${step === topics.length - 1 ? "تم" : "التالي"}</button>
          </div>
        </div>`;
      host.querySelector("#tourPrev").onclick = () => { if (step > 0) { step -= 1; draw(); } };
      host.querySelector("#tourSkip").onclick = () => { closeTour(); showPage("guide"); };
      host.querySelector("#tourNext").onclick = () => {
        if (step >= topics.length - 1) { closeTour(); showPage("home"); }
        else { step += 1; draw(); }
      };
    };
    draw();
  }

  function closeTour() {
    document.getElementById("mueenTour")?.remove();
  }

  function welcomeOnce() {
    if (localStorage.getItem(SEEN_KEY)) return;
    const bar = document.createElement("div");
    bar.id = "mueenWelcome";
    bar.className = "guide-welcome";
    bar.innerHTML = `
      <div>
        <strong>مرحباً في مُعين</strong>
        <p>هذا دليل قصير للموقع. يمكنك تخطيه والعودة لاحقًا من القائمة.</p>
      </div>
      <div class="item-actions">
        <button type="button" id="skipGuide">لاحقًا</button>
        <button class="primary-button" type="button" id="openGuideWelcome">الدليل</button>
      </div>`;
    document.body.appendChild(bar);
    bar.querySelector("#skipGuide").onclick = () => { markSeen(); bar.remove(); };
    bar.querySelector("#openGuideWelcome").onclick = () => { markSeen(); bar.remove(); showPage("guide"); };
  }

  window.startMueenTour = startTour;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", welcomeOnce);
  else setTimeout(welcomeOnce, 400);
})();
