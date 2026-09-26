import { english } from "./english";
import { englishExpert } from "./english-expert";
import type { LanguagePack } from "./types";

/**
 * Language registry. To add a language: create a pack file exporting a
 * LanguagePack and register it here. Everything else (generator, validation,
 * settings UI) picks it up automatically.
 */
export const LANGUAGES: Record<string, LanguagePack> = {
  english,
  english_expert: englishExpert,
};

export function getLanguage(id: string): LanguagePack {
  return LANGUAGES[id] ?? english;
}

export const LANGUAGE_IDS = Object.keys(LANGUAGES);

export type { LanguagePack };
