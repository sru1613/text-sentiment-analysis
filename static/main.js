const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeFileBtn = document.getElementById('analyzeFileBtn');
const textEl = document.getElementById('text');
const fileInput = document.getElementById('fileInput');
const summaryEl = document.getElementById('summary');
// Chart context (only present on analyze page)
let chart = null;
const scoresCanvas = document.getElementById('scoresChart');
let ctx = null;
if (scoresCanvas && scoresCanvas.getContext) {
  ctx = scoresCanvas.getContext('2d');
}
const modelSelect = document.getElementById('modelSelect');
const extrasEl = document.getElementById('extras');
const wordcloudWrap = document.getElementById('wordcloudWrap');
const wordcloudImg = document.getElementById('wordcloudImg');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const scoreBarsEl = document.getElementById('scoreBars');
const keywordChipsEl = document.getElementById('keywordChips');

// Utility: adjust parent section content height after dynamic injections so nothing gets cut
function adjustExpandedSectionHeight(node){
  try {
    if (!node) return;
    const sec = node.closest && node.closest('.section');
    if (!sec || sec.getAttribute('aria-expanded') !== 'true') return;
    const content = sec.querySelector('.section-content');
    if (!content) return;
    requestAnimationFrame(()=>{ content.style.maxHeight = content.scrollHeight + 'px'; });
  } catch {}
}

// Batch & history elements
const csvInput = document.getElementById('csvInput');
const analyzeCsvBtn = document.getElementById('analyzeCsvBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const csvSummary = document.getElementById('csvSummary');
const dropZone = document.getElementById('dropZone');
const dzFileName = document.getElementById('dzFileName');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const historyList = document.getElementById('historyList');
const historySearch = document.getElementById('historySearch');
const historyTableBody = document.getElementById('historyTBody');
let historyData = [];
let historySort = { key: 'created_at', dir: 'desc' };

// Helpers for safe formatting
function escapeHtml(s){
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}
function fmtNum(n){ const v = Number(n); if (!isFinite(v)) return '0.00'; return v.toFixed(2); }

// Choose backend origin: if page is served from Flask (port 5000) use same origin,
// otherwise assume backend at http://127.0.0.1:5000
const currentOrigin = window.location.origin;
const backendOrigin = currentOrigin && currentOrigin.includes('5000') ? currentOrigin : 'http://127.0.0.1:5000';
const analyzeUrl = backendOrigin + '/analyze';
const analyzeFileUrl = backendOrigin + '/analyze_file';
const analyzeCsvUrl = backendOrigin + '/analyze_csv';
const exportPdfUrl = backendOrigin + '/export_pdf';
const historyUrl = backendOrigin + '/history?limit=10';

function renderResult(data) {
  const label = data.label || 'Neutral';
  const emoji = data.emoji || '😐';
  const scores = data.scores || {pos:0,neu:0,neg:0,compound:0};
  summaryEl.innerHTML = '';
    const lbl = document.createElement('div'); lbl.className = 'label'; lbl.textContent = label + ' ' + emoji;
    const scr = document.createElement('div'); scr.className = 'scores';
    scr.textContent = `Positive: ${fmtNum(scores.pos)} | Neutral: ${fmtNum(scores.neu)} | Negative: ${fmtNum(scores.neg)} | Compound: ${fmtNum(scores.compound)}`;
    summaryEl.appendChild(lbl); summaryEl.appendChild(scr);
  summaryEl.setAttribute('data-sentiment', label);
  summaryEl.setAttribute('role','region');
  summaryEl.setAttribute('aria-label','Sentiment summary');

  const values = [scores.pos, scores.neu, scores.neg];
  if (ctx) {
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Positive','Neutral','Negative'],
      datasets: [{
        label: 'Scores',
        data: values,
        backgroundColor: ['#4caf50','#9e9e9e','#f44336']
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, max: 1 } }
    }
    });
  }

  if (extrasEl) {
    const parts = [];
    if (data.lang) parts.push(`<div><strong>Language:</strong> ${escapeHtml(data.lang)}</div>`);
    if (Array.isArray(data.keywords) && data.keywords.length) {
      parts.push(`<div><strong>Keywords:</strong> ${data.keywords.slice(0,8).map(k=>`<span class="kw">${escapeHtml(k)}</span>`).join(', ')}</div>`);
    }
    if (data.label) parts.push(`<div><strong>Classification:</strong> ${escapeHtml(data.label)} ${escapeHtml(data.emoji||'')}</div>`);
    extrasEl.innerHTML = parts.join('');
  }
  // score bars
  if (scoreBarsEl) {
  const p = Math.round((Number(scores.pos) || 0) * 100);
  const n = Math.round((Number(scores.neu) || 0) * 100);
  const g = Math.round((Number(scores.neg) || 0) * 100);
    scoreBarsEl.innerHTML = `
      <div class="meter"><span data-target="${p}" style="width:0%" class="pos" aria-label="Positive ${p}%"></span></div>
      <div class="meter"><span data-target="${n}" style="width:0%" class="neu" aria-label="Neutral ${n}%"></span></div>
      <div class="meter"><span data-target="${g}" style="width:0%" class="neg" aria-label="Negative ${g}%"></span></div>`;
    scoreBarsEl.style.display='block';
    // Reconnect observer for new bars
    if (window.__scoreObserverInit) {
      window.__scoreObserverInit();
    }
  }
  // keyword chips
  if (keywordChipsEl) {
    if (Array.isArray(data.keywords) && data.keywords.length) {
      keywordChipsEl.innerHTML = '';
      data.keywords.slice(0,12).forEach(k=>{
        const b = document.createElement('button'); b.type='button'; b.className='chip'; b.tabIndex=-1; b.textContent = k; keywordChipsEl.appendChild(b);
      });
      keywordChipsEl.style.display='flex';
    } else {
      keywordChipsEl.style.display='none';
    }
  }
  if (wordcloudWrap && wordcloudImg) {
    if (data.wordcloud_png_b64) {
      wordcloudImg.src = 'data:image/png;base64,' + data.wordcloud_png_b64;
      wordcloudWrap.style.display = '';
      wordcloudImg.onload = () => adjustExpandedSectionHeight(wordcloudImg);
    } else {
      wordcloudWrap.style.display = 'none';
    }
  }
  // final height adjustment after building all pieces
  adjustExpandedSectionHeight(summaryEl);
}

