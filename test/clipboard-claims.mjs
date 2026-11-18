import assert from 'node:assert/strict';

export function assertClipboard(text, lang) {
  const required = lang === 'en'
    ? [/tries to put back what you had copied/, /unless you copied something else in between/, /Speak Away cannot paste for you/]
    : [/intenta devolver lo que tenías copiado/, /salvo que hayas copiado otra cosa entre tanto/, /no puede pegar por ti/];
  const forbidden = lang === 'en'
    ? [/\d+(?:\.\d+)?\s*seconds?/i, /stays on the clipboard/i, /nothing is restored/i, /paste it yourself/i, /\brestores what you had copied/]
    : [/\d+(?:,\d+)?\s*segundos?/i, /se queda en el portapapeles/i, /no se restaura nada/i, /lo pegas tú/i, /restaura lo que tenías copiado/];
  for (const pattern of required) assert.match(text, pattern);
  for (const pattern of forbidden) assert.doesNotMatch(text, pattern);
}
