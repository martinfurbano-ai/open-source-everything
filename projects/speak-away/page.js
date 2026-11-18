(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const LISTEN_MS = 1000;
  const TRANSCRIBE_MS = 400;
  const WORD_MS = 45;
  let animations = [];
  let timer = null;
  let finishDemo = () => {};

  function stop() {
    clearTimeout(timer);
    timer = null;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    finishDemo();
  }
  function pulse(selector, duration) {
    if (motion.matches || document.hidden) return;
    animations = [...animations, ...[...document.querySelectorAll(selector)].flatMap((element, index) => {
      if (typeof element.animate !== 'function') return [];
      return [element.animate([
        { transform: 'scaleY(1)' }, { transform: 'scaleY(.55)' }, { transform: 'scaleY(1)' },
      ], { duration, delay: index * 80, iterations: 1 })];
    })];
  }
  motion.addEventListener('change', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  pulse('.bubble-bars rect', 1200);

  const block = document.getElementById('demo-data');
  if (!block) return;
  const typed = document.getElementById('demo-text');
  const app = document.getElementById('demo-app');
  const speaker = document.getElementById('demo-speaker');
  const hud = document.getElementById('demo-hud');
  const label = document.getElementById('demo-label');
  const replay = document.getElementById('demo-replay');
  let data;
  try {
    data = JSON.parse(block.textContent);
    if (!data || !Array.isArray(data.samples) || !data.samples.length ||
      !data.samples.every((sample) => sample && typeof sample.app === 'string' && typeof sample.text === 'string' && sample.text.trim()) ||
      !['listening', 'whisper', 'pasted'].every((key) => typeof data.hud?.[key] === 'string') ||
      typeof data.speaker !== 'string' || !typed || !app || !speaker || !hud || !label || !replay) {
      throw new Error('Invalid samples, hud, speaker or missing demo elements');
    }
  } catch (error) {
    stop();
    console.error('projects/speak-away/page.js: invalid #demo-data; keeping static example.', error);
    return;
  }

  let sampleIndex = 0;
  const sample = () => data.samples[sampleIndex];
  function setState(state) {
    hud.dataset.state = state;
    label.textContent = data.hud[state];
  }
  finishDemo = () => {
    app.textContent = sample().app;
    speaker.textContent = data.speaker;
    typed.textContent = sample().text;
    setState('pasted');
  };
  function later(callback, delay) {
    timer = setTimeout(() => { timer = null; callback(); }, delay);
  }
  function run() {
    clearTimeout(timer);
    timer = null;
    finishDemo();
    if (motion.matches || document.hidden) return;
    typed.textContent = '';
    setState('listening');
    pulse('.demo-dot, .key', 900);
    later(() => {
      setState('whisper');
      later(() => {
        const words = sample().text.split(' ');
        let count = 0;
        function typeWord() {
          count += 1;
          typed.textContent = words.slice(0, count).join(' ');
          if (count < words.length) later(typeWord, WORD_MS);
          else stop();
        }
        typeWord();
      }, TRANSCRIBE_MS);
    }, LISTEN_MS);
  }
  replay.hidden = false;
  replay.addEventListener('click', () => {
    stop();
    sampleIndex = (sampleIndex + 1) % data.samples.length;
    run();
  });
  run();
})();