analyzeBtn?.addEventListener('click', async () => {
  const text = textEl.value.trim();
  const model = (modelSelect?.value || 'vader');
  try {
    const resp = await fetch(analyzeUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text, model})});
    if (!resp.ok) {
      const txt = await resp.text();
      summaryEl.innerText = `Error: ${resp.status} ${resp.statusText} - ${txt || 'no details'}`;
      return;
    }
    // guard JSON parsing
    const txt = await resp.text();
    if (!txt) { summaryEl.innerText = 'Empty response from server'; return; }
    const data = JSON.parse(txt);
    renderResult(data);
  } catch (err) {
    summaryEl.innerText = 'Network or server error: ' + err.message;
  }
});

analyzeFileBtn?.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a .txt file first');
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  const model = (modelSelect?.value || 'vader');
  try {
    const resp = await fetch(analyzeFileUrl + `?model=${encodeURIComponent(model)}`, {method:'POST', body: fd});
    if (!resp.ok) {
      const txt = await resp.text();
      summaryEl.innerText = `Error: ${resp.status} ${resp.statusText} - ${txt || 'no details'}`;
      return;
    }
    const txt = await resp.text();
    if (!txt) { summaryEl.innerText = 'Empty response from server'; return; }
    const data = JSON.parse(txt);
    renderResult(data);
  } catch (err) {
    summaryEl.innerText = 'Network or server error: ' + err.message;
  }
});

