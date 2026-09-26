/**
 * "Type the Internet": odd, fun and hard things to type. Everything here is
 * public domain (traditional rhymes, pre-1929 works) or written for clack.
 */

export interface InternetPack {
  id: string;
  name: string;
  blurb: string;
  /** passages typed as custom text; or a code language to launch code mode */
  passages?: string[];
  codeLanguage?: string;
  quoteGroup?: "speeches";
}

export const INTERNET_PACKS: InternetPack[] = [
  {
    id: "speeches",
    name: "famous speeches",
    blurb: "Lincoln, Douglass, Anthony and others, from the public record.",
    quoteGroup: "speeches",
  },
  {
    id: "stage",
    name: "stage dialogue",
    blurb: "Shakespeare, out loud, through your fingers.",
    passages: [
      "To be, or not to be, that is the question: whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them.",
      "Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him. The evil that men do lives after them; the good is oft interred with their bones.",
      "But, soft! what light through yonder window breaks? It is the east, and Juliet is the sun.",
      "Now is the winter of our discontent made glorious summer by this sun of York.",
      "The quality of mercy is not strain'd; it droppeth as the gentle rain from heaven upon the place beneath.",
    ],
  },
  {
    id: "screenplay",
    name: "screenplay scraps",
    blurb: "Original movie-style dialogue for a film that doesn't exist.",
    passages: [
      "INT. SERVER ROOM - NIGHT. The fans hum. MAYA types faster than the logs can scroll. MAYA: It's not a bug. It's a message. DEV: Saying what? MAYA: Saying stop reading the logs and start reading the timestamps.",
      "EXT. ROOFTOP - DAWN. Two strangers, one umbrella. STRANGER: You always carry that? JUNO: Only on days it isn't supposed to rain. STRANGER: How often does that work? JUNO: Every time it matters.",
      "INT. DINER - 3 A.M. The waitress refills a cup nobody ordered. WAITRESS: You look like someone who's about to change their mind. DETECTIVE: About what? WAITRESS: Everything, hon. Pie?",
    ],
  },
  {
    id: "prose",
    name: "original prose",
    blurb: "Short pieces written for clack. Song-free, lyric-free, all ours.",
    passages: [
      "The kettle clicked off in the next room, and for a moment the whole apartment held its breath. Then the radiator knocked twice, the neighbour's dog remembered it had opinions, and the morning went back to being ordinary.",
      "She kept a notebook for sentences that arrived at bad times: in the shower, halfway up a staircase, at the exact moment someone asked her a question. Most of them were useless. A few of them were the reason she kept the notebook.",
      "The lighthouse keeper's last log entry was only four words long: wind from the west. Everyone who read it later swore it sounded like a goodbye, which says more about the readers than about the wind.",
      "Somewhere a map is being redrawn because a river changed its mind. Nobody asked the river. Rivers have always done their best work without permission.",
    ],
  },
  {
    id: "encyclopedia",
    name: "encyclopedia-style",
    blurb: "Plain, factual passages in a reference-book voice, written for clack.",
    passages: [
      "The QWERTY layout takes its name from the first six letters of the top row. It descends from typewriters developed in the 1870s by Christopher Latham Sholes and colleagues, and it remained dominant long after the mechanical constraints that shaped it disappeared.",
      "The Dvorak Simplified Keyboard was patented in 1936 by August Dvorak and William Dealey. It places the most common English letters on the home row, with vowels grouped under the left hand and frequent consonants under the right.",
      "Words per minute is conventionally calculated by treating every five characters, including spaces, as one word. This standard makes results comparable across texts whose actual word lengths differ.",
      "Touch typing is the practice of typing without looking at the keyboard, relying on muscle memory and the tactile markers found on the F and J keys to keep the fingers anchored to the home row.",
    ],
  },
  {
    id: "twisters",
    name: "tongue twisters",
    blurb: "Traditional ones. Easier on the fingers than on the tongue. Probably.",
    passages: [
      "She sells seashells by the seashore, and the shells she sells are surely seashells.",
      "Peter Piper picked a peck of pickled peppers. How many pickled peppers did Peter Piper pick?",
      "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
      "Betty Botter bought some butter, but she said the butter's bitter.",
      "Red lorry, yellow lorry, red lorry, yellow lorry, unique New York, unique New York.",
      "Six slippery snails slid slowly seaward.",
      "I saw Susie sitting in a shoeshine shop.",
    ],
  },
  {
    id: "absurd",
    name: "absurd sentences",
    blurb: "Grammatically sound. Otherwise, not.",
    passages: [
      "The accountant's goldfish filed a formal complaint about the lighting in the aquarium, citing mood.",
      "Seventeen polite geese negotiated a ceasefire with the lawnmower and then refused to explain the terms.",
      "My umbrella has started a podcast about staying dry in emotionally difficult weather.",
      "The moon was late again, and the tide, frankly, was starting to take it personally.",
      "A retired toaster opened a small bakery, then burned the grand opening, which everyone agreed was on brand.",
    ],
  },
  {
    id: "torture",
    name: "keyboard torture",
    blurb: "Symbols, alternating hands, awkward reaches. You were warned.",
    passages: [
      "qaz wsx edc rfv tgb yhn ujm ik, ol. p;/ [']",
      "{[(<>)]} {[(<>)]} !@#$%^&*() ~`|\\ _+-= ;:'\" ,./?",
      "Zyzzyva quizzically jinxed exquisite Xylophone Quartz; zephyrs vex jumpy quacks.",
      "aAaA bBbB QqQq ZzZz; mixEd CaSe tYpInG iS A tRaP.",
      "0x7F3A && (ptr->next != NULL) || !~flag ^ mask << 2 >> 1;",
    ],
  },
  {
    id: "long",
    name: "long words",
    blurb: "One word at a time, and every one is a mountain.",
    passages: [
      "antidisestablishmentarianism floccinaucinihilipilification incomprehensibilities uncharacteristically electroencephalographically",
      "pneumonoultramicroscopicsilicovolcanoconiosis supercalifragilisticexpialidocious hippopotomonstrosesquippedaliophobia",
      "counterrevolutionaries internationalization telecommunications disproportionately institutionalization",
    ],
  },
  {
    id: "numbers",
    name: "numbers",
    blurb: "Dates, decimals, versions and phone-shaped things.",
    passages: [
      "On 1969-07-20 at 20:17 UTC, the lander touched down with about 25 seconds of fuel margin; 3.14159 and 2.71828 walked into a bar.",
      "Order #48213 shipped 12 items (3 x 4) for $149.99, weighing 2.35 kg, tracking 1Z 999 AA1 01 2345 6784.",
      "v2.11.4 -> v3.0.0-rc.1 (build 20260926.3) fixed 42 bugs, added 7 features, and broke exactly 1 thing.",
      "Call 555-0142 between 09:30 and 17:45, or text 555-0199; room 4B, floor 12, seat 7.",
    ],
  },
  {
    id: "urls",
    name: "URLs",
    blurb: "Slashes, dots, query strings. The web in raw form.",
    passages: [
      "https://example.com/docs/getting-started?lang=en&version=3#install-with-npm",
      "http://localhost:3000/api/v1/users/42/settings?include=theme,sounds&debug=true",
      "https://cdn.example.org/assets/img/hero@2x.webp?w=1920&q=80 mailto:hello@example.net",
      "ftp://files.example.com/pub/archive/2026-09-26_backup.tar.gz ssh://git@example.com:22/team/repo.git",
    ],
  },
  { id: "json", name: "JSON", blurb: "Braces, quotes and commas, with real indentation.", codeLanguage: "json" },
  { id: "terminal", name: "terminal commands", blurb: "The commands you type every day, now for speed.", codeLanguage: "shell" },
  { id: "code", name: "programming snippets", blurb: "Nine languages, syntax-highlighted.", codeLanguage: "any" },
];
