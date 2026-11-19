import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { built, read, json, pageFile, root } from './helpers.mjs';

const paragraphKeys = ['iphone.text', 'iphone.meetings', 'iphone.stored'];
const escaped = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

test('iPhone privacy separates dictation, meeting recording and stored data in both locales', async (t) => {
  const { out } = await built(t);
  for (const lang of ['en', 'es']) {
    const en = lang === 'en';
    const path = en ? '/speak-away/privacy/' : '/es/speak-away/privacidad/';
    const html = await read(pageFile(out, path));
    const section = html.match(/<section\b[^>]*id="iphone"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(section, `${lang}: missing iPhone section`);
    const paragraphs = [...section.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
    const copy = await json(join(root, `projects/speak-away/i18n/privacy.${lang}.json`));
    await t.test(`${lang}: all three iPhone paragraphs render in the specified order`, () => {
      for (const key of paragraphKeys) assert.equal(typeof copy[key], 'string', key);
      assert.deepEqual(paragraphs, paragraphKeys.map((key) => escaped(copy[key])));
    });
    const checks = [
      [0, 'background microphone', en ? /microphone running in the background/ : /micrófono en marcha en segundo plano/],
      [0, 'discarding is between dictations', en ? /Between dictations/ : /Entre un dictado y otro/],
      [0, 'sound is discarded', en ? /drops every sound/ : /descarta todo sonido/],
      [0, 'dictated text uses a second file', en ? /second file/ : /segundo archivo/],
      [0, 'dictated text is replaced a few seconds later', en ? /replaces it a few seconds later/ : /lo reemplaza unos segundos después/],
      [0, 'closed app retains dictated text until reopened', en ? /\(if the app is closed at that moment, the text stays there until you open the app again\)/ : /\(si la app se cierra en ese momento, el texto se queda ahí hasta que vuelvas a abrirla\)/],
      [0, 'Undo compares text only in memory', en ? /To keep Undo working, the keyboard also compares the text before your cursor with what it inserted last, only in memory\./ : /Para que deshacer siga funcionando, el teclado también compara el texto anterior al cursor con lo último que insertó, solo en memoria\./],
      [0, 'Command Mode falls back to the last sentence', en ? /last sentence before your cursor/ : /última frase antes del cursor/],
      [0, 'request replacement is current', en ? /replaces that file\./ : /reemplaza ese archivo\./],
      [1, 'manual recording button', en ? /Record meeting/ : /Grabar reunión/],
      [1, 'no automatic meeting detection', en ? /does not detect meetings by itself/ : /no detecta reuniones por sí sola/],
      [1, 'audio is never stored', en ? /Audio is never written to storage/ : /El audio nunca se escribe en el almacenamiento/],
      [1, 'temporary live journal', en ? /live journal/ : /registro temporal de la transcripción en vivo/],
      [1, 'closed app caveat applies during a meeting', en ? /closed in the middle of a meeting/ : /se cierra en medio de una reunión/],
      [1, 'interrupted meeting is recovered as a saved note', en ? /turns what is left into a saved note/ : /convierte lo que quedó en una nota guardada/],
      [1, 'meeting recording listens continuously', en ? /While a meeting records, the app listens the whole time and keeps only the words\./ : /Mientras se graba una reunión, la app escucha todo el tiempo y conserva solo las palabras\./],
      [1, 'meeting ends the running dictation session', en ? /Starting a meeting ends any running dictation session/ : /Al iniciar una reunión termina cualquier sesión de dictado en marcha/],
      [1, 'dictation needs a new session after a meeting', en ? /you start a new session/ : /vuelvas a iniciar una sesión/],
      [1, 'summary requires opt-in, Apple Intelligence and enough speech', en ? /It needs the “Brain” setting on \(it is off by default\), Apple Intelligence and enough spoken words\./ : /Necesita el ajuste “Cerebro” activado \(viene desactivado\), Apple Intelligence y que se haya dicho lo suficiente\./],
      [1, 'summary button can retry later', en ? /a button can write it later if that did not happen/ : /un botón puede escribirlo después si eso no ocurrió/],
      [1, 'speech recognition failure stops and saves the meeting', en ? /stops the meeting and saves what it heard/ : /detiene la reunión y guarda lo que oyó/],
      [1, 'copy button produces a prompt', en ? /as a ready to paste prompt/ : /mensaje listo para pegar/],
      [1, 'clipboard can reach other Apple devices', en ? /Universal Clipboard/ : /Portapapeles universal/],
      [2, 'undecodable shared data files leave a backup', en ? /If a data file such as the history cannot be decoded, the app moves it aside as a copy with a \.bak ending in the same folder and starts a new one\./ : /Si un archivo de datos, como el historial, no se puede decodificar, la app lo aparta como una copia con terminación \.bak en la misma carpeta y empieza uno nuevo\./],
      [2, 'history has a limit', en ? /at most 2,000 entries/ : /hasta 2\.000 entradas/],
      [2, 'no account', en ? /no account/ : /no hay cuenta/],
    ];
    for (const [index, name, pattern] of checks) {
      await t.test(`${lang}: ${name}`, () => assert.match(paragraphs[index] ?? '', pattern));
    }
    for (const [name, pattern] of [
      ['dictation does not wait for a meeting', en ? /dictation waits/ : /el dictado del teclado espera/i],
      ['summary button is not unconditional', en ? /ask for one with a button/ : /pedirlo con un botón/],
      ['clipboard copy is not described as the whole meeting text', en ? /whole meeting text/ : /todo el texto de la reunión/],
    ]) {
      await t.test(`${lang}: ${name}`, () => assert.doesNotMatch(section, pattern));
    }
    await t.test(`${lang}: no false exception for dictation`, () => {
      assert.doesNotMatch(section, en ? /unless you are dictating/ : /salvo cuando estás dictando/);
    });
  }
});
