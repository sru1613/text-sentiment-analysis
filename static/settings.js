// Settings form submission handler (CSP compliant)
(() => {
  const form = document.getElementById('settingsForm');
  if(!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  // Ensure unchecked checkboxes are represented (explicit off)
  body.background_image_enabled = form.querySelector('input[name="background_image_enabled"]').checked ? 1 : 0;
  body.noise_enabled = form.querySelector('input[name="noise_enabled"]').checked ? 1 : 0;
    try {
      const resp = await fetch('/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (resp.ok) {
        showToast('Settings saved','success');
        const accent = body.accent_theme;
        if (accent) {
          localStorage.setItem('accent-theme', accent);
          if (accent === 'blue') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', accent);
        }
        // Live update background toggles
        document.documentElement.setAttribute('data-bgimg', body.background_image_enabled ? '1':'0');
        document.documentElement.setAttribute('data-noise', body.noise_enabled ? '1':'0');
      } else {
        showToast('Save failed','error');
      }
    } catch(err){
      showToast('Network error','error');
    }
  });
})();