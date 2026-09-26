import { english } from "./english";
import type { LanguagePack } from "./types";

/** English with the long tail mixed in: common words plus the difficult list. */
export const englishExpert: LanguagePack = {
  id: "english_expert",
  name: "English (expert)",
  words: [...english.words.slice(150), ...english.difficult],
  difficult: english.difficult,
};
