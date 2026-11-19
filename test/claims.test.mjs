import test from 'node:test';
import assert from 'node:assert/strict';
import { built, read, pageFile, htmlFiles } from './helpers.mjs';
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
    if (privacyIphone) {
      await t.test(`${path}: iPhone section states App Store availability`, () => {
        const section = html.match(/<section\b[^>]*id="iphone"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(section, `${path}: missing iPhone section`);
        const heading = section.match(/<h2>([\s\S]*?)<\/h2>/)?.[1];
        const firstParagraph = section.match(/<p>([\s\S]*?)<\/p>/)?.[1];
        assert.equal(heading, lang === 'en' ? 'iPhone: app and keyboard' : 'iPhone: app y teclado');
        assert.match(firstParagraph, lang === 'en'
          ? /^The iPhone app and keyboard are available on the App Store\./
          : /^La app y el teclado para iPhone están disponibles en el App Store\./);
      });
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

test('every built page avoids unreleased iPhone claims', async (t) => {
  const { out } = await built(t);
  for (const file of await htmlFiles(out)) {
    await t.test(file.slice(out.length), async () => {
      const html = await read(file);
      const blocks = [...html.matchAll(/<(h[1-6]|p|summary|span|dt|dd|li|a)\b[^>]*>([\s\S]*?)<\/\1>/g)];
      for (const [, , content] of blocks) {
        const text = plain(content);
        if (/iPhone/i.test(text)) {
          assert.doesNotMatch(text, /coming soon|próximamente|not released yet|todavía no se han publicado/i);
        }
      }
    });
  }
});

test('both locales offer the released iPhone app from the hero and hub card', async (t) => {
  const { out } = await built(t);
  const appStore = 'https://apps.apple.com/app/id6829756587';
  for (const lang of ['en', 'es']) {
    const en = lang === 'en';
    const prefix = en ? '/' : '/es/';
    const page = await read(pageFile(out, `${prefix}speak-away/`));
    const hub = await read(pageFile(out, prefix));
    const hero = page.match(/<section\b[^>]*id="hero"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    const card = hub.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1];
    for (const [name, content] of [['hero', hero], ['hub card', card]]) {
      await t.test(`${lang}: ${name} links to the App Store`, () => {
        assert.ok(content, `${lang}: missing ${name}`);
        const link = [...content.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
          .find((match) => match[1] === appStore);
        assert.ok(link, `${lang}: missing exact App Store link in ${name}`);
        assert.equal(plain(link[2]).trim(), en ? 'Get it for iPhone' : 'Consíguelo para iPhone');
      });
    }
    await t.test(`${lang}: hub card states availability`, () => {
      assert.ok(card);
      assert.ok(plain(card).includes(en ? 'iPhone: on the App Store' : 'iPhone: en el App Store'));
    });
    await t.test(`${lang}: FAQ describes the released app and its requirements`, () => {
      const faq = [...page.matchAll(/<details><summary>([^<]*)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)][5];
      assert.ok(faq);
      assert.equal(faq[1], en ? 'Does it work on iPhone?' : '¿Funciona en iPhone?');
      const answer = plain(faq[2]);
      for (const pattern of en
        ? [/^Yes\./, /App Store/, /app with a voice keyboard/, /free/, /no account/, /iOS 26 or later/, /not available in the European Union or mainland China/]
        : [/^Sí\./, /App Store/, /app con un teclado de voz/, /gratis/, /sin cuenta/, /iOS 26 o posterior/, /no está disponible en la Unión Europea ni en China continental/i]) {
        assert.match(answer, pattern);
      }
    });
  }
});
