import { isDisallowedInstantDrawConcept } from "./instant-draw";
import { catalogDisplayTitle } from "./catalog-labels";

export type PortableCatalogItem = {
  id: string;
  title: string;
  collection: string;
  category: string;
  page: number;
  filename: string;
  keywords: string[];
  style?: string;
  titleIsGenerated?: boolean;
};
const TOPICS: { names: string[]; terms: string[] }[] = [
  {
    names: ["flower", "flowers", "floral", "florals", "花", "花朵", "花卉"],
    terms: [
      "flower",
      "floral",
      "rose",
      "tulip",
      "lilium",
      "lotus",
      "orchid",
      "daisy",
      "chrysanthemum",
      "chrysanthemun",
    ],
  },
  {
    names: ["heart", "hearts", "心", "心心", "愛心", "爱心"],
    terms: ["heart", "hearts"],
  },
  {
    names: [
      "smile",
      "smiley",
      "smileys",
      "smileyface",
      "笑",
      "笑哈哈",
      "笑面",
      "笑臉",
      "笑脸",
    ],
    terms: ["smile", "smiley", "smileys"],
  },
  {
    names: ["dog", "dogs", "狗", "狗狗"],
    terms: [
      "dog",
      "poodle",
      "bichon",
      "shiba",
      "corgi",
      "frenchie",
      "mongrel",
      "mogrel",
      "retriever",
    ],
  },
  {
    names: ["cat", "cats", "貓", "猫", "貓貓", "猫猫"],
    terms: ["cat", "sphynx", "sohynx"],
  },
  { names: ["hk", "852", "香港"], terms: ["hong", "kong", "852", "home kong"] },
  { names: ["moon", "月", "月亮"], terms: ["moon"] },
  { names: ["sun", "太陽", "太阳"], terms: ["sun"] },
  { names: ["rose", "roses", "玫瑰"], terms: ["rose"] },
  { names: ["tulip", "tulips", "鬱金香", "郁金香"], terms: ["tulip"] },
  { names: ["butterfly", "butterflies", "蝴蝶"], terms: ["butterfly"] },
  { names: ["dragon", "dragons", "龍", "龙"], terms: ["dragon"] },
  { names: ["skull", "skulls", "骷髏", "骷髅"], terms: ["skull", "skulls"] },
  {
    names: ["ribbon", "bow", "bows", "蝴蝶結", "蝴蝶结"],
    terms: ["ribbon", "bow"],
  },
  {
    names: ["football", "soccer", "足球"],
    terms: ["football", "soccer", "beautiful game"],
  },
  {
    names: ["rugby", "七欖", "七榄", "欖球", "榄球"],
    terms: ["rugby", "7s", "7s game"],
  },
  {
    names: ["halloween", "spooky", "萬聖節", "万圣节"],
    terms: ["spooky", "halloween"],
  },
  {
    names: ["christmas", "聖誕", "圣诞"],
    terms: ["christmas", "yuletide", "santa"],
  },
];
const STOP = new Set([
  "a",
  "an",
  "the",
  "small",
  "simple",
  "little",
  "tiny",
  "design",
  "designs",
  "tattoo",
  "my",
  "me",
  "want",
  "like",
  "please",
  "draw",
  "find",
  "outline",
  "fine",
  "line",
  "with",
  "for",
  "of",
  "in",
  "some",
  "would",
  "can",
  "it",
  "something",
  "cute",
  "pretty",
]);
const QUICK_IDS = [
  "heart-with-arrow",
  "fine-line-tulip",
  "melted-smile",
  "moon-with-leaf",
  "heart-shaped-clip",
  "fine-line-flower",
  "ribbon",
  "dog-balloon",
];
function normal(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[_\-]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function includesTerm(text: string, term: string): boolean {
  const needle = normal(term);
  return (
    text === needle ||
    ` ${text} `.includes(` ${needle} `) ||
    (/[\u3400-\u9fff]/.test(needle) && text.includes(needle))
  );
}
function facets(query: string): string[][] {
  const clean = normal(query).replace(
    /我想畫|我想要?|想揀|想搵|請|唔該|嘅|的|一個|一款|圖案|紋身|纹身|幫我/g,
    "",
  );
  const found: string[][] = [];
  for (const word of clean.split(/\s+/).filter(Boolean)) {
    if (STOP.has(word)) continue;
    const topic = TOPICS.find((group) =>
      group.names.some(
        (name) =>
          normal(name) === word ||
          (/[\u3400-\u9fff]/.test(name) && word.includes(name)),
      ),
    );
    found.push(topic ? topic.terms : [word]);
  }
  return found;
}
/** Strict catalog retrieval: every meaningful theme must match; originals only, at most four. */
export function findCatalogMatches<T extends PortableCatalogItem>(
  items: readonly T[],
  query: string,
  limit = 4,
): T[] {
  if (isDisallowedInstantDrawConcept(query)) return [];
  const eligible = items.filter(
    (item) =>
      !isDisallowedInstantDrawConcept(
        `${item.title} ${item.collection} ${item.filename}`,
      ),
  );
  const amount = Math.max(1, Math.min(4, Math.floor(limit) || 4));
  const normalizedQuery = normal(query);
  if (
    [
      "surprise me",
      "all",
      "all designs",
      "any",
      "全部",
      "隨便",
      "惊喜",
      "驚喜",
    ].includes(normalizedQuery)
  ) {
    return [...eligible]
      .sort((a, b) => quickOrder(a.id) - quickOrder(b.id))
      .slice(0, amount);
  }
  const themes = facets(query);
  if (!themes.length) return [];
  return eligible
    .map((item, position) => {
      const title = normal(catalogDisplayTitle(item));
      const text = normal(
        [
          item.title,
          catalogDisplayTitle(item),
          item.collection,
          item.category,
          ...item.keywords,
        ].join(" "),
      );
      if (
        !themes.every((theme) => theme.some((term) => includesTerm(text, term)))
      )
        return { item, score: 0, position };
      const exact = title === normalizedQuery ? 120 : 0;
      const inTitle = themes.reduce(
        (sum, theme) =>
          sum + (theme.some((term) => includesTerm(title, term)) ? 30 : 5),
        0,
      );
      const quick = quickOrder(item.id) < QUICK_IDS.length ? 8 : 0;
      return { item, score: exact + inTitle + quick, position };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, amount)
    .map((result) => result.item);
}
function quickOrder(id: string): number {
  const index = QUICK_IDS.indexOf(id);
  return index < 0 ? QUICK_IDS.length : index;
}
