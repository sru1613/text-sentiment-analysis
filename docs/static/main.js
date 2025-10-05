const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeFileBtn = document.getElementById('analyzeFileBtn');
const textEl = document.getElementById('text');
const fileInput = document.getElementById('fileInput');
const summaryEl = document.getElementById('summary');
const ctx = document.getElementById('scoresChart').getContext('2d');
let chart = null;

// Choose backend origin for static hosting (e.g., GitHub Pages)
// 1) If window.BACKEND_ORIGIN is provided, use that.
// 2) Else if running locally on port 5000, use same origin.
// 3) Else fallback to http://127.0.0.1:5000 for local dev.
const currentOrigin = window.location.origin;
const backendOrigin = window.BACKEND_ORIGIN || (currentOrigin.includes('5000') ? currentOrigin : 'http://127.0.0.1:5000');
const analyzeUrl = backendOrigin + '/analyze';
const analyzeFileUrl = backendOrigin + '/analyze_file';

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
        backgroundColor: ['#4caf50','#9e9e9e','#f44336'],
        borderColor: ['#4caf50','#9e9e9e','#f44336'],
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: '#ffffff', font: { weight: '600' } } },
        title: { display: false },
        tooltip: { titleColor: '#fff', bodyColor: '#fff', backgroundColor: 'rgba(0,0,0,0.7)' }
      },
      scales: {
        x: { ticks: { color: '#ffffff', font: { weight: '600' } }, grid: { color: 'rgba(255,255,255,0.15)' } },
        y: { beginAtZero: true, max: 1, ticks: { color: '#ffffff', font: { weight: '600' } }, grid: { color: 'rgba(255,255,255,0.15)' } }
      }
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
    const txt = await resp.text();
    if (!txt) { summaryEl.innerText = 'Empty response from server'; return; }
    const data = JSON.parse(txt);
    renderResult(data);
  } catch (err) {
    summaryEl.innerText = 'Network or server error: ' + err.message + '\nBackend: ' + backendOrigin;
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
    summaryEl.innerText = 'Network or server error: ' + err.message + '\nBackend: ' + backendOrigin;
  }
});
