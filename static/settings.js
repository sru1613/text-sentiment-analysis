// Settings form submission handler (CSP compliant)
(() => {
  const form = document.getElementById('settingsForm');
  if(!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      const resp = await fetch('/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (resp.ok) {
        showToast('Settings saved','success');
        const accent = body.accent_theme;
        if (accent) {
          // align with base accent logic
          localStorage.setItem('accent-theme', accent);
          if (accent === 'blue') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', accent);
        }
      } else {
        showToast('Save failed','error');
      }
    } catch(err){
      showToast('Network error','error');
    }
  });
})();