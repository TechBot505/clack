/**
 * A deliberately tiny syntax highlighter. It returns one token-class
 * character per source character, so the typing surface can color each
 * letter span without a heavyweight tokenizer.
 *
 *   k keyword · s string · n number · c comment · p punctuation
 *   f function/call · t type · a attribute · . plain
 */

const KEYWORDS: Record<string, string[]> = {
  javascript: "const let var function return if else for while of in new class extends async await throw try catch finally import export from default typeof instanceof null undefined true false this".split(" "),
  typescript: "const let var function return if else for while of in new class extends async await throw try catch finally import export from default typeof instanceof null undefined true false this type interface implements readonly as keyof string number boolean void unknown never".split(" "),
  python: "def return if elif else for while in not and or import from as class with lambda yield try except finally raise None True False self pass print int str list dict".split(" "),
  java: "public private protected class interface static final void return if else for while new throw throws try catch import extends implements this null true false int long double boolean".split(" "),
  cpp: "int auto const return if else for while struct class public private static void new delete namespace using template typename true false nullptr std".split(" "),
  go: "func package import return if else for range go chan select defer var const type struct map interface nil true false".split(" "),
  rust: "fn let mut pub struct impl enum match if else for while loop return use mod self Self Some None Ok Err true false as ref where trait".split(" "),
  sql: "SELECT FROM WHERE JOIN ON GROUP BY ORDER DESC ASC LIMIT AS AND OR NOT NULL INSERT INTO VALUES UPDATE SET DELETE MAX MIN AVG COUNT OVER ROWS PRECEDING".split(" "),
  css: "display grid flex none auto repeat minmax clamp var calc".split(" "),
  html: [],
};

export function highlight(code: string, language: string): string {
  const out = new Array<string>(code.length).fill(".");
  const mark = (from: number, to: number, cls: string) => {
    for (let i = from; i < to && i < out.length; i++) out[i] = cls;
  };

  if (language === "html") {
    const tagRe = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(code))) {
      mark(m.index, m.index + m[0].length, "p");
      const nameStart = m.index + (m[0][1] === "/" ? 2 : 1);
      mark(nameStart, nameStart + m[1].length, "k");
      const attrsStart = nameStart + m[1].length;
      const attrRe = /([a-zA-Z-]+)(=)("[^"]*")?/g;
      let a: RegExpExecArray | null;
      while ((a = attrRe.exec(m[2]))) {
        const s = attrsStart + a.index;
        mark(s, s + a[1].length, "a");
        if (a[3]) mark(s + a[1].length + 1, s + a[0].length, "s");
      }
    }
    return out.join("");
  }

  const keywords = new Set(KEYWORDS[language] ?? KEYWORDS.javascript);
  const commentLine = language === "python" ? "#" : language === "sql" ? "--" : "//";
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    // comments
    if (code.startsWith(commentLine, i) && !(language === "rust" && code[i + 1] === "[")) {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      mark(i, stop, "c");
      i = stop;
      continue;
    }
    // strings
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      // Rust lifetimes / char-like quotes in type position stay plain if unterminated
      if (code[j] === ch) {
        mark(i, j + 1, "s");
        i = j + 1;
        continue;
      }
    }
    // numbers
    if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(code[i - 1] ?? "")) {
      let j = i;
      while (j < code.length && /[0-9._a-fA-Fx]/.test(code[j])) j++;
      mark(i, j, "n");
      i = j;
      continue;
    }
    // identifiers
    if (/[A-Za-z_$@#]/.test(ch)) {
      let j = i;
      while (j < code.length && /[A-Za-z0-9_$-]/.test(code[j]) && !(language !== "css" && code[j] === "-")) j++;
      if (j === i) j = i + 1;
      const word = code.slice(i, j);
      const bare = word.replace(/^[@#]/, "");
      if (keywords.has(word) || keywords.has(bare) || (language === "sql" && keywords.has(word.toUpperCase()))) {
        mark(i, j, "k");
      } else if (code[j] === "(" || (language === "css" && code[j] === ":")) {
        mark(i, j, language === "css" ? "a" : "f");
      } else if (/^[A-Z]/.test(word) && language !== "sql") {
        mark(i, j, "t");
      }
      i = j;
      continue;
    }
    if (/[{}()[\];,.:<>=+\-*/%!&|?^~]/.test(ch)) out[i] = "p";
    i++;
  }
  return out.join("");
}
