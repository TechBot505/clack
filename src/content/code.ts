/**
 * Original code snippets for Code mode. Rules that keep them typeable:
 * - indentation uses spaces (auto-typed on Enter, like an editor)
 * - no blank lines, no trailing spaces, no double spaces inside a line
 */

export interface CodeSnippet {
  id: string;
  language: CodeLanguage;
  title: string;
  code: string;
}

export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "go"
  | "rust"
  | "sql"
  | "html"
  | "css";

export const CODE_LANGUAGES: { id: CodeLanguage; name: string }[] = [
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "python", name: "Python" },
  { id: "java", name: "Java" },
  { id: "cpp", name: "C++" },
  { id: "go", name: "Go" },
  { id: "rust", name: "Rust" },
  { id: "sql", name: "SQL" },
  { id: "html", name: "HTML" },
  { id: "css", name: "CSS" },
];

export const SNIPPETS: CodeSnippet[] = [
  {
    id: "js-debounce",
    language: "javascript",
    title: "debounce",
    code: `function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}`,
  },
  {
    id: "js-group",
    language: "javascript",
    title: "groupBy",
    code: `const groupBy = (items, key) =>
  items.reduce((acc, item) => {
    const k = item[key];
    (acc[k] ||= []).push(item);
    return acc;
  }, {});`,
  },
  {
    id: "js-fetch",
    language: "javascript",
    title: "retrying fetch",
    code: `async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
  }
  throw new Error("request failed: " + url);
}`,
  },
  {
    id: "ts-result",
    language: "typescript",
    title: "Result type",
    code: `type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
function parseAge(input: string): Result<number> {
  const n = Number(input);
  if (Number.isNaN(n)) return { ok: false, error: new Error("nan") };
  return { ok: true, value: n };
}`,
  },
  {
    id: "ts-store",
    language: "typescript",
    title: "tiny store",
    code: `export function createStore<S>(initial: S) {
  let state = initial;
  const subs = new Set<(s: S) => void>();
  return {
    get: () => state,
    set(next: Partial<S>) {
      state = { ...state, ...next };
      subs.forEach((fn) => fn(state));
    },
    subscribe: (fn: (s: S) => void) => subs.add(fn),
  };
}`,
  },
  {
    id: "py-fib",
    language: "python",
    title: "memoized fibonacci",
    code: `from functools import lru_cache
@lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
print([fib(i) for i in range(10)])`,
  },
  {
    id: "py-words",
    language: "python",
    title: "word frequency",
    code: `from collections import Counter
def top_words(text, n=5):
    words = [w.strip(".,!?").lower() for w in text.split()]
    counts = Counter(w for w in words if w)
    return counts.most_common(n)`,
  },
  {
    id: "py-class",
    language: "python",
    title: "dataclass",
    code: `from dataclasses import dataclass, field
@dataclass
class Session:
    user: str
    scores: list[int] = field(default_factory=list)
    def best(self) -> int:
        return max(self.scores, default=0)`,
  },
  {
    id: "java-stack",
    language: "java",
    title: "generic stack",
    code: `public class Stack<T> {
    private final ArrayList<T> items = new ArrayList<>();
    public void push(T item) {
        items.add(item);
    }
    public T pop() {
        if (items.isEmpty()) throw new IllegalStateException();
        return items.remove(items.size() - 1);
    }
}`,
  },
  {
    id: "java-stream",
    language: "java",
    title: "streams",
    code: `List<String> names = users.stream()
    .filter(u -> u.isActive())
    .map(User::getName)
    .sorted()
    .collect(Collectors.toList());`,
  },
  {
    id: "cpp-binary",
    language: "cpp",
    title: "binary search",
    code: `int binarySearch(const std::vector<int>& v, int target) {
    int lo = 0, hi = static_cast<int>(v.size()) - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (v[mid] == target) return mid;
        if (v[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`,
  },
  {
    id: "cpp-raii",
    language: "cpp",
    title: "RAII timer",
    code: `struct Timer {
    std::chrono::steady_clock::time_point start;
    Timer() : start(std::chrono::steady_clock::now()) {}
    ~Timer() {
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start);
        std::cout << ms.count() << "ms\\n";
    }
};`,
  },
  {
    id: "go-worker",
    language: "go",
    title: "worker pool",
    code: `func worker(id int, jobs <-chan int, results chan<- int) {
	for j := range jobs {
		results <- j * 2
	}
}`,
  },
  {
    id: "go-handler",
    language: "go",
    title: "http handler",
    code: `func health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}`,
  },
  {
    id: "rust-option",
    language: "rust",
    title: "option chain",
    code: `fn first_even(nums: &[i32]) -> Option<i32> {
    nums.iter().copied().find(|n| n % 2 == 0)
}
fn main() {
    let v = vec![3, 7, 8, 11];
    match first_even(&v) {
        Some(n) => println!("found {}", n),
        None => println!("none"),
    }
}`,
  },
  {
    id: "rust-struct",
    language: "rust",
    title: "impl block",
    code: `#[derive(Debug, Clone)]
struct Point {
    x: f64,
    y: f64,
}
impl Point {
    fn dist(&self, o: &Point) -> f64 {
        ((self.x - o.x).powi(2) + (self.y - o.y).powi(2)).sqrt()
    }
}`,
  },
  {
    id: "sql-top",
    language: "sql",
    title: "top typists",
    code: `SELECT u.username, MAX(t.wpm) AS best
FROM users u
JOIN tests t ON t.user_id = u.id
WHERE t.accuracy >= 95
GROUP BY u.username
ORDER BY best DESC
LIMIT 10;`,
  },
  {
    id: "sql-window",
    language: "sql",
    title: "rolling average",
    code: `SELECT created_at, wpm,
  AVG(wpm) OVER (ORDER BY created_at ROWS 9 PRECEDING) AS avg10
FROM tests
WHERE user_id = $1;`,
  },
  {
    id: "html-card",
    language: "html",
    title: "semantic card",
    code: `<article class="card">
  <header>
    <h2>Keyboard log</h2>
    <time datetime="2026-01-01">Jan 1</time>
  </header>
  <p>Typed 1,204 words today.</p>
  <a href="/stats">See stats</a>
</article>`,
  },
  {
    id: "css-grid",
    language: "css",
    title: "grid layout",
    code: `.layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}
.layout > * {
  min-width: 0;
}`,
  },
  {
    id: "css-caret",
    language: "css",
    title: "blinking caret",
    code: `@keyframes blink {
  50% { opacity: 0; }
}
.caret {
  width: 2px;
  background: currentColor;
  animation: blink 1s steps(1) infinite;
}`,
  },
];

// Go uses tabs by convention; normalize every snippet to spaces.
for (const s of SNIPPETS) s.code = s.code.replace(/\t/g, "    ");

const BY_ID = new Map(SNIPPETS.map((s) => [s.id, s]));

export function getSnippet(id: string): CodeSnippet | undefined {
  return BY_ID.get(id);
}

export function snippetsFor(language: string): CodeSnippet[] {
  if (language === "any") return SNIPPETS;
  return SNIPPETS.filter((s) => s.language === language);
}
