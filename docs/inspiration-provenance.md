# Catalog inspiration provenance

All assets in `assets/catalog/inspiration/` were deterministically extracted from the user-authorized private PDF named below. The confidential PDF is **not copied, included, or distributed** by this import.

- **Authorized local source:** `/home/ubuntu/upload/CopyofTemptatcatalog(1).pdf`
- **Importer:** `scripts/extract-all-catalog.py`
- **Source scope:** physical PDF pages 5–54; whole page 21 and every `mandala` / `曼陀羅` / `曼荼羅` header or caption are excluded; page 32 `Line Art Design v.5` is also excluded.

## Pixel-preserving method

The importer loops PDF image objects and uses only PDF text/image geometry. It caches alpha bounds per xref, applies each source soft mask, rejects the full-page background, repeated template frame, header logo, footer-only objects, and edge-cap texture by visible bounds. It does **not** render pages, use an LLM/AI classifier, redraw, screenshot, or synthesize art. For each retained source object, it trims alpha-empty outer margins, centers the unchanged pixels on a white square canvas, and downscales only when needed to a 720 px maximum side.

Titles/concepts are exact PDF captions when one is geometrically associated. Uncaptioned Fluffy Friends and sports source objects retain an explicit `Collection · Design N` fallback and `titleIsGenerated: true`; no invented source caption is claimed.

## Page coverage

| PDF page | Collection header from PDF | Status | Records | Captioned | Unlabeled fallback | Reason |
|---:|---|---|---:|---:|---:|---|
| 5 | Kong Strong Collection | covered | 10 | 10 | 0 |  |
| 6 | Kong Strong Collection | covered | 8 | 8 | 0 |  |
| 7 | Kong Strong Collection | covered | 11 | 11 | 0 |  |
| 8 | Fluffy Friends: Poodle | covered | 10 | 0 | 10 |  |
| 9 | Fluffy Friends: Bichon | covered | 11 | 0 | 11 |  |
| 10 | Fluffy Friends: Shiba | covered | 13 | 0 | 13 |  |
| 11 | Fluffy Friends: Golden Retriever | covered | 15 | 0 | 15 |  |
| 12 | Fluffy Friends: Mongrel | covered | 14 | 0 | 14 |  |
| 13 | Fluffy Friends: Frenchie | covered | 22 | 0 | 22 |  |
| 14 | Fluffy Friends: Corgi | covered | 15 | 0 | 15 |  |
| 15 | Fluffy Friends: Short Hair Cat | covered | 15 | 0 | 15 |  |
| 16 | Fluffy Friends: Long Hair Cat | covered | 14 | 0 | 14 |  |
| 17 | Fluffy Friends: Domestic Cat | covered | 11 | 0 | 11 |  |
| 18 | Fluffy Friends: Sphynx Cat | covered | 14 | 0 | 14 |  |
| 19 | Fluffy Friends: Sphynx Cat | covered | 18 | 0 | 18 |  |
| 20 | Above The Sky \| Sun, Moon & Angel | covered | 11 | 11 | 0 |  |
| 21 | Sacred Geometry \| Mandala | excluded | 0 | 0 | 0 | Whole Mandala collection excluded by instruction. |
| 22 | Metamorphosis \| Butterfly | covered | 9 | 9 | 0 |  |
| 23 | Sacred Pulse \| Hearts | covered | 8 | 8 | 0 |  |
| 24 | Sacred Pulse \| Hearts | covered | 5 | 5 | 0 |  |
| 25 | Happy Arcade \| Smileys & Toys | covered | 8 | 8 | 0 |  |
| 26 | Happy Arcade \| Smileys & Toys | covered | 9 | 9 | 0 |  |
| 27 | Script & Speak \| Wordings | covered | 10 | 10 | 0 |  |
| 28 | Script & Speak \| Wordings | covered | 10 | 10 | 0 |  |
| 29 | Script & Speak \| Wordings | covered | 10 | 10 | 0 |  |
| 30 | Script & Speak \| Wordings | covered | 10 | 10 | 0 |  |
| 31 | Script & Speak \| Wordings | covered | 4 | 4 | 0 |  |
| 32 | Sanskrit & Soul \| Fine Line Yogi | covered | 5 | 5 | 0 |  |
| 33 | Sanskrit & Soul \| Fine Line Yogi | covered | 7 | 7 | 0 |  |
| 34 | Petal & Vine \| Fine Line Flowers & Leafs | covered | 8 | 8 | 0 |  |
| 35 | Petal & Vine \| Fine Line Flowers & Leafs | covered | 8 | 8 | 0 |  |
| 36 | Heritage Ink \| Old School | covered | 8 | 8 | 0 |  |
| 37 | Heritage Ink \| Old School | covered | 5 | 5 | 0 |  |
| 38 | Wild Majesty \| Tiger & Lion | covered | 5 | 5 | 0 |  |
| 39 | Wild Majesty \| Tiger & Lion | covered | 5 | 5 | 0 |  |
| 40 | Memento Mori \| Skull Art | covered | 7 | 7 | 0 |  |
| 41 | Memento Mori \| Skull Art | covered | 6 | 6 | 0 |  |
| 42 | Memento Mori \| Skull Art | covered | 6 | 6 | 0 |  |
| 43 | The Composite Canvas Collection | covered | 4 | 4 | 0 |  |
| 44 | The Living Gallery \| Artist Sandra | covered | 6 | 6 | 0 |  |
| 45 | The Living Gallery \| Artist TJ | covered | 6 | 6 | 0 |  |
| 46 | The Living Gallery \| Artist Brian | covered | 6 | 6 | 0 |  |
| 47 | The Beautiful Game | covered | 11 | 0 | 11 |  |
| 48 | The Beautiful Game | covered | 10 | 0 | 10 |  |
| 49 | The Beautiful Game | covered | 10 | 0 | 10 |  |
| 50 | The 7s Game | covered | 5 | 0 | 5 |  |
| 51 | Spooky Collection | covered | 9 | 9 | 0 |  |
| 52 | Spooky Collection | covered | 9 | 9 | 0 |  |
| 53 | Christmas Collection | covered | 5 | 5 | 0 |  |
| 54 | Christmas Collection | covered | 5 | 5 | 0 |  |

## Source-object register

