import { within, readJson } from './files.mjs';

export function mergeDictionaries(dictionaries) {
  return dictionaries.reduce((merged, dictionary) => ({ ...merged, ...dictionary }), {});
}
export function loadI18n(root, stems, lang) {
  const dictionaries = ['src/i18n/common', ...stems].map((stem) => {
    const file = `${stem}.${lang}.json`;
    const dictionary = readJson(within(root, file));
    for (const [key, value] of Object.entries(dictionary)) {
      if (typeof value !== 'string') throw new Error(`${file}: ${key} must be a string`);
    }
    return dictionary;
  });
  return mergeDictionaries(dictionaries);
}
