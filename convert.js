(() => {
  "use strict";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  function convertCode(src, from, to) {
    if (from === to) return { code: src, note: "لا حاجة للتحويل." };
    let out = String(src);
    if (from === "Python" && to === "JavaScript") out = out.replace(/^\s*#(.*)$/gm, "//$1").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null").replace(/\bprint\s*\(/g, "console.log(");
    else if (from === "JavaScript" && to === "Python") out = out.replace(/^\s*\/\/(.*)$/gm, "#$1").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None").replace(/\bconsole\.log\s*\(/g, "print(");
    else if (from === "TypeScript" && to === "JavaScript") out = out.replace(/:\s*[A-Za-z_$][\w$<>\[\]| ]*/g, "").replace(/\binterface\s+\w+\s*\{[^}]*\}/gs, "");
    else return { code: src, note: "هذا المسار غير مدعوم بعد؛ أضف تحويلًا يدويًا أو استخدم أداة مناسبة." };
    return { code: out, note: "تحويل تقريبي محلي. راجع الناتج قبل استخدامه." };
  }
  function renderCodeConverter() {
    const el = document.getElementById("convertPage"); if (!el) return;
    const host = el.querySelector(".extra-page-content");
    host.innerHTML = `<div class="feature-card"><div class="item-actions"><label>من <select id="cvFrom"><option>Python</option><option>JavaScript</option><option>TypeScript</option></select></label><label>إلى <select id="cvTo"><option>JavaScript</option><option>Python</option><option>TypeScript</option></select></label></div><textarea id="cvInput" rows="12" dir="ltr" placeholder="الصق الكود هنا"></textarea><div class="item-actions"><button class="primary-button" id="cvRun">تحويل محلي</button><button class="small-action" id="cvCopy">نسخ الناتج</button></div><p id="cvStatus" class="page-description"></p><textarea id="cvOutput" rows="12" readonly dir="ltr"></textarea></div>`;
    const status = host.querySelector("#cvStatus");
    host.querySelector("#cvRun").onclick = () => { const r = convertCode(host.querySelector("#cvInput").value, host.querySelector("#cvFrom").value, host.querySelector("#cvTo").value); host.querySelector("#cvOutput").value = r.code; status.textContent = r.note; };
    host.querySelector("#cvCopy").onclick = async () => { try { await navigator.clipboard.writeText(host.querySelector("#cvOutput").value); status.textContent = "تم نسخ الناتج."; } catch { status.textContent = "تعذر النسخ؛ انسخ الناتج يدويًا."; } };
  }
  window.convertCode = convertCode; window.renderCodeConverter = renderCodeConverter;
})();