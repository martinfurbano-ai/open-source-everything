import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { join } from 'node:path';
import { read, root } from './helpers.mjs';

const data = {
  samples: [{ app: 'Mail', text: 'Hello <friend> & welcome.' }, { app: 'Notes', text: 'Another sample.' }],
  hud: { listening: 'LISTENING', whisper: 'WHISPER', pasted: 'PASTED' }, speaker: 'You',
};
async function setup({ reduced = false, raw = JSON.stringify(data), privacy = false } = {}) {
  const timers = new Map();
  const events = {};
  const motionEvents = {};
  const animations = [];
  const errors = [];
  let id = 0;
  const element = (textContent = '') => ({ textContent, hidden: true, dataset: {},
    addEventListener(name, fn) { this[name] = fn; },
    animate() { const animation = { cancel() { this.cancelled = true; } }; animations.push(animation); return animation; },
  });
  const elements = {
    'demo-data': { textContent: raw }, 'demo-text': element(data.samples[0].text),
    'demo-app': element('Mail'), 'demo-label': element('PASTED'),
    'demo-hud': element(), 'demo-replay': element(),
    'demo-speaker': element('static speaker'),
  };
  const document = { hidden: false,
    getElementById: (name) => privacy ? null : elements[name],
    querySelectorAll: () => [element()],
    addEventListener: (name, fn) => { events[name] = fn; },
  };
  const motion = { matches: reduced, addEventListener: (name, fn) => { motionEvents[name] = fn; } };
  const context = { document, matchMedia: () => motion,
    window: { addEventListener: (name, fn) => { events[name] = fn; } },
    setTimeout: (fn) => { timers.set(++id, fn); return id; }, clearTimeout: (key) => timers.delete(key),
    console: { error: (...args) => errors.push(args) },
  };
  vm.runInNewContext(await read(join(root, 'projects/speak-away/page.js')), context);
  function flush() {
    for (let count = 0; timers.size; count++) {
      assert.ok(count < 200, 'demo must finish without an infinite timer loop');
      const [key, fn] = timers.entries().next().value;
      timers.delete(key); fn();
    }
  }
  return { timers, events, motionEvents, motion, elements, document, animations, errors, flush };
}

test('typed demo runs listening, transcription and paste, then stops; replay selects next sample safely', async () => {
  const state = await setup();
  assert.equal(state.elements['demo-label'].textContent, 'LISTENING');
  assert.equal(state.elements['demo-speaker'].textContent, data.speaker);
  assert.equal(state.elements['demo-replay'].hidden, false);
  state.flush();
  assert.equal(state.elements['demo-label'].textContent, 'PASTED');
  assert.equal(state.elements['demo-text'].textContent, data.samples[0].text);
  state.elements['demo-replay'].click();
  state.flush();
  assert.equal(state.elements['demo-text'].textContent, data.samples[1].text);
  assert.equal(state.elements['demo-app'].textContent, 'Notes');
});
test('reduced motion keeps complete text and schedules no animation or timers', async () => {
  const state = await setup({ reduced: true });
  assert.equal(state.elements['demo-replay'].hidden, false);
  assert.equal(state.elements['demo-text'].textContent, data.samples[0].text);
  state.elements['demo-replay'].click();
  assert.equal(state.elements['demo-text'].textContent, data.samples[1].text);
  assert.equal(state.timers.size, 0);
  assert.equal(state.animations.length, 0);
});
test('motion preference changes, hidden tabs and page exit cancel work and restore complete text', async () => {
  for (const trigger of ['motion', 'visibilitychange', 'pagehide']) {
    const state = await setup();
    assert.ok(state.timers.size);
    if (trigger === 'motion') { state.motion.matches = true; state.motionEvents.change(); }
    else { state.document.hidden = true; state.events[trigger](); }
    assert.equal(state.timers.size, 0);
    assert.ok(state.animations.every((animation) => animation.cancelled));
    assert.equal(state.elements['demo-text'].textContent, data.samples[0].text);
  }
});
test('invalid demo JSON preserves static text and logs context; privacy needs no demo', async () => {
  for (const raw of ['{', '{}', '{"samples":[]}']) {
    const state = await setup({ raw });
    assert.equal(state.elements['demo-text'].textContent, data.samples[0].text);
    assert.equal(state.elements['demo-replay'].hidden, true);
    assert.equal(state.timers.size, 0);
    assert.match(state.errors.flat().join(' '), /page.js.*demo-data/);
  }
  const privacy = await setup({ privacy: true, reduced: true });
  assert.equal(privacy.errors.length, 0);
  assert.equal(privacy.timers.size, 0);
});
