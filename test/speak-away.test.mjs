import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { built, read, json, fixture, pageFile, root } from './helpers.mjs';
import { build } from '../build.mjs';
import { assertClipboard } from './clipboard-claims.mjs';

test('localized privacy sections disclose deletion, logging, clipboard behavior and model downloads', async (t) => {
  const { out } = await built(t);
  for (const [lang, path] of [['en', '/speak-away/privacy/'], ['es', '/es/speak-away/privacidad/']]) {
    const html = await read(pageFile(out, path));
    const section = (id) => {
      const content = html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1];
      assert.ok(content, `${lang}: missing ${id} section`);
      return content;
    };
    await t.test(`${lang}: preferences deletion command renders as code`, () => {
      assert.match(section('control'), /<code>defaults delete com\.opensourceeverything\.speakaway<\/code>/);
    });
    await t.test(`${lang}: stored debug log is disclosed`, () => {
      assert.match(section('stored'), /debug\.log/);
      assert.match(section('stored'), lang === 'en'
        ? /how many characters were pasted/i : /cuántos caracteres se pegaron/i);
    });
    await t.test(`${lang}: clipboard section discloses restore without timing or unsupported outcomes`, () => {
      assertClipboard(section('clipboard'), lang);
    });
    await t.test(`${lang}: clipboard section discloses paste limits and Command Mode copy and restore`, () => {
      const clipboard = section('clipboard');
      assert.match(clipboard, lang === 'en' ? /Without Accessibility/ : /Sin Accesibilidad/);
      assert.match(clipboard, lang === 'en' ? /Speak Away cannot paste for you/ : /no puede pegar por ti/);
      assert.match(clipboard, lang === 'en' ? /presses the copy shortcut/ : /pulsa por ti el atajo de copiar/);
      assert.match(clipboard, lang === 'en' ? /puts back what you had copied/ : /vuelve a poner lo que tenías copiado/);
    });
    for (const [name, id, pattern] of [
      ['clipboard is readable by other apps', 'clipboard', lang === 'en' ? /where other apps, including clipboard managers, can read it/ : /donde otras apps, incluidos los gestores de portapapeles, pueden leerlo/],
      ['dictated text can remain on the clipboard', 'clipboard', lang === 'en' ? /In some cases the dictated text can stay on the clipboard until you copy something else\./ : /En algunos casos el texto dictado puede quedarse en el portapapeles hasta que copies otra cosa\./],
      ['unreadable data files leave a backup', 'stored', /\.bak/],
      ['entry deletion retains backups until folder deletion', 'stored', lang === 'en' ? /Deleting entries in the app does not remove that copy; deleting the folder does\./ : /Borrar entradas en la app no elimina esa copia; borrar la carpeta sí\./],
    ]) {
      await t.test(`${lang}: ${name}`, () => assert.match(section(id), pattern));
    }
    await t.test(`${lang}: iPhone Full Access includes haptics, not only file sharing`, () => {
      const iphone = section('iphone');
      assert.match(iphone, lang === 'en' ? /haptic/i : /háptic/i);
      assert.doesNotMatch(iphone, lang === 'en' ? /only to share files/i : /solo para compartir archivos/i);
    });
    await t.test(`${lang}: network section discloses repeat downloads only for missing or incomplete folders`, () => {
      assert.match(section('network'), lang === 'en'
        ? /again only if its folder[^.]*missing or incomplete/i
        : /de nuevo solo si su carpeta[^.]*falta o está incompleta/i);
    });
  }
});

test('both landing dictionaries identify the illustration and the notarized app', async (t) => {
  for (const lang of ['en', 'es']) {
    const copy = await json(join(root, `projects/speak-away/i18n/page.${lang}.json`));
    await t.test(`${lang}: demo caption identifies the illustration`, () => {
      assert.match(copy['demo.caption'], lang === 'en' ? /illustration/i : /ilustración/i);
    });
    await t.test(`${lang}: hero identifies the app as notarized`, () => {
      assert.match(copy['hero.requirements'], lang === 'en' ? /notarized app/i : /app (?:firmada y )?notarizada/i);
    });
  }
});

