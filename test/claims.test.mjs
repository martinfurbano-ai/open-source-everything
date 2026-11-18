import test from 'node:test';
import assert from 'node:assert/strict';
import { built, read, pageFile } from './helpers.mjs';
import { assertClipboard } from './clipboard-claims.mjs';

const forbidden = [
  /ollama/i, /\bmcp\b/i, /keychain/i,
  /bring your own key|your own key|tu propia llave|llave propia|api key/i,
  /anthropic|openai|groq|openrouter|elevenlabs|deepgram/i,
  /no history|doesn't save a history|no guarda (un )?historial/i,
  /\bplus\b/i, /\$\s?\d/i, /cloud (sync|storage|account)/i,
  /llavero|clave (de )?api|clave propia|tu propia clave/i,
  /sin historial|no (se )?guarda (ningún |el )?historial/i,
  /sincronizaci[oó]n (en |con )?la nube|almacenamiento en la nube|cuenta en la nube/i,
  /nothing is stored|nada se (guarda|almacena)|no se guarda nada/i,
  /audio is deleted|audio se borra|audio se elimina/i,
  /posts? a notice in the meeting chat|avisar en el chat de la reuni[oó]n/i,
  /mac app store/i,
];
const plain = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('fact-check regressions are absent from every localized Speak Away page', async (t) => {
  const { out, pages } = await built(t);
  const paths = pages.filter((page) => page.project === 'speak-away').flatMap((page) => Object.values(page.paths));
  assert.equal(paths.length, 4);
  const signedDmg = /\b(?:signed|notarized|notarizad[oa]|firmad[oa])\s+(?:(?:and|y)\s+)?(?:(?:signed|notarized|notarizad[oa]|firmad[oa])\s+)?\.?dmg\b|\bdmg\s+(?:signed|notarized|notarizad[oa]|firmad[oa])\b/i;
  for (const path of paths) {
    const text = plain(await read(pageFile(out, path)));
    await t.test(`${path}: filler cleanup is separate from Apple processing`, () => {
      const sentences = text.split(/[.!?]+(?:\s|$)/);
      for (const sentence of sentences) {
        if (/filler|muletilla/i.test(sentence)) assert.doesNotMatch(sentence, /Apple/i, sentence);
      }
    });
    await t.test(`${path}: real meeting sections and button labels`, () => {
      assert.doesNotMatch(text, /\bpendientes\b|Resumir de nuevo/i);
    });
    await t.test(`${path}: signing describes the app, not the disk image`, () => {
      assert.doesNotMatch(text, signedDmg);
    });
  }
});

