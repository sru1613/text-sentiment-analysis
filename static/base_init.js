// Base initialization: toast system + accent theme persistence
(() => {
  function ensureToastRoot(){
    let c = document.getElementById('toastRoot');
    if(!c){
      c = document.createElement('div');
      c.id='toastRoot';
      Object.assign(c.style, {
        position:'fixed', top:'16px', right:'16px', display:'flex', flexDirection:'column', gap:'10px', zIndex:'10000'
      });
      document.body.appendChild(c);
    }
    return c;
  }
  window.showToast = function(msg, type='info', opts={}){
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = 'toast toast-'+type;
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.textContent = msg;
    Object.assign(el.style, {
      background:'var(--panel-bg, rgba(20,24,32,0.9))', backdropFilter:'blur(6px)', color:'var(--text)',
      padding:'10px 14px', border:'1px solid var(--border)', borderRadius:'10px', fontSize:'14px',
      boxShadow:'0 4px 14px rgba(0,0,0,0.35)', maxWidth:'320px', position:'relative', overflow:'hidden'
    });
    const bar = document.createElement('div');
    Object.assign(bar.style, {position:'absolute', left:0, top:0, bottom:0, width:'4px', background:'var(--accent2)'});
    el.appendChild(bar);
    root.appendChild(el);
    const ttl = opts.ttl || 3500;
    setTimeout(()=>{
      el.style.transition='opacity .4s, transform .4s';
      el.style.opacity='0';
      el.style.transform='translateX(8px)';
      setTimeout(()=> el.remove(), 420);
    }, ttl);
  };

  const root = document.documentElement;
  const KEY = 'accent-theme';
  const serverAccent = root.getAttribute('data-server-accent') || 'blue';
  const isAuth = root.getAttribute('data-auth') === '1';
  function apply(accent){
    if(!accent || accent==='blue') root.removeAttribute('data-accent'); else root.setAttribute('data-accent', accent);
    document.querySelectorAll('.accent-swatch').forEach(s=>{
      const a = s.getAttribute('data-accent');
      s.classList.toggle('active', a===accent || (accent==='blue' && a==='blue'));
    });
  }
  const saved = localStorage.getItem(KEY) || serverAccent || 'blue';
  apply(saved);
  if (serverAccent && serverAccent !== saved) {
    localStorage.setItem(KEY, serverAccent);
    apply(serverAccent);
  }
  async function persist(accent){
    if(!isAuth) return;
    try {
      const fd = new FormData();
      fd.append('accent_theme', accent);
      fetch('/settings', { method:'POST', body: fd });
    } catch {}
  }
  document.querySelectorAll('.accent-swatch').forEach(s=>{
    s.addEventListener('click', ()=>{
      const accent = s.getAttribute('data-accent');
      localStorage.setItem(KEY, accent);
      apply(accent);
      persist(accent);
      showToast('Accent theme: '+accent,'info',{ttl:1800});
    });
  });
})();