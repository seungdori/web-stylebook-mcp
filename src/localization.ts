import type { Lang, LocalizedText } from './types.js';
import { DEFAULT_LANG } from './types.js';

/** Materialize a single locale at the presentation/protocol boundary. Falls back to en. */
export function text(value: LocalizedText, lang: Lang = DEFAULT_LANG): string {
  return value[lang] || value.en;
}

/** Materialize an array of LocalizedText. */
export function texts(values: LocalizedText[], lang: Lang = DEFAULT_LANG): string[] {
  return values.map((v) => text(v, lang));
}
