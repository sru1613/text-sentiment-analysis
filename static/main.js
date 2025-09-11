const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeFileBtn = document.getElementById('analyzeFileBtn');
const textEl = document.getElementById('text');
const fileInput = document.getElementById('fileInput');
const summaryEl = document.getElementById('summary');
const ctx = document.getElementById('scoresChart').getContext('2d');
let chart = null;

// Choose backend origin: if page is served from Flask (port 5000) use same origin,
// otherwise assume backend at http://127.0.0.1:5000
const currentOrigin = window.location.origin;
const backendOrigin = currentOrigin && currentOrigin.includes('5000') ? currentOrigin : 'http://127.0.0.1:5000';
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
