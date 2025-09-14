const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeFileBtn = document.getElementById('analyzeFileBtn');
const textEl = document.getElementById('text');
const fileInput = document.getElementById('fileInput');
const summaryEl = document.getElementById('summary');
const ctx = document.getElementById('scoresChart').getContext('2d');
let chart = null;

// Batch & history elements
const csvInput = document.getElementById('csvInput');
const analyzeCsvBtn = document.getElementById('analyzeCsvBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const csvSummary = document.getElementById('csvSummary');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const historyList = document.getElementById('historyList');

// Choose backend origin: if page is served from Flask (port 5000) use same origin,
// otherwise assume backend at http://127.0.0.1:5000
const currentOrigin = window.location.origin;
const backendOrigin = currentOrigin && currentOrigin.includes('5000') ? currentOrigin : 'http://127.0.0.1:5000';
const analyzeUrl = backendOrigin + '/analyze';
const analyzeFileUrl = backendOrigin + '/analyze_file';
const analyzeCsvUrl = backendOrigin + '/analyze_csv';
const historyUrl = backendOrigin + '/history?limit=10';

function renderResult(data) {
  const label = data.label || 'Neutral';
  const emoji = data.emoji || '😐';
  const scores = data.scores || {pos:0,neu:0,neg:0,compound:0};
  summaryEl.innerHTML = `<div class="label">${label} ${emoji}</div>` +
    `<div class="scores">Positive: ${scores.pos.toFixed(3)} | Neutral: ${scores.neu.toFixed(3)} | Negative: ${scores.neg.toFixed(3)} | Compound: ${scores.compound.toFixed(3)}</div>`;

  const values = [scores.pos, scores.neu, scores.neg];
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

analyzeBtn.addEventListener('click', async () => {
  const text = textEl.value.trim();
  try {
    const resp = await fetch(analyzeUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text})});
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

analyzeFileBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a .txt file first');
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  try {
    const resp = await fetch(analyzeFileUrl, {method:'POST', body: fd});
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
  try {
    const resp = await fetch(analyzeCsvUrl, { method: 'POST', body: fd });
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
        const csvResp = await fetch(analyzeCsvUrl + '?format=csv', { method: 'POST', body: fd });
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

async function loadHistory() {
  try {
    const resp = await fetch(historyUrl);
    if (!resp.ok) { historyList.textContent = 'Failed to load history'; return; }
    const data = await resp.json();
    if (!data.items?.length) { historyList.textContent = 'No history yet'; return; }
    const rows = data.items
      .map(item => `${item.created_at} — [${item.source}] ${item.label} (pos:${item.pos.toFixed(2)} neu:${item.neu.toFixed(2)} neg:${item.neg.toFixed(2)} cmp:${item.compound.toFixed(2)})`);
    historyList.innerHTML = '<ul><li>' + rows.map(r => r.replaceAll('<','&lt;')).join('</li><li>') + '</li></ul>';
  } catch (e) {
    historyList.textContent = 'Network or server error: ' + e.message;
  }
}
refreshHistoryBtn?.addEventListener('click', loadHistory);
window.addEventListener('load', loadHistory);

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
    div.innerHTML = `<strong>${type}:</strong> ${text.replaceAll('<','&lt;')}`;
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
    wrap.innerHTML = `<span class="bar"><span class="seg pos" style="width:${posW}px"></span><span class="seg neu" style="width:${neuW}px"></span><span class="seg neg" style="width:${negW}px"></span></span>`;
    return wrap;
  }

  window.__chatAppend = function(type, text, scores){
    const item = document.createElement('div');
    item.className = 'chat-msg ' + (type === 'You' ? 'user' : 'bot');
    const strong = (type === 'You') ? 'You' : 'Bot';
    item.innerHTML = `<div><strong>${strong}:</strong> ${text.replaceAll('<','&lt;')}</div>`;
    if (scores) item.appendChild(makeBar(scores));
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
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

    if (window.__chatAppend) window.__chatAppend('You', message, userScores); else {
      const div = document.createElement('div');
      div.style.marginTop = '8px';
      div.innerHTML = `<strong>You:</strong> ${message.replaceAll('<','&lt;')}`;
      list.appendChild(div);
      adjustSectionHeightFor(list);
    }
    input.value = '';

    // Send to chatbot
    try {
      const resp = await fetch(chatUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message})});
      if (!resp.ok){
        (window.__chatAppend ? window.__chatAppend('Bot', `Error ${resp.status}`) : (list.textContent += `\nBot: Error ${resp.status}`));
        return;
      }
      const data = await resp.json();
      const emoji = (data.sentiment && data.sentiment.emoji) ? ` ${data.sentiment.emoji}` : '';
      (window.__chatAppend ? window.__chatAppend('Bot', `${data.reply}${emoji}`, data.sentiment?.scores) : (list.textContent += `\nBot: ${data.reply}${emoji}`));
      if (!window.__chatAppend) adjustSectionHeightFor(list);
    } catch(e){
      (window.__chatAppend ? window.__chatAppend('Bot', 'Network error') : (list.textContent += `\nBot: Network error`));
      if (!window.__chatAppend) adjustSectionHeightFor(list);
    }
  }

  sendBtn?.addEventListener('click', send);
  input?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') send(); });
})();