| ID | Exact title / transparent fallback | Collection | Page | Source image xref | Generated title? |
|---|---|---|---:|---:|---|
| `vertical` | 香港 (Vertical) | Kong Strong Collection | 5 | 1824 | no |
| `852-a` | 852 A | Kong Strong Collection | 5 | 1821 | no |
| `made-in-hong-kong` | Made In Hong Kong | Kong Strong Collection | 5 | 1820 | no |
| `hong-kong-orchid-2` | Hong Kong Orchid 2 | Kong Strong Collection | 5 | 1826 | no |
| `home-kong` | Home Kong | Kong Strong Collection | 5 | 1819 | no |
| `map` | Map | Kong Strong Collection | 5 | 1818 | no |
| `hong-kong-orchid-1` | Hong Kong Orchid 1 | Kong Strong Collection | 5 | 1825 | no |
| `mirror-tattoo` | Mirror Tattoo | Kong Strong Collection | 5 | 1827 | no |
| `hongkong` | HONGKONG | Kong Strong Collection | 5 | 1823 | no |
| `852-b` | 852 B | Kong Strong Collection | 5 | 1822 | no |
| `dragon` | Dragon | Kong Strong Collection | 6 | 1839 | no |
| `lkf` | LKF | Kong Strong Collection | 6 | 1836 | no |
| `catalog-design` | 鬼佬 | Kong Strong Collection | 6 | 1837 | no |
| `signage` | Signage | Kong Strong Collection | 6 | 1841 | no |
| `bruce-lee` | Bruce Lee | Kong Strong Collection | 6 | 1840 | no |
| `king-kong` | King Kong | Kong Strong Collection | 6 | 1842 | no |
| `buddha` | Buddha | Kong Strong Collection | 6 | 1838 | no |
| `kong-strong` | Kong Strong | Kong Strong Collection | 6 | 1843 | no |
| `catalog-design-p7-x1853` | 你望咩呀 | Kong Strong Collection | 7 | 1853 | no |
| `taxi5seats` | Taxi5seats | Kong Strong Collection | 7 | 1854 | no |
| `okay-la` | Okay La | Kong Strong Collection | 7 | 1860 | no |
| `bao` | Bao | Kong Strong Collection | 7 | 1856 | no |
| `taxi` | Taxi | Kong Strong Collection | 7 | 1852 | no |
| `angry-panda` | Angry Panda | Kong Strong Collection | 7 | 1862 | no |
| `fat` | FAT | Kong Strong Collection | 7 | 1855 | no |
| `bao-chopstick` | Bao Chopstick | Kong Strong Collection | 7 | 1858 | no |
| `door` | Door | Kong Strong Collection | 7 | 1861 | no |
| `siumai` | SiuMai | Kong Strong Collection | 7 | 1857 | no |
| `one-love` | One Love | Kong Strong Collection | 7 | 1859 | no |
| `fluffy-friends-poodle-design-1` | Fluffy Friends: Poodle · Design 1 | Fluffy Friends: Poodle | 8 | 1873 | yes |
| `fluffy-friends-poodle-design-2` | Fluffy Friends: Poodle · Design 2 | Fluffy Friends: Poodle | 8 | 1878 | yes |
| `fluffy-friends-poodle-design-3` | Fluffy Friends: Poodle · Design 3 | Fluffy Friends: Poodle | 8 | 1879 | yes |
| `fluffy-friends-poodle-design-4` | Fluffy Friends: Poodle · Design 4 | Fluffy Friends: Poodle | 8 | 1872 | yes |
| `fluffy-friends-poodle-design-5` | Fluffy Friends: Poodle · Design 5 | Fluffy Friends: Poodle | 8 | 1880 | yes |
| `fluffy-friends-poodle-design-6` | Fluffy Friends: Poodle · Design 6 | Fluffy Friends: Poodle | 8 | 1874 | yes |
| `fluffy-friends-poodle-design-7` | Fluffy Friends: Poodle · Design 7 | Fluffy Friends: Poodle | 8 | 1871 | yes |
| `fluffy-friends-poodle-design-8` | Fluffy Friends: Poodle · Design 8 | Fluffy Friends: Poodle | 8 | 1875 | yes |
| `fluffy-friends-poodle-design-9` | Fluffy Friends: Poodle · Design 9 | Fluffy Friends: Poodle | 8 | 1876 | yes |
| `fluffy-friends-poodle-design-10` | Fluffy Friends: Poodle · Design 10 | Fluffy Friends: Poodle | 8 | 1877 | yes |
| `fluffy-friends-bichon-design-1` | Fluffy Friends: Bichon · Design 1 | Fluffy Friends: Bichon | 9 | 1899 | yes |
| `fluffy-friends-bichon-design-2` | Fluffy Friends: Bichon · Design 2 | Fluffy Friends: Bichon | 9 | 1895 | yes |
| `fluffy-friends-bichon-design-3` | Fluffy Friends: Bichon · Design 3 | Fluffy Friends: Bichon | 9 | 1892 | yes |
| `fluffy-friends-bichon-design-4` | Fluffy Friends: Bichon · Design 4 | Fluffy Friends: Bichon | 9 | 1893 | yes |
| `fluffy-friends-bichon-design-5` | Fluffy Friends: Bichon · Design 5 | Fluffy Friends: Bichon | 9 | 1889 | yes |
| `fluffy-friends-bichon-design-6` | Fluffy Friends: Bichon · Design 6 | Fluffy Friends: Bichon | 9 | 1890 | yes |
| `fluffy-friends-bichon-design-7` | Fluffy Friends: Bichon · Design 7 | Fluffy Friends: Bichon | 9 | 1896 | yes |
| `fluffy-friends-bichon-design-8` | Fluffy Friends: Bichon · Design 8 | Fluffy Friends: Bichon | 9 | 1897 | yes |
| `fluffy-friends-bichon-design-9` | Fluffy Friends: Bichon · Design 9 | Fluffy Friends: Bichon | 9 | 1894 | yes |
| `fluffy-friends-bichon-design-10` | Fluffy Friends: Bichon · Design 10 | Fluffy Friends: Bichon | 9 | 1898 | yes |
| `fluffy-friends-bichon-design-11` | Fluffy Friends: Bichon · Design 11 | Fluffy Friends: Bichon | 9 | 1891 | yes |
| `fluffy-friends-shiba-design-1` | Fluffy Friends: Shiba · Design 1 | Fluffy Friends: Shiba | 10 | 1918 | yes |
| `fluffy-friends-shiba-design-2` | Fluffy Friends: Shiba · Design 2 | Fluffy Friends: Shiba | 10 | 1912 | yes |
| `fluffy-friends-shiba-design-3` | Fluffy Friends: Shiba · Design 3 | Fluffy Friends: Shiba | 10 | 1919 | yes |
| `fluffy-friends-shiba-design-4` | Fluffy Friends: Shiba · Design 4 | Fluffy Friends: Shiba | 10 | 1910 | yes |
| `fluffy-friends-shiba-design-5` | Fluffy Friends: Shiba · Design 5 | Fluffy Friends: Shiba | 10 | 1920 | yes |
| `fluffy-friends-shiba-design-6` | Fluffy Friends: Shiba · Design 6 | Fluffy Friends: Shiba | 10 | 1917 | yes |
| `fluffy-friends-shiba-design-7` | Fluffy Friends: Shiba · Design 7 | Fluffy Friends: Shiba | 10 | 1908 | yes |
| `fluffy-friends-shiba-design-8` | Fluffy Friends: Shiba · Design 8 | Fluffy Friends: Shiba | 10 | 1915 | yes |
| `fluffy-friends-shiba-design-9` | Fluffy Friends: Shiba · Design 9 | Fluffy Friends: Shiba | 10 | 1911 | yes |
| `fluffy-friends-shiba-design-10` | Fluffy Friends: Shiba · Design 10 | Fluffy Friends: Shiba | 10 | 1913 | yes |
| `fluffy-friends-shiba-design-11` | Fluffy Friends: Shiba · Design 11 | Fluffy Friends: Shiba | 10 | 1909 | yes |
| `fluffy-friends-shiba-design-12` | Fluffy Friends: Shiba · Design 12 | Fluffy Friends: Shiba | 10 | 1916 | yes |
| `fluffy-friends-shiba-design-13` | Fluffy Friends: Shiba · Design 13 | Fluffy Friends: Shiba | 10 | 1914 | yes |
| `fluffy-friends-golden-retriever-design-1` | Fluffy Friends: Golden Retriever · Design 1 | Fluffy Friends: Golden Retriever | 11 | 1934 | yes |
| `fluffy-friends-golden-retriever-design-2` | Fluffy Friends: Golden Retriever · Design 2 | Fluffy Friends: Golden Retriever | 11 | 1942 | yes |
| `fluffy-friends-golden-retriever-design-3` | Fluffy Friends: Golden Retriever · Design 3 | Fluffy Friends: Golden Retriever | 11 | 1931 | yes |
| `fluffy-friends-golden-retriever-design-4` | Fluffy Friends: Golden Retriever · Design 4 | Fluffy Friends: Golden Retriever | 11 | 1929 | yes |
| `fluffy-friends-golden-retriever-design-5` | Fluffy Friends: Golden Retriever · Design 5 | Fluffy Friends: Golden Retriever | 11 | 1932 | yes |
| `fluffy-friends-golden-retriever-design-6` | Fluffy Friends: Golden Retriever · Design 6 | Fluffy Friends: Golden Retriever | 11 | 1940 | yes |
| `fluffy-friends-golden-retriever-design-7` | Fluffy Friends: Golden Retriever · Design 7 | Fluffy Friends: Golden Retriever | 11 | 1938 | yes |
| `fluffy-friends-golden-retriever-design-8` | Fluffy Friends: Golden Retriever · Design 8 | Fluffy Friends: Golden Retriever | 11 | 1937 | yes |
| `fluffy-friends-golden-retriever-design-9` | Fluffy Friends: Golden Retriever · Design 9 | Fluffy Friends: Golden Retriever | 11 | 1930 | yes |
| `fluffy-friends-golden-retriever-design-10` | Fluffy Friends: Golden Retriever · Design 10 | Fluffy Friends: Golden Retriever | 11 | 1939 | yes |
| `fluffy-friends-golden-retriever-design-11` | Fluffy Friends: Golden Retriever · Design 11 | Fluffy Friends: Golden Retriever | 11 | 1935 | yes |
| `fluffy-friends-golden-retriever-design-12` | Fluffy Friends: Golden Retriever · Design 12 | Fluffy Friends: Golden Retriever | 11 | 1933 | yes |
| `fluffy-friends-golden-retriever-design-13` | Fluffy Friends: Golden Retriever · Design 13 | Fluffy Friends: Golden Retriever | 11 | 1936 | yes |
| `fluffy-friends-golden-retriever-design-14` | Fluffy Friends: Golden Retriever · Design 14 | Fluffy Friends: Golden Retriever | 11 | 1943 | yes |
| `fluffy-friends-golden-retriever-design-15` | Fluffy Friends: Golden Retriever · Design 15 | Fluffy Friends: Golden Retriever | 11 | 1941 | yes |
| `fluffy-friends-mongrel-design-1` | Fluffy Friends: Mongrel · Design 1 | Fluffy Friends: Mongrel | 12 | 1957 | yes |
| `fluffy-friends-mongrel-design-2` | Fluffy Friends: Mongrel · Design 2 | Fluffy Friends: Mongrel | 12 | 1955 | yes |
| `fluffy-friends-mongrel-design-3` | Fluffy Friends: Mongrel · Design 3 | Fluffy Friends: Mongrel | 12 | 1958 | yes |
| `fluffy-friends-mongrel-design-4` | Fluffy Friends: Mongrel · Design 4 | Fluffy Friends: Mongrel | 12 | 1963 | yes |
| `fluffy-friends-mongrel-design-5` | Fluffy Friends: Mongrel · Design 5 | Fluffy Friends: Mongrel | 12 | 1965 | yes |
| `fluffy-friends-mongrel-design-6` | Fluffy Friends: Mongrel · Design 6 | Fluffy Friends: Mongrel | 12 | 1954 | yes |
| `fluffy-friends-mongrel-design-7` | Fluffy Friends: Mongrel · Design 7 | Fluffy Friends: Mongrel | 12 | 1959 | yes |
| `fluffy-friends-mongrel-design-8` | Fluffy Friends: Mongrel · Design 8 | Fluffy Friends: Mongrel | 12 | 1952 | yes |
| `fluffy-friends-mongrel-design-9` | Fluffy Friends: Mongrel · Design 9 | Fluffy Friends: Mongrel | 12 | 1961 | yes |
| `fluffy-friends-mongrel-design-10` | Fluffy Friends: Mongrel · Design 10 | Fluffy Friends: Mongrel | 12 | 1964 | yes |
| `fluffy-friends-mongrel-design-11` | Fluffy Friends: Mongrel · Design 11 | Fluffy Friends: Mongrel | 12 | 1956 | yes |
| `fluffy-friends-mongrel-design-12` | Fluffy Friends: Mongrel · Design 12 | Fluffy Friends: Mongrel | 12 | 1953 | yes |
| `fluffy-friends-mongrel-design-13` | Fluffy Friends: Mongrel · Design 13 | Fluffy Friends: Mongrel | 12 | 1960 | yes |
| `fluffy-friends-mongrel-design-14` | Fluffy Friends: Mongrel · Design 14 | Fluffy Friends: Mongrel | 12 | 1962 | yes |
| `fluffy-friends-frenchie-design-1` | Fluffy Friends: Frenchie · Design 1 | Fluffy Friends: Frenchie | 13 | 1987 | yes |
| `fluffy-friends-frenchie-design-2` | Fluffy Friends: Frenchie · Design 2 | Fluffy Friends: Frenchie | 13 | 1990 | yes |
| `fluffy-friends-frenchie-design-3` | Fluffy Friends: Frenchie · Design 3 | Fluffy Friends: Frenchie | 13 | 1986 | yes |
| `fluffy-friends-frenchie-design-4` | Fluffy Friends: Frenchie · Design 4 | Fluffy Friends: Frenchie | 13 | 1988 | yes |
| `fluffy-friends-frenchie-design-5` | Fluffy Friends: Frenchie · Design 5 | Fluffy Friends: Frenchie | 13 | 1985 | yes |
| `fluffy-friends-frenchie-design-6` | Fluffy Friends: Frenchie · Design 6 | Fluffy Friends: Frenchie | 13 | 1976 | yes |
| `fluffy-friends-frenchie-design-7` | Fluffy Friends: Frenchie · Design 7 | Fluffy Friends: Frenchie | 13 | 1982 | yes |
| `fluffy-friends-frenchie-design-8` | Fluffy Friends: Frenchie · Design 8 | Fluffy Friends: Frenchie | 13 | 1989 | yes |
| `fluffy-friends-frenchie-design-9` | Fluffy Friends: Frenchie · Design 9 | Fluffy Friends: Frenchie | 13 | 1984 | yes |
| `fluffy-friends-frenchie-design-10` | Fluffy Friends: Frenchie · Design 10 | Fluffy Friends: Frenchie | 13 | 1974 | yes |
| `fluffy-friends-frenchie-design-11` | Fluffy Friends: Frenchie · Design 11 | Fluffy Friends: Frenchie | 13 | 1981 | yes |
| `fluffy-friends-frenchie-design-12` | Fluffy Friends: Frenchie · Design 12 | Fluffy Friends: Frenchie | 13 | 1991 | yes |
| `fluffy-friends-frenchie-design-13` | Fluffy Friends: Frenchie · Design 13 | Fluffy Friends: Frenchie | 13 | 1994 | yes |
| `fluffy-friends-frenchie-design-14` | Fluffy Friends: Frenchie · Design 14 | Fluffy Friends: Frenchie | 13 | 1979 | yes |
| `fluffy-friends-frenchie-design-15` | Fluffy Friends: Frenchie · Design 15 | Fluffy Friends: Frenchie | 13 | 1978 | yes |
| `fluffy-friends-frenchie-design-16` | Fluffy Friends: Frenchie · Design 16 | Fluffy Friends: Frenchie | 13 | 1983 | yes |
| `fluffy-friends-frenchie-design-17` | Fluffy Friends: Frenchie · Design 17 | Fluffy Friends: Frenchie | 13 | 1975 | yes |
| `fluffy-friends-frenchie-design-18` | Fluffy Friends: Frenchie · Design 18 | Fluffy Friends: Frenchie | 13 | 1980 | yes |
| `fluffy-friends-frenchie-design-19` | Fluffy Friends: Frenchie · Design 19 | Fluffy Friends: Frenchie | 13 | 1977 | yes |
| `fluffy-friends-frenchie-design-20` | Fluffy Friends: Frenchie · Design 20 | Fluffy Friends: Frenchie | 13 | 1995 | yes |
| `fluffy-friends-frenchie-design-21` | Fluffy Friends: Frenchie · Design 21 | Fluffy Friends: Frenchie | 13 | 1993 | yes |
| `fluffy-friends-frenchie-design-22` | Fluffy Friends: Frenchie · Design 22 | Fluffy Friends: Frenchie | 13 | 1992 | yes |
| `fluffy-friends-corgi-design-1` | Fluffy Friends: Corgi · Design 1 | Fluffy Friends: Corgi | 14 | 2008 | yes |
| `fluffy-friends-corgi-design-2` | Fluffy Friends: Corgi · Design 2 | Fluffy Friends: Corgi | 14 | 2007 | yes |
| `fluffy-friends-corgi-design-3` | Fluffy Friends: Corgi · Design 3 | Fluffy Friends: Corgi | 14 | 2009 | yes |
| `fluffy-friends-corgi-design-4` | Fluffy Friends: Corgi · Design 4 | Fluffy Friends: Corgi | 14 | 2010 | yes |
| `fluffy-friends-corgi-design-5` | Fluffy Friends: Corgi · Design 5 | Fluffy Friends: Corgi | 14 | 2015 | yes |
| `fluffy-friends-corgi-design-6` | Fluffy Friends: Corgi · Design 6 | Fluffy Friends: Corgi | 14 | 2014 | yes |
| `fluffy-friends-corgi-design-7` | Fluffy Friends: Corgi · Design 7 | Fluffy Friends: Corgi | 14 | 2011 | yes |
| `fluffy-friends-corgi-design-8` | Fluffy Friends: Corgi · Design 8 | Fluffy Friends: Corgi | 14 | 2013 | yes |
| `fluffy-friends-corgi-design-9` | Fluffy Friends: Corgi · Design 9 | Fluffy Friends: Corgi | 14 | 2004 | yes |
| `fluffy-friends-corgi-design-10` | Fluffy Friends: Corgi · Design 10 | Fluffy Friends: Corgi | 14 | 2006 | yes |
| `fluffy-friends-corgi-design-11` | Fluffy Friends: Corgi · Design 11 | Fluffy Friends: Corgi | 14 | 2005 | yes |
| `fluffy-friends-corgi-design-12` | Fluffy Friends: Corgi · Design 12 | Fluffy Friends: Corgi | 14 | 2016 | yes |
| `fluffy-friends-corgi-design-13` | Fluffy Friends: Corgi · Design 13 | Fluffy Friends: Corgi | 14 | 2017 | yes |
| `fluffy-friends-corgi-design-14` | Fluffy Friends: Corgi · Design 14 | Fluffy Friends: Corgi | 14 | 2018 | yes |
| `fluffy-friends-corgi-design-15` | Fluffy Friends: Corgi · Design 15 | Fluffy Friends: Corgi | 14 | 2012 | yes |
| `fluffy-friends-short-hair-cat-design-1` | Fluffy Friends: Short Hair Cat · Design 1 | Fluffy Friends: Short Hair Cat | 15 | 2029 | yes |
| `fluffy-friends-short-hair-cat-design-2` | Fluffy Friends: Short Hair Cat · Design 2 | Fluffy Friends: Short Hair Cat | 15 | 2041 | yes |
| `fluffy-friends-short-hair-cat-design-3` | Fluffy Friends: Short Hair Cat · Design 3 | Fluffy Friends: Short Hair Cat | 15 | 2027 | yes |
| `fluffy-friends-short-hair-cat-design-4` | Fluffy Friends: Short Hair Cat · Design 4 | Fluffy Friends: Short Hair Cat | 15 | 2040 | yes |
| `fluffy-friends-short-hair-cat-design-5` | Fluffy Friends: Short Hair Cat · Design 5 | Fluffy Friends: Short Hair Cat | 15 | 2038 | yes |
| `fluffy-friends-short-hair-cat-design-6` | Fluffy Friends: Short Hair Cat · Design 6 | Fluffy Friends: Short Hair Cat | 15 | 2031 | yes |
| `fluffy-friends-short-hair-cat-design-7` | Fluffy Friends: Short Hair Cat · Design 7 | Fluffy Friends: Short Hair Cat | 15 | 2032 | yes |
| `fluffy-friends-short-hair-cat-design-8` | Fluffy Friends: Short Hair Cat · Design 8 | Fluffy Friends: Short Hair Cat | 15 | 2036 | yes |
| `fluffy-friends-short-hair-cat-design-9` | Fluffy Friends: Short Hair Cat · Design 9 | Fluffy Friends: Short Hair Cat | 15 | 2039 | yes |
| `fluffy-friends-short-hair-cat-design-10` | Fluffy Friends: Short Hair Cat · Design 10 | Fluffy Friends: Short Hair Cat | 15 | 2034 | yes |
| `fluffy-friends-short-hair-cat-design-11` | Fluffy Friends: Short Hair Cat · Design 11 | Fluffy Friends: Short Hair Cat | 15 | 2030 | yes |
| `fluffy-friends-short-hair-cat-design-12` | Fluffy Friends: Short Hair Cat · Design 12 | Fluffy Friends: Short Hair Cat | 15 | 2037 | yes |
| `fluffy-friends-short-hair-cat-design-13` | Fluffy Friends: Short Hair Cat · Design 13 | Fluffy Friends: Short Hair Cat | 15 | 2035 | yes |
| `fluffy-friends-short-hair-cat-design-14` | Fluffy Friends: Short Hair Cat · Design 14 | Fluffy Friends: Short Hair Cat | 15 | 2033 | yes |
| `fluffy-friends-short-hair-cat-design-15` | Fluffy Friends: Short Hair Cat · Design 15 | Fluffy Friends: Short Hair Cat | 15 | 2028 | yes |
| `fluffy-friends-long-hair-cat-design-1` | Fluffy Friends: Long Hair Cat · Design 1 | Fluffy Friends: Long Hair Cat | 16 | 2062 | yes |
| `fluffy-friends-long-hair-cat-design-2` | Fluffy Friends: Long Hair Cat · Design 2 | Fluffy Friends: Long Hair Cat | 16 | 2059 | yes |
| `fluffy-friends-long-hair-cat-design-3` | Fluffy Friends: Long Hair Cat · Design 3 | Fluffy Friends: Long Hair Cat | 16 | 2063 | yes |
| `fluffy-friends-long-hair-cat-design-4` | Fluffy Friends: Long Hair Cat · Design 4 | Fluffy Friends: Long Hair Cat | 16 | 2050 | yes |
| `fluffy-friends-long-hair-cat-design-5` | Fluffy Friends: Long Hair Cat · Design 5 | Fluffy Friends: Long Hair Cat | 16 | 2058 | yes |
| `fluffy-friends-long-hair-cat-design-6` | Fluffy Friends: Long Hair Cat · Design 6 | Fluffy Friends: Long Hair Cat | 16 | 2060 | yes |
| `fluffy-friends-long-hair-cat-design-7` | Fluffy Friends: Long Hair Cat · Design 7 | Fluffy Friends: Long Hair Cat | 16 | 2054 | yes |
| `fluffy-friends-long-hair-cat-design-8` | Fluffy Friends: Long Hair Cat · Design 8 | Fluffy Friends: Long Hair Cat | 16 | 2053 | yes |
| `fluffy-friends-long-hair-cat-design-9` | Fluffy Friends: Long Hair Cat · Design 9 | Fluffy Friends: Long Hair Cat | 16 | 2056 | yes |
| `fluffy-friends-long-hair-cat-design-10` | Fluffy Friends: Long Hair Cat · Design 10 | Fluffy Friends: Long Hair Cat | 16 | 2052 | yes |
| `fluffy-friends-long-hair-cat-design-11` | Fluffy Friends: Long Hair Cat · Design 11 | Fluffy Friends: Long Hair Cat | 16 | 2061 | yes |
| `fluffy-friends-long-hair-cat-design-12` | Fluffy Friends: Long Hair Cat · Design 12 | Fluffy Friends: Long Hair Cat | 16 | 2055 | yes |
| `fluffy-friends-long-hair-cat-design-13` | Fluffy Friends: Long Hair Cat · Design 13 | Fluffy Friends: Long Hair Cat | 16 | 2057 | yes |
| `fluffy-friends-long-hair-cat-design-14` | Fluffy Friends: Long Hair Cat · Design 14 | Fluffy Friends: Long Hair Cat | 16 | 2051 | yes |
| `fluffy-friends-domestic-cat-design-1` | Fluffy Friends: Domestic Cat · Design 1 | Fluffy Friends: Domestic Cat | 17 | 2076 | yes |
| `fluffy-friends-domestic-cat-design-2` | Fluffy Friends: Domestic Cat · Design 2 | Fluffy Friends: Domestic Cat | 17 | 2078 | yes |
| `fluffy-friends-domestic-cat-design-3` | Fluffy Friends: Domestic Cat · Design 3 | Fluffy Friends: Domestic Cat | 17 | 2082 | yes |
| `fluffy-friends-domestic-cat-design-4` | Fluffy Friends: Domestic Cat · Design 4 | Fluffy Friends: Domestic Cat | 17 | 2072 | yes |
| `fluffy-friends-domestic-cat-design-5` | Fluffy Friends: Domestic Cat · Design 5 | Fluffy Friends: Domestic Cat | 17 | 2074 | yes |
| `fluffy-friends-domestic-cat-design-6` | Fluffy Friends: Domestic Cat · Design 6 | Fluffy Friends: Domestic Cat | 17 | 2077 | yes |
| `fluffy-friends-domestic-cat-design-7` | Fluffy Friends: Domestic Cat · Design 7 | Fluffy Friends: Domestic Cat | 17 | 2079 | yes |
| `fluffy-friends-domestic-cat-design-8` | Fluffy Friends: Domestic Cat · Design 8 | Fluffy Friends: Domestic Cat | 17 | 2075 | yes |
| `fluffy-friends-domestic-cat-design-9` | Fluffy Friends: Domestic Cat · Design 9 | Fluffy Friends: Domestic Cat | 17 | 2073 | yes |
| `fluffy-friends-domestic-cat-design-10` | Fluffy Friends: Domestic Cat · Design 10 | Fluffy Friends: Domestic Cat | 17 | 2081 | yes |
| `fluffy-friends-domestic-cat-design-11` | Fluffy Friends: Domestic Cat · Design 11 | Fluffy Friends: Domestic Cat | 17 | 2080 | yes |
| `fluffy-friends-sphynx-cat-design-1` | Fluffy Friends: Sphynx Cat · Design 1 | Fluffy Friends: Sphynx Cat | 18 | 2100 | yes |
| `fluffy-friends-sphynx-cat-design-2` | Fluffy Friends: Sphynx Cat · Design 2 | Fluffy Friends: Sphynx Cat | 18 | 2101 | yes |
| `fluffy-friends-sphynx-cat-design-3` | Fluffy Friends: Sphynx Cat · Design 3 | Fluffy Friends: Sphynx Cat | 18 | 2096 | yes |
| `fluffy-friends-sphynx-cat-design-4` | Fluffy Friends: Sphynx Cat · Design 4 | Fluffy Friends: Sphynx Cat | 18 | 2102 | yes |
| `fluffy-friends-sphynx-cat-design-5` | Fluffy Friends: Sphynx Cat · Design 5 | Fluffy Friends: Sphynx Cat | 18 | 2094 | yes |
| `fluffy-friends-sphynx-cat-design-6` | Fluffy Friends: Sphynx Cat · Design 6 | Fluffy Friends: Sphynx Cat | 18 | 2095 | yes |
| `fluffy-friends-sphynx-cat-design-7` | Fluffy Friends: Sphynx Cat · Design 7 | Fluffy Friends: Sphynx Cat | 18 | 2098 | yes |
| `fluffy-friends-sphynx-cat-design-8` | Fluffy Friends: Sphynx Cat · Design 8 | Fluffy Friends: Sphynx Cat | 18 | 2092 | yes |
| `fluffy-friends-sphynx-cat-design-9` | Fluffy Friends: Sphynx Cat · Design 9 | Fluffy Friends: Sphynx Cat | 18 | 2091 | yes |
| `fluffy-friends-sphynx-cat-design-10` | Fluffy Friends: Sphynx Cat · Design 10 | Fluffy Friends: Sphynx Cat | 18 | 2097 | yes |
| `fluffy-friends-sphynx-cat-design-11` | Fluffy Friends: Sphynx Cat · Design 11 | Fluffy Friends: Sphynx Cat | 18 | 2093 | yes |
| `fluffy-friends-sphynx-cat-design-12` | Fluffy Friends: Sphynx Cat · Design 12 | Fluffy Friends: Sphynx Cat | 18 | 2103 | yes |
| `fluffy-friends-sphynx-cat-design-13` | Fluffy Friends: Sphynx Cat · Design 13 | Fluffy Friends: Sphynx Cat | 18 | 2104 | yes |
| `fluffy-friends-sphynx-cat-design-14` | Fluffy Friends: Sphynx Cat · Design 14 | Fluffy Friends: Sphynx Cat | 18 | 2099 | yes |
| `fluffy-friends-sphynx-cat-design-1-p19-x2114` | Fluffy Friends: Sphynx Cat · Design 1 | Fluffy Friends: Sphynx Cat | 19 | 2114 | yes |
| `fluffy-friends-sphynx-cat-design-2-p19-x2130` | Fluffy Friends: Sphynx Cat · Design 2 | Fluffy Friends: Sphynx Cat | 19 | 2130 | yes |
| `fluffy-friends-sphynx-cat-design-3-p19-x2120` | Fluffy Friends: Sphynx Cat · Design 3 | Fluffy Friends: Sphynx Cat | 19 | 2120 | yes |
| `fluffy-friends-sphynx-cat-design-4-p19-x2127` | Fluffy Friends: Sphynx Cat · Design 4 | Fluffy Friends: Sphynx Cat | 19 | 2127 | yes |
| `fluffy-friends-sphynx-cat-design-5-p19-x2122` | Fluffy Friends: Sphynx Cat · Design 5 | Fluffy Friends: Sphynx Cat | 19 | 2122 | yes |
| `fluffy-friends-sphynx-cat-design-6-p19-x2115` | Fluffy Friends: Sphynx Cat · Design 6 | Fluffy Friends: Sphynx Cat | 19 | 2115 | yes |
| `fluffy-friends-sphynx-cat-design-7-p19-x2119` | Fluffy Friends: Sphynx Cat · Design 7 | Fluffy Friends: Sphynx Cat | 19 | 2119 | yes |
| `fluffy-friends-sphynx-cat-design-8-p19-x2126` | Fluffy Friends: Sphynx Cat · Design 8 | Fluffy Friends: Sphynx Cat | 19 | 2126 | yes |
| `fluffy-friends-sphynx-cat-design-9-p19-x2117` | Fluffy Friends: Sphynx Cat · Design 9 | Fluffy Friends: Sphynx Cat | 19 | 2117 | yes |
| `fluffy-friends-sphynx-cat-design-10-p19-x2128` | Fluffy Friends: Sphynx Cat · Design 10 | Fluffy Friends: Sphynx Cat | 19 | 2128 | yes |
| `fluffy-friends-sphynx-cat-design-11-p19-x2116` | Fluffy Friends: Sphynx Cat · Design 11 | Fluffy Friends: Sphynx Cat | 19 | 2116 | yes |
| `fluffy-friends-sphynx-cat-design-12-p19-x2129` | Fluffy Friends: Sphynx Cat · Design 12 | Fluffy Friends: Sphynx Cat | 19 | 2129 | yes |
| `fluffy-friends-sphynx-cat-design-13-p19-x2123` | Fluffy Friends: Sphynx Cat · Design 13 | Fluffy Friends: Sphynx Cat | 19 | 2123 | yes |
| `fluffy-friends-sphynx-cat-design-14-p19-x2125` | Fluffy Friends: Sphynx Cat · Design 14 | Fluffy Friends: Sphynx Cat | 19 | 2125 | yes |
| `fluffy-friends-sphynx-cat-design-15` | Fluffy Friends: Sphynx Cat · Design 15 | Fluffy Friends: Sphynx Cat | 19 | 2118 | yes |
| `fluffy-friends-sphynx-cat-design-16` | Fluffy Friends: Sphynx Cat · Design 16 | Fluffy Friends: Sphynx Cat | 19 | 2121 | yes |
| `fluffy-friends-sphynx-cat-design-17` | Fluffy Friends: Sphynx Cat · Design 17 | Fluffy Friends: Sphynx Cat | 19 | 2113 | yes |
| `fluffy-friends-sphynx-cat-design-18` | Fluffy Friends: Sphynx Cat · Design 18 | Fluffy Friends: Sphynx Cat | 19 | 2124 | yes |
| `moon-with-leaf` | Moon with Leaf | Above The Sky \| Sun, Moon & Angel | 20 | 2149 | no |
| `cupid` | Cupid | Above The Sky \| Sun, Moon & Angel | 20 | 2143 | no |
| `fine-line-with-sun-and-moon` | Fine Line with Sun and Moon | Above The Sky \| Sun, Moon & Angel | 20 | 2147 | no |
| `sleepy-angel` | Sleepy Angel | Above The Sky \| Sun, Moon & Angel | 20 | 2144 | no |
| `dream-angel` | Dream Angel | Above The Sky \| Sun, Moon & Angel | 20 | 2145 | no |
| `sun` | Sun | Above The Sky \| Sun, Moon & Angel | 20 | 2148 | no |
| `moonight` | Moonight | Above The Sky \| Sun, Moon & Angel | 20 | 2141 | no |
| `moon-with-fine-line` | Moon with Fine Line | Above The Sky \| Sun, Moon & Angel | 20 | 2140 | no |
| `sun-x-moon` | Sun x Moon | Above The Sky \| Sun, Moon & Angel | 20 | 2142 | no |
| `night-sky-moon` | Night Sky Moon | Above The Sky \| Sun, Moon & Angel | 20 | 2146 | no |
| `moon-x-sun` | Moon x Sun | Above The Sky \| Sun, Moon & Angel | 20 | 2139 | no |
| `butterfly-w-moon` | Butterfly w/ Moon | Metamorphosis \| Butterfly | 22 | 2175 | no |
| `butterflies-w-saturn-key-charm` | Butterflies w/ Saturn Key Charm] | Metamorphosis \| Butterfly | 22 | 2178 | no |
| `butterfly-saturn` | Butterfly Saturn | Metamorphosis \| Butterfly | 22 | 2179 | no |
| `simple-line-butterflies` | Simple Line Butterflies | Metamorphosis \| Butterfly | 22 | 2183 | no |
| `rose-w-butterfly` | Rose w/ Butterfly | Metamorphosis \| Butterfly | 22 | 2182 | no |
| `butterfly-w-heart` | Butterfly w/ Heart | Metamorphosis \| Butterfly | 22 | 2176 | no |
| `butterfly-w-stars` | Butterfly w/ Stars | Metamorphosis \| Butterfly | 22 | 2177 | no |
| `neo-tribal-butterfly` | Neo-Tribal Butterfly | Metamorphosis \| Butterfly | 22 | 2180 | no |
| `butterfly-w-smoke` | Butterfly w/ Smoke | Metamorphosis \| Butterfly | 22 | 2181 | no |
| `devil-heart` | Devil Heart | Sacred Pulse \| Hearts | 23 | 2192 | no |
| `plaster-with-heart-printed` | Plaster with Heart-printed | Sacred Pulse \| Hearts | 23 | 2196 | no |
| `heart-with-arrow` | Heart with Arrow | Sacred Pulse \| Hearts | 23 | 2197 | no |
| `eye-with-heart` | Eye with Heart | Sacred Pulse \| Hearts | 23 | 2194 | no |
| `heart-pattern-mushroom` | Heart Pattern Mushroom | Sacred Pulse \| Hearts | 23 | 2195 | no |
| `heart-shaped-clip` | Heart-shaped Clip | Sacred Pulse \| Hearts | 23 | 2198 | no |
| `heart-thorns` | Heart Thorns | Sacred Pulse \| Hearts | 23 | 2193 | no |
| `two-hearts-safety-pin` | Two Hearts Safety Pin | Sacred Pulse \| Hearts | 23 | 2199 | no |
| `two-hearts-saturn` | Two Hearts Saturn | Sacred Pulse \| Hearts | 24 | 2208 | no |
| `two-heart-lollipops` | Two Heart Lollipops | Sacred Pulse \| Hearts | 24 | 2211 | no |
| `heart-dice` | Heart Dice | Sacred Pulse \| Hearts | 24 | 2209 | no |
| `heart-lollipop` | Heart Lollipop | Sacred Pulse \| Hearts | 24 | 2212 | no |
| `heart-saturn` | Heart Saturn | Sacred Pulse \| Hearts | 24 | 2210 | no |
| `unicorn-balloon` | Unicorn Balloon | Happy Arcade \| Smileys & Toys | 25 | 2221 | no |
| `teddy-bear` | Teddy bear | Happy Arcade \| Smileys & Toys | 25 | 2222 | no |
| `maneki-neko` | Maneki-neko | Happy Arcade \| Smileys & Toys | 25 | 2226 | no |
| `dog-balloon` | Dog Balloon | Happy Arcade \| Smileys & Toys | 25 | 2223 | no |
| `teddy-bear-balloon` | Teddy Bear Balloon | Happy Arcade \| Smileys & Toys | 25 | 2224 | no |
| `ufo` | UFO | Happy Arcade \| Smileys & Toys | 25 | 2228 | no |
| `smile-sunflower-with-heart-eyes` | Smile Sunflower with heart eyes | Happy Arcade \| Smileys & Toys | 25 | 2227 | no |
| `cherries` | Cherries | Happy Arcade \| Smileys & Toys | 25 | 2225 | no |
| `melted-smile` | Melted Smile | Happy Arcade \| Smileys & Toys | 26 | 2241 | no |
| `ribbon` | Ribbon | Happy Arcade \| Smileys & Toys | 26 | 2237 | no |
| `melted-smile-1` | Melted Smile 1 | Happy Arcade \| Smileys & Toys | 26 | 2242 | no |
| `melted-smile-with-flowers` | Melted Smile with Flowers | Happy Arcade \| Smileys & Toys | 26 | 2238 | no |
| `smile-daisy-hair-clip` | Smile Daisy Hair Clip | Happy Arcade \| Smileys & Toys | 26 | 2243 | no |
| `smile-with-headphone` | Smile with Headphone | Happy Arcade \| Smileys & Toys | 26 | 2239 | no |
| `smile-sunflower` | Smile Sunflower | Happy Arcade \| Smileys & Toys | 26 | 2244 | no |
| `smile-shadow` | Smile Shadow | Happy Arcade \| Smileys & Toys | 26 | 2240 | no |
| `smile-daisy` | Smile Daisy | Happy Arcade \| Smileys & Toys | 26 | 2245 | no |
| `c-est-la-vie` | C'est La Vie | Script & Speak \| Wordings | 27 | 2259 | no |
| `artsy` | Artsy | Script & Speak \| Wordings | 27 | 2254 | no |
| `be-brave` | Be Brave | Script & Speak \| Wordings | 27 | 2255 | no |
| `dllm` | Dllm | Script & Speak \| Wordings | 27 | 2260 | no |
| `be-mine` | Be Mine | Script & Speak \| Wordings | 27 | 2256 | no |
| `dope` | Dope | Script & Speak \| Wordings | 27 | 2261 | no |
| `dream-it-live-it` | Dream It, Live It | Script & Speak \| Wordings | 27 | 2262 | no |
| `bite-me` | Bite Me | Script & Speak \| Wordings | 27 | 2263 | no |
| `family` | Family | Script & Speak \| Wordings | 27 | 2257 | no |
| `blessed` | Blessed | Script & Speak \| Wordings | 27 | 2258 | no |
| `hakuna-matata` | Hakuna Matata | Script & Speak \| Wordings | 28 | 2277 | no |
| `forever-young` | Forever Young | Script & Speak \| Wordings | 28 | 2273 | no |
| `imperfection` | Imperfection | Script & Speak \| Wordings | 28 | 2279 | no |
| `imp-rfection` | Imp rfection | Script & Speak \| Wordings | 28 | 2274 | no |
| `imp-rfection-p28-x2272` | Imp rfection | Script & Speak \| Wordings | 28 | 2272 | no |
| `imp-rfection-p28-x2281` | Imp rfection | Script & Speak \| Wordings | 28 | 2281 | no |
| `inspire` | Inspire | Script & Speak \| Wordings | 28 | 2278 | no |
| `go-with-the-flow` | Go with the Flow | Script & Speak \| Wordings | 28 | 2275 | no |
| `it-is-what-it-is` | It is what it is | Script & Speak \| Wordings | 28 | 2280 | no |
| `gwei-lo` | Gwei Lo | Script & Speak \| Wordings | 28 | 2276 | no |
| `live-laugh-love` | Live Laugh Love | Script & Speak \| Wordings | 29 | 2294 | no |
| `just-breathe` | Just Breathe | Script & Speak \| Wordings | 29 | 2297 | no |
| `karma` | Karma | Script & Speak \| Wordings | 29 | 2290 | no |
| `let-s-go` | Let's Go | Script & Speak \| Wordings | 29 | 2295 | no |
| `know-your-worth` | Know Your Worth | Script & Speak \| Wordings | 29 | 2291 | no |
| `lick-me` | Lick Me | Script & Speak \| Wordings | 29 | 2299 | no |
| `let-it-go-be` | Let It Go/Be | Script & Speak \| Wordings | 29 | 2292 | no |
| `love-heals` | Love Heals | Script & Speak \| Wordings | 29 | 2298 | no |
| `love` | Love | Script & Speak \| Wordings | 29 | 2293 | no |
| `nothing-to-lose` | Nothing to Lose | Script & Speak \| Wordings | 29 | 2296 | no |
| `no-ragrets` | No Ragrets | Script & Speak \| Wordings | 30 | 2315 | no |
| `simplicity` | Simplicity | Script & Speak \| Wordings | 30 | 2310 | no |
| `oh-yes` | Oh Yes | Script & Speak \| Wordings | 30 | 2314 | no |
| `stay-golden` | Stay Golden | Script & Speak \| Wordings | 30 | 2311 | no |
| `peace` | Peace | Script & Speak \| Wordings | 30 | 2313 | no |
| `self-love` | Self Love | Script & Speak \| Wordings | 30 | 2312 | no |
| `seek-the-unknown` | Seek the Unknown | Script & Speak \| Wordings | 30 | 2316 | no |
| `perspective` | Perspective | Script & Speak \| Wordings | 30 | 2308 | no |
| `rise-from-the-ashes` | Rise From The Ashes | Script & Speak \| Wordings | 30 | 2309 | no |
| `siuuuuuu` | SIUUUUUU! | Script & Speak \| Wordings | 30 | 2317 | no |
| `silent-but-violent` | Silent but Violent | Script & Speak \| Wordings | 31 | 2327 | no |
| `stay-wild` | Stay Wild | Script & Speak \| Wordings | 31 | 2328 | no |
| `trust-the-process` | Trust the Process | Script & Speak \| Wordings | 31 | 2329 | no |
| `yolo` | Yolo | Script & Speak \| Wordings | 31 | 2326 | no |
| `line-art-design-v-2` | Line Art Design v.2 | Sanskrit & Soul \| Fine Line Yogi | 32 | 2350 | no |
| `line-art-design-v-3` | Line Art Design v.3 | Sanskrit & Soul \| Fine Line Yogi | 32 | 2351 | no |
| `line-art-design-v-1` | Line Art Design v.1 | Sanskrit & Soul \| Fine Line Yogi | 32 | 2348 | no |
| `line-art-design-v-4` | Line Art Design v.4 | Sanskrit & Soul \| Fine Line Yogi | 32 | 2349 | no |
| `line-art-design-v-6` | Line Art Design v.6 | Sanskrit & Soul \| Fine Line Yogi | 32 | 2353 | no |
| `line-art-design-v-9` | Line Art Design v.9 | Sanskrit & Soul \| Fine Line Yogi | 33 | 2364 | no |
| `line-art-design-v-8` | Line Art Design v.8 | Sanskrit & Soul \| Fine Line Yogi | 33 | 2363 | no |
| `line-art-design-v-7` | Line Art Design v.7 | Sanskrit & Soul \| Fine Line Yogi | 33 | 2362 | no |
| `line-art-design-v-10` | Line Art Design v.10 | Sanskrit & Soul \| Fine Line Yogi | 33 | 2365 | no |
| `moon-with-fine-line-p33-x2368` | Moon with Fine Line | Sanskrit & Soul \| Fine Line Yogi | 33 | 2368 | no |
| `moon-x-sun-p33-x2367` | Moon x Sun | Sanskrit & Soul \| Fine Line Yogi | 33 | 2367 | no |
| `heart-and-eye` | Heart and Eye | Sanskrit & Soul \| Fine Line Yogi | 33 | 2366 | no |
| `fine-line-rose-1` | Fine Line Rose 1 | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2379 | no |
| `fine-line-rose` | Fine Line Rose | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2378 | no |
| `fine-line-rose-2` | Fine Line Rose 2 | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2380 | no |
| `fine-line-rose-4` | Fine Line Rose 4 | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2381 | no |
| `fine-line-rose-3` | Fine Line Rose 3 | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2377 | no |
| `fine-line-flower` | Fine Line Flower | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2383 | no |
| `floral-fine-line` | Floral Fine Line | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2382 | no |
| `fine-line-lotus` | Fine Line Lotus | Petal & Vine \| Fine Line Flowers & Leafs | 34 | 2384 | no |
| `fine-line-lilium` | Fine Line Lilium | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2393 | no |
| `moon-and-leaf` | Moon and Leaf | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2395 | no |
| `fine-line-tulip` | Fine Line Tulip | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2394 | no |
| `fine-line-leaf-1` | Fine Line Leaf 1 | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2396 | no |
| `fine-line-leaf-5` | Fine Line Leaf 5 | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2398 | no |
| `fine-line-leaf-2` | Fine Line Leaf 2 | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2397 | no |
| `fine-line-leaf-8` | Fine Line Leaf 8 | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2400 | no |
| `fine-line-leaf-6` | Fine Line Leaf 6 | Petal & Vine \| Fine Line Flowers & Leafs | 35 | 2399 | no |
| `swallow-v-1` | Swallow v.1 | Heritage Ink \| Old School | 36 | 2410 | no |
| `flower` | Flower | Heritage Ink \| Old School | 36 | 2409 | no |
| `fire` | Fire | Heritage Ink \| Old School | 36 | 2415 | no |
| `snake` | Snake | Heritage Ink \| Old School | 36 | 2414 | no |
| `eagle` | Eagle | Heritage Ink \| Old School | 36 | 2412 | no |
| `swallow-v-2` | Swallow v.2 | Heritage Ink \| Old School | 36 | 2411 | no |
| `tiger` | Tiger | Heritage Ink \| Old School | 36 | 2413 | no |
| `eagle-p36-x2416` | Eagle | Heritage Ink \| Old School | 36 | 2416 | no |
| `dragon-v-1` | Dragon v.1 | Heritage Ink \| Old School | 37 | 2426 | no |
| `dragon-v-3` | Dragon v.3 | Heritage Ink \| Old School | 37 | 2427 | no |
| `no-time` | No Time | Heritage Ink \| Old School | 37 | 2428 | no |
| `sunflower` | Sunflower | Heritage Ink \| Old School | 37 | 2429 | no |
| `dragon-v-2` | Dragon v.2 | Heritage Ink \| Old School | 37 | 2425 | no |
| `tigon-v-2` | Tigon v.2 | Wild Majesty \| Tiger & Lion | 38 | 2439 | no |
| `tigon-v-1` | Tigon v.1 | Wild Majesty \| Tiger & Lion | 38 | 2438 | no |
| `tigon-v-3` | Tigon v.3 | Wild Majesty \| Tiger & Lion | 38 | 2441 | no |
| `tigon-v-5` | Tigon v.5 | Wild Majesty \| Tiger & Lion | 38 | 2442 | no |
| `tigon-v-4` | Tigon v.4 | Wild Majesty \| Tiger & Lion | 38 | 2440 | no |
| `tigon-v-6` | Tigon v.6 | Wild Majesty \| Tiger & Lion | 39 | 2452 | no |
| `tigon-v-7` | Tigon v.7 | Wild Majesty \| Tiger & Lion | 39 | 2453 | no |
| `tigon-v-8` | Tigon v.8 | Wild Majesty \| Tiger & Lion | 39 | 2451 | no |
| `tigon-v-9` | Tigon v.9 | Wild Majesty \| Tiger & Lion | 39 | 2454 | no |
| `tigon-v-10` | Tigon v.10 | Wild Majesty \| Tiger & Lion | 39 | 2455 | no |
| `skull-x-drip` | Skull x Drip | Memento Mori \| Skull Art | 40 | 2465 | no |
| `skull-x-rose` | Skull x Rose | Memento Mori \| Skull Art | 40 | 2464 | no |
| `3-skulls` | 3 Skulls | Memento Mori \| Skull Art | 40 | 2466 | no |
| `skull-x-sword` | Skull x Sword | Memento Mori \| Skull Art | 40 | 2467 | no |
| `skull-v-1` | Skull v.1 | Memento Mori \| Skull Art | 40 | 2468 | no |
| `skull-v-2` | Skull v.2 | Memento Mori \| Skull Art | 40 | 2469 | no |
| `skull-v-3` | Skull v.3 | Memento Mori \| Skull Art | 40 | 2470 | no |
| `skull-v-4` | Skull v.4 | Memento Mori \| Skull Art | 41 | 2479 | no |
| `skull-v-5` | Skull v.5 | Memento Mori \| Skull Art | 41 | 2480 | no |
| `skull-v-6` | Skull v.6 | Memento Mori \| Skull Art | 41 | 2482 | no |
| `skull-v-7` | Skull v.7 | Memento Mori \| Skull Art | 41 | 2481 | no |
| `cow-skull` | Cow Skull | Memento Mori \| Skull Art | 41 | 2483 | no |
| `skull-cherries` | Skull Cherries | Memento Mori \| Skull Art | 41 | 2484 | no |
| `skull-w-heart-shaped-eyes` | Skull w/ Heart-shaped Eyes | Memento Mori \| Skull Art | 42 | 2493 | no |
| `dinosaur-fossils` | Dinosaur Fossils | Memento Mori \| Skull Art | 42 | 2494 | no |
| `rock-hand-w-fire` | Rock Hand w/ Fire | Memento Mori \| Skull Art | 42 | 2496 | no |
| `foot-bone` | Foot Bone | Memento Mori \| Skull Art | 42 | 2495 | no |
| `broken-bone` | Broken Bone | Memento Mori \| Skull Art | 42 | 2497 | no |
| `fish-bone` | Fish Bone | Memento Mori \| Skull Art | 42 | 2498 | no |
| `the-jade-dynasty-quintet-chinese-style` | The Jade Dynasty Quintet (Chinese Style) | The Composite Canvas Collection | 43 | 2508 | no |
| `the-jade-dynasty-quintet-chinese-style-p43-x2507` | The Jade Dynasty Quintet (Chinese Style) | The Composite Canvas Collection | 43 | 2507 | no |
| `the-cyber-butterfly-synthesis-y2k-style` | The Cyber Butterfly Synthesis (Y2K Style) | The Composite Canvas Collection | 43 | 2509 | no |
| `the-sacred-nexus-ornamental-style` | The Sacred Nexus (Ornamental Style) | The Composite Canvas Collection | 43 | 2510 | no |
| `butterfly-effect` | Butterfly Effect | The Living Gallery \| Artist Sandra | 44 | 2520 | no |
| `avatar` | Avatar | The Living Gallery \| Artist Sandra | 44 | 2523 | no |
| `noble` | Noble | The Living Gallery \| Artist Sandra | 44 | 2519 | no |
| `imply` | Imply | The Living Gallery \| Artist Sandra | 44 | 2521 | no |
| `mind` | Mind | The Living Gallery \| Artist Sandra | 44 | 2524 | no |
| `mask` | Mask | The Living Gallery \| Artist Sandra | 44 | 2522 | no |
| `daruma-doll` | Daruma Doll | The Living Gallery \| Artist TJ | 45 | 2535 | no |
| `kitsune-mask` | Kitsune Mask | The Living Gallery \| Artist TJ | 45 | 2534 | no |
| `lotus-omamori` | Lotus Omamori | The Living Gallery \| Artist TJ | 45 | 2536 | no |
| `chrysanthemun-chinese-fan` | Chrysanthemun Chinese Fan | The Living Gallery \| Artist TJ | 45 | 2537 | no |
| `heart-with-chrysanthemun` | Heart with Chrysanthemun | The Living Gallery \| Artist TJ | 45 | 2533 | no |
| `red-chrysanthemun` | Red Chrysanthemun | The Living Gallery \| Artist TJ | 45 | 2538 | no |
| `magician` | Magician | The Living Gallery \| Artist Brian | 46 | 2547 | no |
| `performers` | Performers | The Living Gallery \| Artist Brian | 46 | 2548 | no |
| `obe` | Obe | The Living Gallery \| Artist Brian | 46 | 2550 | no |
| `tamer` | Tamer | The Living Gallery \| Artist Brian | 46 | 2549 | no |
| `workers` | Workers | The Living Gallery \| Artist Brian | 46 | 2552 | no |
| `witch` | Witch | The Living Gallery \| Artist Brian | 46 | 2551 | no |
| `the-beautiful-game-design-1` | The Beautiful Game · Design 1 | The Beautiful Game | 47 | 2571 | yes |
| `the-beautiful-game-design-2` | The Beautiful Game · Design 2 | The Beautiful Game | 47 | 2561 | yes |
| `the-beautiful-game-design-3` | The Beautiful Game · Design 3 | The Beautiful Game | 47 | 2568 | yes |
| `the-beautiful-game-design-4` | The Beautiful Game · Design 4 | The Beautiful Game | 47 | 2569 | yes |
| `the-beautiful-game-design-5` | The Beautiful Game · Design 5 | The Beautiful Game | 47 | 2566 | yes |
| `the-beautiful-game-design-6` | The Beautiful Game · Design 6 | The Beautiful Game | 47 | 2562 | yes |
| `the-beautiful-game-design-7` | The Beautiful Game · Design 7 | The Beautiful Game | 47 | 2565 | yes |
| `the-beautiful-game-design-8` | The Beautiful Game · Design 8 | The Beautiful Game | 47 | 2570 | yes |
| `the-beautiful-game-design-9` | The Beautiful Game · Design 9 | The Beautiful Game | 47 | 2564 | yes |
| `the-beautiful-game-design-10` | The Beautiful Game · Design 10 | The Beautiful Game | 47 | 2567 | yes |
| `the-beautiful-game-design-11` | The Beautiful Game · Design 11 | The Beautiful Game | 47 | 2563 | yes |
| `the-beautiful-game-design-1-p48-x2588` | The Beautiful Game · Design 1 | The Beautiful Game | 48 | 2588 | yes |
| `the-beautiful-game-design-2-p48-x2581` | The Beautiful Game · Design 2 | The Beautiful Game | 48 | 2581 | yes |
| `the-beautiful-game-design-3-p48-x2584` | The Beautiful Game · Design 3 | The Beautiful Game | 48 | 2584 | yes |
| `the-beautiful-game-design-4-p48-x2585` | The Beautiful Game · Design 4 | The Beautiful Game | 48 | 2585 | yes |
| `the-beautiful-game-design-5-p48-x2587` | The Beautiful Game · Design 5 | The Beautiful Game | 48 | 2587 | yes |
| `the-beautiful-game-design-6-p48-x2586` | The Beautiful Game · Design 6 | The Beautiful Game | 48 | 2586 | yes |
| `the-beautiful-game-design-7-p48-x2580` | The Beautiful Game · Design 7 | The Beautiful Game | 48 | 2580 | yes |
| `the-beautiful-game-design-8-p48-x2582` | The Beautiful Game · Design 8 | The Beautiful Game | 48 | 2582 | yes |
| `the-beautiful-game-design-9-p48-x2583` | The Beautiful Game · Design 9 | The Beautiful Game | 48 | 2583 | yes |
| `the-beautiful-game-design-10-p48-x2589` | The Beautiful Game · Design 10 | The Beautiful Game | 48 | 2589 | yes |
| `the-beautiful-game-design-1-p49-x2600` | The Beautiful Game · Design 1 | The Beautiful Game | 49 | 2600 | yes |
| `the-beautiful-game-design-2-p49-x2598` | The Beautiful Game · Design 2 | The Beautiful Game | 49 | 2598 | yes |
| `the-beautiful-game-design-3-p49-x2602` | The Beautiful Game · Design 3 | The Beautiful Game | 49 | 2602 | yes |
| `the-beautiful-game-design-4-p49-x2599` | The Beautiful Game · Design 4 | The Beautiful Game | 49 | 2599 | yes |
| `the-beautiful-game-design-5-p49-x2605` | The Beautiful Game · Design 5 | The Beautiful Game | 49 | 2605 | yes |
| `the-beautiful-game-design-6-p49-x2604` | The Beautiful Game · Design 6 | The Beautiful Game | 49 | 2604 | yes |
| `the-beautiful-game-design-7-p49-x2601` | The Beautiful Game · Design 7 | The Beautiful Game | 49 | 2601 | yes |
| `the-beautiful-game-design-8-p49-x2603` | The Beautiful Game · Design 8 | The Beautiful Game | 49 | 2603 | yes |
| `the-beautiful-game-design-9-p49-x2607` | The Beautiful Game · Design 9 | The Beautiful Game | 49 | 2607 | yes |
| `the-beautiful-game-design-10-p49-x2606` | The Beautiful Game · Design 10 | The Beautiful Game | 49 | 2606 | yes |
| `the-7s-game-design-1` | The 7s Game · Design 1 | The 7s Game | 50 | 2616 | yes |
| `the-7s-game-design-2` | The 7s Game · Design 2 | The 7s Game | 50 | 2620 | yes |
| `the-7s-game-design-3` | The 7s Game · Design 3 | The 7s Game | 50 | 2619 | yes |
| `the-7s-game-design-4` | The 7s Game · Design 4 | The 7s Game | 50 | 2617 | yes |
| `the-7s-game-design-5` | The 7s Game · Design 5 | The 7s Game | 50 | 2618 | yes |
| `red-target` | Red target | Spooky Collection | 51 | 2631 | no |
| `teardrop` | Teardrop | Spooky Collection | 51 | 2630 | no |
| `downcross` | Downcross | Spooky Collection | 51 | 2629 | no |
| `blood-splash-medium` | Blood splash Medium | Spooky Collection | 51 | 2632 | no |
| `eye-symbol-alien` | Eye Symbol (alien) | Spooky Collection | 51 | 2633 | no |
| `eye-symbol-human` | Eye symbol (human) | Spooky Collection | 51 | 2634 | no |
| `hypno-eye` | Hypno eye | Spooky Collection | 51 | 2635 | no |
| `sword` | Sword | Spooky Collection | 51 | 2636 | no |
| `safety-pin` | Safety pin | Spooky Collection | 51 | 2637 | no |
| `red-scar` | Red scar | Spooky Collection | 52 | 2653 | no |
| `joker-smile` | Joker smile | Spooky Collection | 52 | 2650 | no |
| `vampire-teeth` | Vampire teeth | Spooky Collection | 52 | 2646 | no |
| `haha-why-so-serious` | Haha why so serious | Spooky Collection | 52 | 2654 | no |
| `snake-thin-line` | Snake (Thin line) | Spooky Collection | 52 | 2651 | no |
| `centipede` | Centipede | Spooky Collection | 52 | 2648 | no |
| `spider` | Spider | Spooky Collection | 52 | 2652 | no |
| `red-sigil` | Red sigil | Spooky Collection | 52 | 2649 | no |
| `blood-splash-large` | Blood splash Large | Spooky Collection | 52 | 2647 | no |
| `festive-ornaments` | Festive Ornaments | Christmas Collection | 53 | 2665 | no |
| `santa-and-cane` | Santa & Cane | Christmas Collection | 53 | 2663 | no |
| `adorned-deer` | Adorned Deer | Christmas Collection | 53 | 2664 | no |
| `deer-and-poinsettia` | Deer & Poinsettia | Christmas Collection | 53 | 2666 | no |
| `frostys-follies` | Frosty’s Follies | Christmas Collection | 53 | 2667 | no |
| `the-yuletide-wolf` | The Yuletide Wolf | Christmas Collection | 54 | 2677 | no |
| `evergreen-forst` | Evergreen Forst | Christmas Collection | 54 | 2680 | no |
| `naughty-nice` | Naughty Nice | Christmas Collection | 54 | 2676 | no |
| `midnight-sleigh` | Midnight Sleigh | Christmas Collection | 54 | 2679 | no |
| `the-grand-frost` | The Grand Frost | Christmas Collection | 54 | 2678 | no |