analyzeCsvBtn?.addEventListener('click', async () => {
  const file = csvInput.files?.[0];
  if (!file) { alert('Please select a .csv file first'); return; }
  const fd = new FormData();
  fd.append('file', file);
  csvSummary.textContent = 'Uploading and analyzing...';
  downloadCsvBtn.disabled = true;
  const model = (modelSelect?.value || 'vader');
  try {
    const resp = await fetch(analyzeCsvUrl + `?model=${encodeURIComponent(model)}`, { method: 'POST', body: fd });
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      const msg = await resp.text();
      csvSummary.textContent = `Error: ${resp.status} ${resp.statusText} - ${msg || 'no details'}`;
      return;
    }
    if (contentType.includes('application/json')) {
      const data = await resp.json();
      csvSummary.textContent = `Analyzed ${data.count} rows (showing up to 50 in API response).`;
      // Enable downloadable CSV
      downloadCsvBtn.disabled = false;
      downloadCsvBtn.onclick = async () => {
        // request CSV format
        const csvResp = await fetch(analyzeCsvUrl + `?format=csv&model=${encodeURIComponent(model)}`, { method: 'POST', body: fd });
        const blob = await csvResp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analysis_results.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };
    } else if (contentType.includes('text/csv')) {
      // direct CSV
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analysis_results.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      csvSummary.textContent = 'CSV downloaded.';
    } else {
      csvSummary.textContent = 'Unexpected response.';
    }
  } catch (e) {
    csvSummary.textContent = 'Network or server error: ' + e.message;
  }
});

exportPdfBtn?.addEventListener('click', async () => {
  const text = textEl.value.trim();
  if (!text) { alert('Enter text first'); return; }
  const model = (modelSelect?.value || 'vader');
  try {
    const resp = await fetch(exportPdfUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text, model}) });
    if (!resp.ok) { const m = await resp.text(); alert('Failed to export PDF: ' + (m || resp.statusText)); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sentiment_report.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Error exporting PDF: ' + e.message);
  }
});

