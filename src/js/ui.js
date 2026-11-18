(() => {
  const header = document.querySelector('.site-header');
  const updateNav = () => header?.toggleAttribute('data-scrolled', window.scrollY > 0);
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });
  const elements = [...document.querySelectorAll('.reveal')];
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((element) => element.classList.add('in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  elements.forEach((element) => {
    const siblings = [...element.parentElement.children].filter((sibling) => sibling.classList.contains('reveal'));
    element.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(element), 2) * 80}ms`);
    observer.observe(element);
  });
})();