test('landing has ordered sections, seven FAQs, real captures and readable localized demo data', async (t) => {
  const { out } = await built(t);
  for (const lang of ['en', 'es']) {
    const html = await read(pageFile(out, lang === 'en' ? '/speak-away/' : '/es/speak-away/'));
    const sections = [...html.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(sections, ['hero', 'how', 'meetings', 'yours', 'streaks', 'privacy', 'source', 'faq']);
    assert.equal((html.match(/<details>/g) || []).length, 7);
    for (const asset of ['reuniones-light-1000', 'reuniones-light-2000', 'atajos-light-1000', 'atajos-light-2000', 'racha-claro', 'racha-oscuro']) assert.ok(html.includes(asset), asset);
    const raw = html.match(/<script type="application\/json" id="demo-data">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(raw, 'localized JSON demo data');
    const demo = JSON.parse(raw);
    assert.equal(demo.samples.length, 3);
    assert.deepEqual(Object.keys(demo.hud).sort(), ['listening', 'pasted', 'whisper']);
    assert.equal(demo.hud.listening, lang === 'en' ? 'LISTENING' : 'ESCUCHANDO');
    assert.equal(demo.hud.whisper, 'WHISPER');
    assert.equal(demo.hud.pasted, lang === 'en' ? 'PASTED' : 'PEGADO');
    assert.ok(demo.speaker);
    assert.match(html, /id="demo-text"[^>]*>[^<]+<\/p>/, 'no-JS demo sample');
    assert.ok(html.includes('releases/latest/download/SpeakAway.dmg'));
    assert.ok(html.includes('macOS 26'));
  }
});

test('privacy has all required sections and dates formatted from project data at build time', async (t) => {
  const root = await fixture(t);
  const file = join(root, 'projects/speak-away/project.json');
  const project = await json(file);
  const outDir = join(root, 'dist');
  for (const [date, en, es] of [
    [project.privacyUpdated, '17 November 2026', '17 de noviembre de 2026'],
    ['2027-01-02', '2 January 2027', '2 de enero de 2027'],
  ]) {
    await writeFile(file, JSON.stringify({ ...project, privacyUpdated: date }));
    await build({ root, outDir });
    for (const [path, label, title] of [['/speak-away/privacy/', en, 'Privacy'], ['/es/speak-away/privacidad/', es, 'Privacidad']]) {
      const html = await read(pageFile(outDir, path));
      assert.ok(html.includes(`<h1>${title}</h1>`));
      assert.ok(html.includes(`<time datetime="${date}">${label}</time>`), `${path}: derived date`);
      for (const id of ['summary', 'stored', 'network', 'permissions', 'clipboard', 'iphone', 'control', 'children', 'changes', 'contact']) assert.ok(html.includes(`id="${id}"`), id);
      assert.match(html, /href="https:\/\/github.com\/martinfurbano-ai\/speak-away\/issues"/);
      assert.match(html, /App Group/);
    }
  }
  await writeFile(file, JSON.stringify({ ...project, privacyUpdated: '2026-02-30' }));
  await assert.rejects(build({ root, outDir }), /project.json.*privacyUpdated/);
});

test('round 5 privacy disclosures describe permissions, retained data and iPhone sessions', async (t) => {
  const { out } = await built(t);
  for (const [lang, path] of [['en', '/speak-away/privacy/'], ['es', '/es/speak-away/privacidad/']]) {
    const html = await read(pageFile(out, path));
    const en = lang === 'en';
    const section = (id) => {
      const content = html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1];
      assert.ok(content, `${lang}: missing ${id} section`);
      return content;
    };
    const paragraph = (id, pattern) => {
      const content = [...section(id).matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]).find((text) => pattern.test(text));
      assert.ok(content, `${lang}: missing ${id} paragraph ${pattern}`);
      return content;
    };
    const permission = (label) => {
      const content = section('permissions').match(new RegExp(`<dt>${label}</dt><dd>([\\s\\S]*?)</dd>`))?.[1];
      assert.ok(content, `${lang}: missing ${label} permission`);
      return content;
    };
    const network = section('network');
    const audio = permission(en ? 'System Audio Recording' : 'Grabación de audio del sistema');
    const globe = paragraph('permissions', /Globe|globo/);
    const notes = paragraph('stored', /Meetings/);
    const detect = paragraph('stored', /five seconds|cinco segundos/);
    const iphone = section('iphone');
    for (const [name, content, pattern] of [
      ['default model downloads at launch', network, en ? /when you first open the app/ : /cuando abres la app por primera vez/],
      ['other model downloads when picked', network, en ? /the other one the first time you pick it/ : /el otro la primera vez que lo eliges/],
      ['network requests include tokenizer files', network, en ? /only network requests go to Hugging Face[^.]*small tokenizer files/ : /únicas solicitudes de red de la app para Mac van a Hugging Face[^.]*archivos del tokenizador/],
      ['audio falls back to screen capture', audio, en ? /screen capture/i : /captura de pantalla/i],
      ['screen capture discards video', audio, en ? /discards the video frames/i : /descarta los fotogramas/i],
      ['Globe setting prevents emoji picker', globe, en ? /emoji picker/ : /selector de emojis/],
      ['Globe setting survives unexpected close', globe, en ? /closes unexpectedly/ : /de forma inesperada/],
      ['Globe setting recovery path', globe, en ? /System Settings › Keyboard/ : /Ajustes del Sistema › Teclado/],
      ['failed or interrupted save keeps journal', notes, en ? /stays in that folder until your next meeting replaces it/ : /se queda en esa carpeta hasta que tu próxima reunión lo reemplace/],
      ['meeting detection runs while open', detect, en ? /While the app is open/ : /Mientras la app está abierta/],
      ['microphone app identification requires 14.2', detect, en ? /whether the microphone is in use and, on macOS 14\.2 or later, which apps are using it/ : /si el micrófono está en uso y, en macOS 14\.2 o posterior, qué apps lo usan/],
      ['stored.other includes writing styles', paragraph('stored', /plain counters|son contadores/), en ? /voice shortcuts, writing styles/ : /atajos de voz, estilos de escritura/],
      ['control.folder includes writing styles', paragraph('control', /Application Support/), en ? /voice shortcuts, writing styles/ : /atajos de voz, (?:los )?estilos de escritura/],
      ['iPhone background microphone session', iphone, en ? /microphone running in the background/ : /micrófono en marcha en segundo plano/],
      ['iPhone discards sound outside dictation', iphone, en ? /drops every sound/ : /descarta todo sonido/],
      ['Command Mode falls back to last sentence', iphone, en ? /last sentence before your cursor/ : /última frase antes del cursor/],
    ]) {
      await t.test(`${lang}: ${name}`, () => assert.match(content, pattern));
    }
    await t.test(`${lang}: Accessibility explains pasting, Fn suppression and Command Mode copying without emoji claims`, () => {
      const access = permission(en ? 'Accessibility' : 'Accesibilidad');
      const patterns = en
        ? [/paste text where your cursor is/, /Fn key from reaching other apps/, /Command Mode/, /copy shortcut/]
        : [/pegar el texto donde está tu cursor/, /tecla Fn no llegue a otras apps/, /Modo Comando/, /atajo de copiar/];
      for (const pattern of patterns) assert.match(access, pattern);
      assert.doesNotMatch(access, /emoji/i);
    });
    await t.test(`${lang}: meeting detection does not claim unconditional process identification`, () => {
      assert.doesNotMatch(detect, en ? /and which processes are using the microphone/ : /y qué procesos usan el micrófono/);
    });
  }
});
