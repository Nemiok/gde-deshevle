import stringSimilarity from 'string-similarity';

/**
 * Product name normalizer.
 *
 * Takes a raw store product name and attempts to match it to a canonical
 * product in our database using fuzzy string matching.
 *
 * The normalizer:
 *  1. Cleans up the raw name (lower-case, strip punctuation, collapse spaces)
 *  2. Scores it against every canonical product name
 *  3. Returns the best match above the similarity threshold, or null
 */

export interface NormalizedMatch {
  productId: number;
  productName: string;
  similarity: number;
}

export interface CanonicalProduct {
  id: number;
  name: string;
  aliases: string[];
}

/** Minimum similarity score (0–1) to accept a match */
const SIMILARITY_THRESHOLD = 0.65;

/**
 * Normalize a raw store name to lower-case ASCII-ish form for comparison.
 */
export function normalizeForComparison(raw: string): string {
  return raw
    .toLowerCase()
    // Remove weight/volume/package suffixes: "1 кг", "500 г", "1.5 л", "12x100мл", etc.
    .replace(/\d+[\.,]?\d*\s*(кг|г|л|мл|шт|уп|пач|пак|x|×)\s*(\d+\s*(мл|г|кг|л))?/gi, '')
    .replace(/[^а-яёa-z0-9\s]/gi, ' ')  // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best canonical product match for a raw store product name.
 *
 * @param rawName      Raw product name from the store
 * @param canonicals   Array of canonical products to match against
 * @returns            Best match above threshold, or null
 */
export function findBestMatch(
  rawName: string,
  canonicals: CanonicalProduct[],
): NormalizedMatch | null {
  const normalizedRaw = normalizeForComparison(rawName);
  if (!normalizedRaw) return null;

  let bestMatch: NormalizedMatch | null = null;

  for (const canonical of canonicals) {
    // Score against canonical name AND all aliases
    const candidates = [
      normalizeForComparison(canonical.name),
      ...canonical.aliases.map(normalizeForComparison),
    ].filter(Boolean);

    // Pick the best score from this canonical's candidates
    const scores = candidates.map((c) =>
      stringSimilarity.compareTwoStrings(normalizedRaw, c),
    );
    const topScore = Math.max(...scores);

    if (topScore >= SIMILARITY_THRESHOLD) {
      if (!bestMatch || topScore > bestMatch.similarity) {
        bestMatch = {
          productId: canonical.id,
          productName: canonical.name,
          similarity: topScore,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Batch-match an array of raw store names against canonical products.
 *
 * Returns a Map from rawName → NormalizedMatch (or null if no match found).
 */
export function batchMatch(
  rawNames: string[],
  canonicals: CanonicalProduct[],
): Map<string, NormalizedMatch | null> {
  const results = new Map<string, NormalizedMatch | null>();
  for (const raw of rawNames) {
    results.set(raw, findBestMatch(raw, canonicals));
  }
  return results;
}
