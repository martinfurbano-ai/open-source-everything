document.documentElement.classList.add('js');
(() => {
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[hreflang]');
    const language = link?.getAttribute('hreflang');
    if (language !== 'en' && language !== 'es') return;
    try { localStorage.setItem('ose-lang', language); } catch { /* Storage is optional. */ }
  });
  let saved;
  try { saved = localStorage.getItem('ose-lang'); } catch { /* Use browser preference. */ }
  const pageLanguage = document.documentElement.lang;
  const explicit = saved === 'en' || saved === 'es';
  const browserSpanish = (navigator.languages?.[0] || '').toLowerCase().startsWith('es');
  const preferred = explicit ? saved : (!saved && pageLanguage === 'en' && browserSpanish ? 'es' : null);
  if (!['en', 'es'].includes(preferred) || preferred === document.documentElement.lang) return;
  const alternate = document.querySelector(`head link[rel="alternate"][hreflang="${preferred}"]`);
  if (!alternate) return;
  try {
    if (sessionStorage.getItem('ose-lang-redirected')) return;
    sessionStorage.setItem('ose-lang-redirected', '1');
  } catch { return; }
  location.replace(alternate.href);
})();