function renderHistory(){
  if (!historyTableBody) return;
  const term = (historySearch?.value || '').trim().toLowerCase();
  let filtered = historyData;
  if (term) {
    filtered = filtered.filter(r => (r.label||'').toLowerCase().includes(term) || (r.source||'').toLowerCase().includes(term));
  }
  filtered.sort((a,b)=>{
    const k = historySort.key;
    let av = a[k]; let bv = b[k];
    if (k === 'created_at') { av = a[k] || ''; bv = b[k] || ''; }
    if (av < bv) return historySort.dir === 'asc' ? -1 : 1;
    if (av > bv) return historySort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  if (!filtered.length){
    historyTableBody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td'); td.colSpan = 5; td.style.padding='14px'; td.style.textAlign='center'; td.style.opacity='.7'; td.textContent = 'No history yet';
    tr.appendChild(td); historyTableBody.appendChild(tr);
    return;
  }
  historyTableBody.innerHTML = '';
  filtered.forEach(r => {
    const tr = document.createElement('tr');
    const tdDate = document.createElement('td'); tdDate.textContent = r.created_at || '';
    const tdSource = document.createElement('td'); tdSource.textContent = r.source || '';
    const tdLabel = document.createElement('td');
    const span = document.createElement('span'); span.className = 'badge ' + (r.label === 'Positive' ? 'pos' : r.label === 'Negative' ? 'neg' : 'neu'); span.textContent = r.label || '';
    tdLabel.appendChild(span);
    const tdScores = document.createElement('td'); tdScores.textContent = `${fmtNum(r.pos)}/${fmtNum(r.neg)}/${fmtNum(r.neu)}/${fmtNum(r.compound)}`;
    const tdSnippet = document.createElement('td'); const snippet = (r.text_snippet || ''); tdSnippet.title = snippet; tdSnippet.textContent = snippet.length>60 ? snippet.slice(0,60)+'…' : snippet;
    tr.appendChild(tdDate); tr.appendChild(tdSource); tr.appendChild(tdLabel); tr.appendChild(tdScores); tr.appendChild(tdSnippet);
    historyTableBody.appendChild(tr);
  });
}

async function loadHistory(){
  try {
    const resp = await fetch(historyUrl);
    if (!resp.ok) { historyData = []; renderHistory(); return; }
    const data = await resp.json();
    historyData = data.items || [];
    renderHistory();
  } catch(e){ historyData = []; renderHistory(); }
}

historySearch?.addEventListener('input', ()=>{ renderHistory(); });

document.querySelectorAll('#historyTable thead th[data-sort]')?.forEach(th => {
  th.addEventListener('click', ()=>{
    const key = th.getAttribute('data-sort');
    if (historySort.key === key){
      historySort.dir = historySort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      historySort.key = key; historySort.dir = 'asc';
    }
    document.querySelectorAll('#historyTable thead th[data-sort]').forEach(o=>{
      o.textContent = o.textContent.replace(/\s*[▾▴]$/,'');
    });
    th.textContent = th.textContent.replace(/\s*[▾▴]$/,'') + (historySort.dir==='asc' ? ' ▴' : ' ▾');
    renderHistory();
  });
});

refreshHistoryBtn?.addEventListener('click', loadHistory);
window.addEventListener('load', loadHistory);

// Drag & Drop CSV
if (dropZone && csvInput) {
  const activate = () => dropZone.classList.add('dragover');
  const deactivate = () => dropZone.classList.remove('dragover');
  ['dragenter','dragover'].forEach(evt => dropZone.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); activate(); }));
  ['dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); if (evt==='drop') return; deactivate(); }));
  dropZone.addEventListener('drop', e => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      const f = files[0];
      if (!f.name.endsWith('.csv')) { alert('Please drop a .csv file'); deactivate(); return; }
      csvInput.files = files; // assign
      dzFileName.textContent = f.name + ' (' + Math.round(f.size/1024) + ' KB)';
      dzFileName.style.display='block';
    }
    deactivate();
  });
  dropZone.addEventListener('click', () => csvInput.click());
  csvInput.addEventListener('change', () => {
    if (csvInput.files?.length) {
      const f = csvInput.files[0];
      dzFileName.textContent = f.name + ' (' + Math.round(f.size/1024) + ' KB)';
      dzFileName.style.display='block';
    } else {
      dzFileName.style.display='none';
    }
  });
}

function getSectionKey(sec){
  return sec.getAttribute('data-key') || '';
}

function saveSectionState(sec){
  const key = getSectionKey(sec);
  if (!key) return;
  const expanded = sec.getAttribute('aria-expanded') === 'true';
  try { localStorage.setItem('section:'+key, expanded ? '1' : '0'); } catch {}
}

function loadSectionState(sec){
  const key = getSectionKey(sec);
  if (!key) return null;
  try {
    const val = localStorage.getItem('section:'+key);
    if (val === '1') return true;
    if (val === '0') return false;
  } catch {}
  return null;
}

function setSectionExpanded(sec, expand){
  const content = sec.querySelector('.section-content');
  if (!content) return;
  if (expand){
    sec.setAttribute('aria-expanded','true');
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.opacity = '1';
  } else {
    sec.setAttribute('aria-expanded','false');
    content.style.maxHeight = '0px';
    content.style.opacity = '0';
  }
  saveSectionState(sec);
}

