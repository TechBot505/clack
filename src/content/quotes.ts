/**
 * Quotes: public-domain sources only (pre-1929 works, government speeches,
 * classical authors) plus a few clack. originals. Punctuation is normalized to
 * plain ASCII so every character is typeable on a standard keyboard.
 */

export type QuoteGroup = "books" | "philosophy" | "technology" | "speeches";
export type QuoteLength = "short" | "medium" | "long";

export interface Quote {
  id: string;
  text: string;
  source: string;
  author: string;
  group: QuoteGroup;
}

const RAW: Array<Omit<Quote, "id"> & { id: string }> = [
  // ── books ────────────────────────────────────────────────────────────────
  { id: "b01", group: "books", author: "Jane Austen", source: "Pride and Prejudice (1813)", text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife." },
  { id: "b02", group: "books", author: "Charles Dickens", source: "A Tale of Two Cities (1859)", text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair." },
  { id: "b03", group: "books", author: "Herman Melville", source: "Moby-Dick (1851)", text: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world." },
  { id: "b04", group: "books", author: "Leo Tolstoy", source: "Anna Karenina (1878)", text: "Happy families are all alike; every unhappy family is unhappy in its own way." },
  { id: "b05", group: "books", author: "F. Scott Fitzgerald", source: "The Great Gatsby (1925)", text: "So we beat on, boats against the current, borne back ceaselessly into the past." },
  { id: "b06", group: "books", author: "Lewis Carroll", source: "Through the Looking-Glass (1871)", text: "Why, sometimes I've believed as many as six impossible things before breakfast." },
  { id: "b07", group: "books", author: "Mary Shelley", source: "Frankenstein (1818)", text: "Beware; for I am fearless, and therefore powerful." },
  { id: "b08", group: "books", author: "Henry David Thoreau", source: "Walden (1854)", text: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived." },
  { id: "b09", group: "books", author: "Charlotte Bronte", source: "Jane Eyre (1847)", text: "I am no bird; and no net ensnares me: I am a free human being with an independent will." },
  { id: "b10", group: "books", author: "Oscar Wilde", source: "The Picture of Dorian Gray (1890)", text: "The only way to get rid of a temptation is to yield to it." },
  { id: "b11", group: "books", author: "J. M. Barrie", source: "Peter Pan (1911)", text: "To die will be an awfully big adventure." },
  { id: "b12", group: "books", author: "Louisa May Alcott", source: "Little Women (1868)", text: "I am not afraid of storms, for I am learning how to sail my ship." },
  { id: "b13", group: "books", author: "William Shakespeare", source: "Hamlet", text: "There is nothing either good or bad, but thinking makes it so." },
  { id: "b14", group: "books", author: "William Shakespeare", source: "As You Like It", text: "All the world's a stage, and all the men and women merely players; they have their exits and their entrances, and one man in his time plays many parts." },
  { id: "b15", group: "books", author: "William Shakespeare", source: "Macbeth", text: "Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day, to the last syllable of recorded time." },
  { id: "b16", group: "books", author: "Lewis Carroll", source: "Alice's Adventures in Wonderland (1865)", text: "Begin at the beginning, and go on till you come to the end: then stop." },
  { id: "b17", group: "books", author: "Mark Twain", source: "Following the Equator (1897)", text: "Truth is stranger than fiction, but it is because Fiction is obliged to stick to possibilities; Truth isn't." },
  { id: "b18", group: "books", author: "Jules Verne", source: "Twenty Thousand Leagues Under the Sea (1870)", text: "The sea is everything. It covers seven tenths of the terrestrial globe. Its breath is pure and healthy. It is an immense desert, where man is never lonely, for he feels life stirring on all sides." },

  // ── philosophy ───────────────────────────────────────────────────────────
  { id: "p01", group: "philosophy", author: "Heraclitus", source: "Fragments", text: "No man ever steps in the same river twice, for it is not the same river and he is not the same man." },
  { id: "p02", group: "philosophy", author: "Socrates", source: "Plato, Apology", text: "The unexamined life is not worth living." },
  { id: "p03", group: "philosophy", author: "Lao Tzu", source: "Tao Te Ching", text: "A journey of a thousand miles begins with a single step." },
  { id: "p04", group: "philosophy", author: "Ralph Waldo Emerson", source: "Self-Reliance (1841)", text: "A foolish consistency is the hobgoblin of little minds." },
  { id: "p05", group: "philosophy", author: "Henry David Thoreau", source: "Walden (1854)", text: "The mass of men lead lives of quiet desperation." },
  { id: "p06", group: "philosophy", author: "Will Durant", source: "The Story of Philosophy (1926)", text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit." },
  { id: "p07", group: "philosophy", author: "Epictetus", source: "Discourses", text: "No man is free who is not master of himself." },
  { id: "p08", group: "philosophy", author: "Confucius", source: "Analects", text: "It does not matter how slowly you go as long as you do not stop." },
  { id: "p09", group: "philosophy", author: "Blaise Pascal", source: "Provincial Letters (1657)", text: "I have made this letter longer than usual, only because I have not had the time to make it shorter." },
  { id: "p10", group: "philosophy", author: "Rene Descartes", source: "Discourse on the Method (1637)", text: "I think, therefore I am." },
  { id: "p11", group: "philosophy", author: "Seneca", source: "On the Shortness of Life", text: "It is not that we have a short time to live, but that we waste a lot of it. Life is long enough, and a sufficiently generous amount has been given to us for the highest achievements if it were all well invested." },
  { id: "p12", group: "philosophy", author: "Marcus Aurelius", source: "Meditations", text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking." },
  { id: "p13", group: "philosophy", author: "Friedrich Nietzsche", source: "Twilight of the Idols (1889)", text: "He who has a why to live for can bear almost any how." },
  { id: "p14", group: "philosophy", author: "Aristotle", source: "Nicomachean Ethics", text: "For one swallow does not make a summer, nor does one day; and so too one day, or a short time, does not make a man blessed and happy." },
  { id: "p15", group: "philosophy", author: "Michel de Montaigne", source: "Essays (1580)", text: "My life has been full of terrible misfortunes, most of which never happened." },

  // ── technology ───────────────────────────────────────────────────────────
  { id: "t01", group: "technology", author: "Ada Lovelace", source: "Notes on the Analytical Engine (1843)", text: "The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves." },
  { id: "t02", group: "technology", author: "Charles Babbage", source: "Passages from the Life of a Philosopher (1864)", text: "On two occasions I have been asked, 'Pray, Mr. Babbage, if you put into the machine wrong figures, will the right answers come out?' I am not able rightly to apprehend the kind of confusion of ideas that could provoke such a question." },
  { id: "t03", group: "technology", author: "Lord Kelvin", source: "Lecture on Electrical Units (1883)", text: "When you can measure what you are speaking about, and express it in numbers, you know something about it." },
  { id: "t04", group: "technology", author: "Samuel Morse", source: "First long-distance telegraph (1844)", text: "What hath God wrought?" },
  { id: "t05", group: "technology", author: "Alexander Graham Bell", source: "First telephone call (1876)", text: "Mr. Watson, come here, I want to see you." },
  { id: "t06", group: "technology", author: "Nikola Tesla", source: "Collier's interview (1926)", text: "When wireless is perfectly applied the whole earth will be converted into a huge brain." },
  { id: "t07", group: "technology", author: "Archimedes", source: "attributed", text: "Give me a place to stand, and I will move the earth." },
  { id: "t08", group: "technology", author: "Ada Lovelace", source: "Notes on the Analytical Engine (1843)", text: "The Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform." },
  { id: "t09", group: "technology", author: "clack.", source: "clack. originals", text: "A keyboard is a piano that only plays one song: whatever you were about to think next." },
  { id: "t10", group: "technology", author: "clack.", source: "clack. originals", text: "Every program begins as a sentence someone could not stop thinking about. The compiler only cares whether you spelled it right." },
  { id: "t11", group: "technology", author: "clack.", source: "clack. originals", text: "Latency is a feeling before it is a number. Users forgive slow pages; they never forgive a slow keystroke." },

  // ── speeches ─────────────────────────────────────────────────────────────
  { id: "s01", group: "speeches", author: "Abraham Lincoln", source: "Gettysburg Address (1863)", text: "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal." },
  { id: "s02", group: "speeches", author: "Abraham Lincoln", source: "Gettysburg Address (1863)", text: "Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure." },
  { id: "s03", group: "speeches", author: "Franklin D. Roosevelt", source: "First Inaugural Address (1933)", text: "So, first of all, let me assert my firm belief that the only thing we have to fear is fear itself, nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance." },
  { id: "s04", group: "speeches", author: "John F. Kennedy", source: "Inaugural Address (1961)", text: "And so, my fellow Americans: ask not what your country can do for you, ask what you can do for your country." },
  { id: "s05", group: "speeches", author: "Patrick Henry", source: "Virginia Convention (1775)", text: "I know not what course others may take; but as for me, give me liberty or give me death!" },
  { id: "s06", group: "speeches", author: "Frederick Douglass", source: "What to the Slave Is the Fourth of July? (1852)", text: "What, to the American slave, is your 4th of July? I answer: a day that reveals to him, more than all other days in the year, the gross injustice and cruelty to which he is the constant victim." },
  { id: "s07", group: "speeches", author: "Susan B. Anthony", source: "Is It a Crime for a Citizen of the United States to Vote? (1873)", text: "It was we, the people; not we, the white male citizens; nor yet we, the male citizens; but we, the whole people, who formed the Union." },
  { id: "s08", group: "speeches", author: "Thomas Jefferson", source: "Declaration of Independence (1776)", text: "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness." },
];

export function quoteLength(q: Pick<Quote, "text">): QuoteLength {
  const n = q.text.length;
  if (n < 90) return "short";
  if (n < 200) return "medium";
  return "long";
}

export const QUOTES: Quote[] = RAW;

const BY_ID = new Map(QUOTES.map((q) => [q.id, q]));

export function getQuote(id: string): Quote | undefined {
  return BY_ID.get(id);
}

export function filterQuotes(length: QuoteLength | "any", group: QuoteGroup | "any"): Quote[] {
  return QUOTES.filter(
    (q) => (length === "any" || quoteLength(q) === length) && (group === "any" || q.group === group),
  );
}
