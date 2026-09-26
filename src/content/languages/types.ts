export interface LanguagePack {
  id: string;
  name: string;
  /** frequency-ordered common words */
  words: string[];
  /** long / tricky words for "difficult" content */
  difficult: string[];
  /** right-to-left script */
  rtl?: boolean;
}