// Expand/collapse sections
function setupSectionToggles(){
  document.querySelectorAll('.section').forEach(sec => {
    const btn = sec.querySelector('.section-header');
    const content = sec.querySelector('.section-content');
    if (!btn || !content) return;

    // Load persisted state if available
    const persisted = loadSectionState(sec);
    if (persisted !== null){
      setSectionExpanded(sec, persisted);
    } else if (sec.getAttribute('aria-expanded') === 'true'){
      content.style.maxHeight = content.scrollHeight + 'px';
      content.style.opacity = '1';
    }

    btn.addEventListener('click', () => {
      const expanded = sec.getAttribute('aria-expanded') === 'true';
      setSectionExpanded(sec, !expanded);
    });

    // Recalculate on resize to keep height accurate
    window.addEventListener('resize', () => {
      if (sec.getAttribute('aria-expanded') === 'true') {
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });

  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');
  expandAllBtn?.addEventListener('click', () => {
    document.querySelectorAll('.section').forEach(sec => setSectionExpanded(sec, true));
  });
  collapseAllBtn?.addEventListener('click', () => {
    document.querySelectorAll('.section').forEach(sec => setSectionExpanded(sec, false));
  });
}

window.addEventListener('load', setupSectionToggles);

// Score bar IntersectionObserver animation
(function(){
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let observer = null;
  function animateBar(el){
    if (!el) return;
    const target = parseInt(el.getAttribute('data-target')||'0',10);
    if (prefersReduced){
      el.style.width = target + '%';
      return;
    }
    requestAnimationFrame(()=>{
      el.style.transition = 'width 900ms cubic-bezier(.4,0,.2,1)';
      el.style.width = target + '%';
    });
  }
  function handle(entries){
    entries.forEach(entry=>{
      if (entry.isIntersecting){
        const spans = entry.target.querySelectorAll('[data-target]');
        spans.forEach(s=>{
          if (!s.__animated){ animateBar(s); s.__animated = true; }
        });
        // Once animated, no need to observe further for that container
        observer.unobserve(entry.target);
      }
    });
  }
  function init(){
    if (observer) { try { observer.disconnect(); } catch{} }
    observer = new IntersectionObserver(handle, { threshold: 0.35 });
    const container = document.getElementById('scoreBars');
    if (container && container.querySelector('[data-target]')){
      observer.observe(container);
    }
  }
  window.__scoreObserverInit = init;
  window.addEventListener('load', init);
})();

// Theme toggle logic
(function(){
  const checkbox = document.getElementById('toggle');
  const root = document.documentElement; // <html>

  function applyTheme(mode){
    if (mode === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.remove('theme-light');
    }
  }

  function saveTheme(mode){
    try { localStorage.setItem('theme-mode', mode); } catch {}
  }

  function loadTheme(){
    try { return localStorage.getItem('theme-mode'); } catch { return null; }
  }

  function systemPrefersDark(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function init(){
    const saved = loadTheme();
    let mode = saved || (systemPrefersDark() ? 'dark' : 'light');
    applyTheme(mode);
    if (checkbox) checkbox.checked = (mode === 'dark');
  }

  checkbox?.addEventListener('change', () => {
    const mode = checkbox.checked ? 'dark' : 'light';
    applyTheme(mode);
    saveTheme(mode);
  });

  init();
})();

// Chatbot
(function(){
  const chatUrl = backendOrigin + '/chat';
  const sendBtn = document.getElementById('chatSendBtn');
  const input = document.getElementById('chatInput');
  const list = document.getElementById('chatMessages');
  const toneSelect = document.getElementById('toneSelect');
  const chipsWrap = document.getElementById('quickReplies');
  // If chat UI not present on this page, skip initializing logic
  if (!sendBtn && !input && !list) { return; }

  // Ensure the expanded section grows to fit newly appended chat content
  function adjustSectionHeightFor(el){
    const sec = el?.closest?.('.section');
    if (!sec) return;
    const content = sec.querySelector('.section-content');
    if (!content) return;
    if (sec.getAttribute('aria-expanded') !== 'true') return;
    // Wait for DOM to paint then measure
    requestAnimationFrame(()=>{
      content.style.maxHeight = content.scrollHeight + 'px';
    });
  }

  function append(type, text, scores){
    if (window.__chatAppend) { window.__chatAppend(type, text, scores); return; }
    const div = document.createElement('div');
    div.style.marginTop = '8px';
    div.style.whiteSpace = 'pre-wrap';
    const strong = document.createElement('strong'); strong.textContent = type + ':';
    div.appendChild(strong);
    div.appendChild(document.createTextNode(' ' + (text || '')));
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    adjustSectionHeightFor(list);
  }

  function makeBar(scores){
    const pos = Math.max(0, Math.min(1, (scores?.pos ?? 0)));
    const neu = Math.max(0, Math.min(1, (scores?.neu ?? 0)));
    const neg = Math.max(0, Math.min(1, (scores?.neg ?? 0)));
    const total = pos + neu + neg || 1;
    const posW = Math.round((pos/total)*120);
    const neuW = Math.round((neu/total)*120);
    const negW = Math.max(0, 120 - posW - neuW);
  const wrap = document.createElement('div');
  wrap.className = 'sentibar';
  const bar = document.createElement('span'); bar.className = 'bar';
  const sPos = document.createElement('span'); sPos.className='seg pos'; sPos.style.width = posW + 'px';
  const sNeu = document.createElement('span'); sNeu.className='seg neu'; sNeu.style.width = neuW + 'px';
  const sNeg = document.createElement('span'); sNeg.className='seg neg'; sNeg.style.width = negW + 'px';
  bar.appendChild(sPos); bar.appendChild(sNeu); bar.appendChild(sNeg);
  wrap.appendChild(bar);
  return wrap;
  }

  function formatTime(d){
    try{
      const dt = d instanceof Date ? d : new Date();
      return dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    } catch { return ''; }
  }

  window.__chatAppend = function(type, text, scores, opts){
    const item = document.createElement('div');
    item.className = 'chat-msg ' + (type === 'You' ? 'user' : 'bot');
    const strong = (type === 'You') ? 'You' : 'Bot';
    const safe = (text || '').replaceAll('<','&lt;');
    const ts = opts?.timestamp instanceof Date ? opts.timestamp : new Date();
    const badge = (opts?.tone && type !== 'You') ? `<span class="badge ${opts.tone}">${opts.tone}</span>` : '';
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const sEl = document.createElement('strong'); sEl.textContent = strong + ':';
    inner.appendChild(sEl);
    inner.appendChild(document.createTextNode(' ' + safe));
    if (badge) {
      const spanBadge = document.createElement('span'); spanBadge.className = 'badge ' + (opts?.tone || ''); spanBadge.textContent = opts?.tone || '';
      inner.appendChild(document.createTextNode(' ')); inner.appendChild(spanBadge);
    }
    outer.appendChild(inner);
    item.appendChild(outer);
    if (scores) item.appendChild(makeBar(scores));
    const t = document.createElement('div');
    t.className = 'time';
    t.textContent = formatTime(ts);
    item.appendChild(t);
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
    adjustSectionHeightFor(list);
  }

  function showTyping(){
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg bot typing';
    bubble.setAttribute('data-typing','1');
  const inner = document.createElement('div');
  const sEl = document.createElement('strong'); sEl.textContent = 'Bot:';
  const spanTyping = document.createElement('span'); spanTyping.className = 'typing'; spanTyping.textContent = ' typing';
  const dots = document.createElement('span'); dots.className = 'dots';
  for (let i=0;i<3;i++){ const d = document.createElement('span'); d.className='dot'; dots.appendChild(d); }
  spanTyping.appendChild(dots);
  inner.appendChild(sEl); inner.appendChild(document.createTextNode(' ')); inner.appendChild(spanTyping);
  bubble.appendChild(inner);
    list.appendChild(bubble);
    list.scrollTop = list.scrollHeight;
    adjustSectionHeightFor(list);
    return bubble;
  }

  function clearTyping(el){
    if (el && el.parentNode) el.parentNode.removeChild(el);
    adjustSectionHeightFor(list);
  }

  async function send(){
    const message = (input?.value || '').trim();
    if (!message) return;

    // Pre-analyze user's message to show sentiment bar
    let userScores = null;
    try{
      const resp = await fetch(analyzeUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text: message})});
      if (resp.ok){
        const data = await resp.json();
        userScores = data?.scores || null;
      }
    } catch {}

    if (window.__chatAppend) window.__chatAppend('You', message, userScores, { timestamp: new Date() }); else {
      const div = document.createElement('div');
      div.style.marginTop = '8px';
  const strong = document.createElement('strong'); strong.textContent = 'You:';
  div.appendChild(strong); div.appendChild(document.createTextNode(' ' + message));
      list.appendChild(div);
      adjustSectionHeightFor(list);
    }
    input.value = '';

    // Send to chatbot
    const typingEl = showTyping();
    try {
  const selTone = (toneSelect?.value || 'listening');
  const resp = await fetch(chatUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message, tone: selTone})});
      if (!resp.ok){
        clearTyping(typingEl);
        (window.__chatAppend ? window.__chatAppend('Bot', `Error ${resp.status}`, null, { timestamp: new Date() }) : (list.textContent += `\nBot: Error ${resp.status}`));
        return;
      }
      const data = await resp.json();
      const emoji = (data.sentiment && data.sentiment.emoji) ? ` ${data.sentiment.emoji}` : '';
      // Adaptive typing delay based on length and tone
      const base = Math.max(300, Math.round((data.reply || '').length / 30 * 1000));
      const respTone = (data.tone || (toneSelect?.value || 'listening'));
      const toneFactor = respTone === 'coaching' ? 0.8 : 1.15; // coaching faster, listening slower
      const delayMs = Math.min(2500, Math.max(250, Math.round(base * toneFactor)));
      setTimeout(()=>{
        clearTyping(typingEl);
        (window.__chatAppend ? window.__chatAppend('Bot', `${data.reply}${emoji}`, data.sentiment?.scores, { timestamp: new Date(), tone: respTone }) : (list.textContent += `\nBot: ${data.reply}${emoji}`));
        if (!window.__chatAppend) adjustSectionHeightFor(list);
      }, delayMs);
      if (!window.__chatAppend) adjustSectionHeightFor(list);
    } catch(e){
      clearTyping(typingEl);
      (window.__chatAppend ? window.__chatAppend('Bot', 'Network error', null, { timestamp: new Date() }) : (list.textContent += `\nBot: Network error`));
      if (!window.__chatAppend) adjustSectionHeightFor(list);
    }
  }

  sendBtn?.addEventListener('click', send);
  input?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') send(); });

  // Quick reply chips
  const baseChips = [
    { id:'breathing', text: 'Do breathing', message: 'I feel stressed. Can we do a 4-7-8 breathing exercise?' },
    { id:'tinyplan', text: 'Make a tiny plan', message: "I'm overwhelmed. Help me pick a tiny first step." },
    { id:'sleep', text: 'Improve sleep', message: "I can't sleep. Any tips to wind down?" },
    { id:'focus', text: 'Focus for 25m', message: "I can't focus. Can you guide me with a 25/5 cycle?" },
    { id:'history', text: 'Show history', message: "Show my recent analysis history" },
  ];

  function renderChips(suggestions){
    if (!chipsWrap) return;
    chipsWrap.innerHTML = '';
    const add = (id) => {
      const found = baseChips.find(c => c.id === id);
      if (!found) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = found.text;
      b.addEventListener('click', () => { input.value = found.message; send(); });
      chipsWrap.appendChild(b);
    };
    // Map suggestion keywords to chip ids
    const map = {
      'Do breathing':'breathing', 'Urgent vs important':'tinyplan', 'Make a mini plan':'tinyplan', 'Pick first topic':'tinyplan',
      'Body scan':'sleep', 'Wind-down tips':'sleep', 'Start 10-minute timer':'focus', '25/5 Pomodoro':'focus',
      'Show history':'history', 'Analyze my text':'tinyplan'
    };
    const ids = new Set();
    (suggestions || []).forEach(s => { const id = map[s] || null; if (id) ids.add(id); });
    if (ids.size === 0) { ids.add('breathing'); ids.add('tinyplan'); }
    ids.forEach(add);
  }

  // Initial chips
  renderChips(['Do breathing','Make a mini plan']);
})();