test('Speak Away claims obey section 9 on all four localized output pages', async (t) => {
  const { out, pages } = await built(t);
  const paths = pages.filter((page) => page.project === 'speak-away').flatMap((page) => Object.entries(page.paths));
  assert.equal(paths.length, 4);
  for (const [lang, path] of paths) {
    const html = await read(pageFile(out, path));
    for (const pattern of forbidden) assert.doesNotMatch(html, pattern, `${path}: forbidden ${pattern}`);
    const text = plain(html);
    await t.test(`${path}: copy does not claim switching models downloads them`, () => {
      assert.doesNotMatch(text, lang === 'en'
        ? /\b(?:switch(?:es|ed|ing)?)\s+(?:the\s+)?models?\b/i
        : /\bcambi(?:as|ar|ando|o|a)\s+de\s+modelo\b/i);
    });
    await t.test(`${path}: summary section count is an upper limit`, () => {
      assert.doesNotMatch(text, lang === 'en' ? /(?<!up to )four sections/i : /(?<!hasta )cuatro secciones/i);
    });
    assert.match(text, /2[,.\s]000/, `${path}: history limit`);
    assert.match(text, /Hugging Face/, `${path}: model download disclosure`);
    assert.ok(text.includes('~/Library/Application Support/Speak Away/Meetings'), `${path}: meeting folder`);
    assert.match(text, /632 MB/, `${path}: precise model`);
    assert.match(text, /216 MB/, `${path}: fast model`);
    await t.test(`${path}: model sizes are approximate`, () => {
      const modelSection = html.match(/<section\b[^>]*id="(?:how|network)"[^>]*>([\s\S]*?)<\/section>/)?.[1];
      assert.ok(modelSection, `${path}: missing model download section`);
      const modelText = plain(modelSection);
      assert.match(modelText, lang === 'en' ? /about\s+632\s+MB/ : /unos\s+632\s+MB/);
      if (lang === 'es') assert.match(modelText, /unos\s+216\s+MB/);
    });
    const privacyIphone = path.includes('/privacy/') || path.includes('/privacidad/');
    for (const id of privacyIphone ? ['stored'] : ['streaks', 'faq']) {
      await t.test(`${path}: ${id} section states the history limit`, () => {
        const section = html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1];
        assert.ok(section, `${path}: missing ${id} section`);
        assert.match(plain(section), lang === 'en' ? /2,000 entries/ : /2\.000 entradas/);
      });
    }
    const adjacencyHtml = privacyIphone
      ? html.replace(/(<section\b[^>]*id="iphone"[^>]*>)([\s\S]*?)(<\/section>)/,
        (_, open, content, close) => open + content.replace(/<p>[\s\S]*?<\/p>/g, '') + close)
      : html;
    const adjacencyText = plain(adjacencyHtml);
    if (privacyIphone) {
      await t.test(`${path}: iPhone section states future availability`, () => {
        const section = html.match(/<section\b[^>]*id="iphone"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(section, `${path}: missing iPhone section`);
        const heading = section.match(/<h2>([\s\S]*?)<\/h2>/)?.[1];
        const firstParagraph = section.match(/<p>([\s\S]*?)<\/p>/)?.[1];
        assert.match(heading, lang === 'en' ? /coming soon/i : /próximamente/i);
        assert.match(firstParagraph, lang === 'en'
          ? /^The app and keyboard are not released yet\./
          : /^La app y el teclado todavía no se han publicado\./);
      });
    }
    const mentions = [...adjacencyText.matchAll(/iPhone/gi)];
    assert.ok(mentions.length, `${path}: future availability`);
    for (const mention of mentions) {
      const adjacent = adjacencyText.slice(mention.index + 6, mention.index + 140);
      assert.match(adjacent, lang === 'en' ? /^(?:; the next request replaces that file)?[^.!?]{0,35}coming soon/i : /^(?:; la siguiente solicitud reemplaza ese archivo)?[^.!?]{0,35}próximamente/i, `${path}: every iPhone mention needs adjacent future status`);
    }
    const meetingSection = html.match(/<section\b[^>]*id="meetings"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    if (meetingSection) {
      assert.doesNotMatch(meetingSection, /coming soon|próximamente/i);
      await t.test(`${path}: meetings summary has up to four sections`, () => {
        assert.match(plain(meetingSection), lang === 'en' ? /up to four sections/i : /hasta cuatro secciones/i);
      });
      await t.test(`${path}: meetings summary omits empty sections`, () => {
        assert.match(plain(meetingSection), lang === 'en' ? /left out/i : /se omite/i);
      });
    }
  }
});

test('localized landing how sections disclose the clipboard caveat', async (t) => {
  const { out } = await built(t);
  for (const [lang, path] of [['en', '/speak-away/'], ['es', '/es/speak-away/']]) {
    const html = await read(pageFile(out, path));
    await t.test(`${lang}: how section discloses restore and paste limits shared by both builds`, () => {
      const how = html.match(/<section\b[^>]*id="how"[^>]*>([\s\S]*?)<\/section>/)?.[1];
      assert.ok(how, `${lang}: missing how section`);
      const text = plain(how);
      assert.match(text, lang === 'en' ? /Without Accessibility/ : /Sin Accesibilidad/);
      assertClipboard(text, lang);
    });
  }
});

test('round 5 landing copy and all localized pages follow the corrected facts', async (t) => {
  const { out, pages } = await built(t);
  for (const page of pages.filter((page) => page.project === 'speak-away')) {
    for (const [lang, path] of Object.entries(page.paths)) {
      const html = await read(pageFile(out, path));
      const text = plain(html);
      const en = lang === 'en';
      for (const [name, pattern] of [
        ['Fn finish gesture', en ? /start and stop/i : /empezar y parar/i],
        ['download does not wait for first use', en ? /first time you use (?:it|a model)/i : /la primera vez que lo usas/i],
        ['network requests are plural', en ? /only network request\b/i : /única solicitud de red/i],
        ['screen permission is not named by OS version', /Screen (?:&|&amp;) System Audio Recording/],
      ]) {
        await t.test(`${path}: ${name}`, () => assert.doesNotMatch(text, pattern));
      }
      if (page.id !== 'speak-away') continue;
      const section = (id) => {
        const content = html.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1];
        assert.ok(content, `${lang}: missing ${id} section`);
        return plain(content);
      };
      const how = section('how');
      const offline = html.match(/<p class="product-note">([^<]*Hugging Face[^<]*)<\/p>/)?.[1];
      assert.ok(offline, `${lang}: missing offline paragraph`);
      for (const [name, content, pattern] of [
        ['hands-free dictation', how, en ? /hands-free/ : /sin manos/],
        ['single tap finishes dictation', how, en ? /tap once/ : /una vez/],
        ['default model downloads at launch', offline, en ? /when you first open the app/ : /cuando abres la app por primera vez/],
        ['other model downloads when picked', offline, en ? /the other one the first time you pick it/ : /el otro la primera vez que lo eliges/],
        ['repeat downloads require missing files', offline, en ? /again only if its folder[^.]*missing or incomplete/i : /de nuevo solo si su carpeta[^.]*falta o está incompleta/i],
        ['offline disclosure includes tokenizer requests', offline, en ? /only network requests go to Hugging Face[^.]*small tokenizer files/ : /únicas solicitudes de red de la app para Mac van a Hugging Face[^.]*archivos del tokenizador/],
        ['source requires Xcode 26', section('source'), /Xcode 26/],
      ]) {
        await t.test(`${lang}: ${name}`, () => assert.match(content, pattern));
      }
      const answers = [...html.matchAll(/<details><summary>[^<]*<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((match) => plain(match[1]));
      for (const number of [4, 7]) {
        await t.test(`${lang}: faq.a${number} includes writing styles after voice shortcuts`, () => {
          assert.match(answers[number - 1], en ? /voice shortcuts, writing styles/ : /atajos de voz, (?:los )?estilos de escritura/);
        });
      }
    }
  }
});
