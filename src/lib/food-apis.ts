// Normalized food data format returned by external API helpers
export interface NormalizedFood {
  name: string;
  brand: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  servingSize: string | null;
  servingUnit: string | null;
  barcode: string | null;
  sourceId: string | null;
}

// ─── USDA FoodData Central ─────────────────────────────────────────

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface USDAFoodItem {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  gtinUpc?: string;
  foodNutrients: USDANutrient[];
}

function extractUSDANutrient(nutrients: USDANutrient[], id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

function normalizeUSDA(food: USDAFoodItem): NormalizedFood {
  return {
    name: food.description,
    brand: food.brandName ?? food.brandOwner ?? null,
    calories: extractUSDANutrient(food.foodNutrients, 1008),
    proteinG: extractUSDANutrient(food.foodNutrients, 1003),
    fatG: extractUSDANutrient(food.foodNutrients, 1004),
    carbsG: extractUSDANutrient(food.foodNutrients, 1005),
    fiberG: extractUSDANutrient(food.foodNutrients, 1079),
    sugarG: extractUSDANutrient(food.foodNutrients, 2000),
    sodiumMg: extractUSDANutrient(food.foodNutrients, 1093),
    servingSize: food.servingSize?.toString() ?? null,
    servingUnit: food.servingSizeUnit ?? null,
    barcode: food.gtinUpc ?? null,
    sourceId: food.fdcId.toString(),
  };
}

// Score a result against the query: higher is better.
// Exact > starts-with > whole-word match > substring > no match.
function relevanceScore(description: string, query: string): number {
  const d = description.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (d === q) return 100;
  if (d.startsWith(q + " ") || d.startsWith(q + ",")) return 80;
  if (d.startsWith(q)) return 70;
  // Whole-word match: all query words appear as separate tokens
  const words = new Set(d.split(/[^a-z0-9]+/).filter(Boolean));
  const qWords = q.split(/[^a-z0-9]+/).filter(Boolean);
  const wholeWordHits = qWords.filter((w) => words.has(w)).length;
  if (wholeWordHits === qWords.length) return 50 + wholeWordHits;
  if (d.includes(q)) return 30;
  return wholeWordHits * 5;
}

// Data-type priority: Foundation (whole foods w/ rich data) > SR Legacy > Branded > Survey.
function dataTypeBonus(dataType?: string): number {
  switch (dataType) {
    case "Foundation":
      return 8;
    case "SR Legacy":
      return 6;
    case "Branded":
      return 4;
    case "Survey (FNDDS)":
      return 2;
    default:
      return 0;
  }
}

async function fetchUSDA(
  query: string,
  dataTypes: string[],
  pageSize: number,
): Promise<USDAFoodItem[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", pageSize.toString());
  for (const dt of dataTypes) url.searchParams.append("dataType", dt);
  url.searchParams.set("api_key", process.env.USDA_API_KEY ?? "DEMO_KEY");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(
        `[fetchUSDA] ${res.status} ${res.statusText} for ${dataTypes.join(",")} — key=${process.env.USDA_API_KEY ? "set" : "MISSING"}`,
      );
      return [];
    }
    const data = (await res.json()) as { foods?: USDAFoodItem[] };
    return data.foods ?? [];
  } catch (err) {
    console.error("[fetchUSDA] fetch failed", err);
    return [];
  }
}

export async function searchUSDA(query: string): Promise<NormalizedFood[]> {
  // Split into two parallel queries: whole-foods (Foundation, SR Legacy,
  // Survey) get their own slots, so basic items like "banana" or "egg"
  // aren't buried under thousands of branded products that happen to
  // contain the word.
  const [wholeFoods, branded] = await Promise.all([
    fetchUSDA(query, ["Foundation", "SR Legacy", "Survey (FNDDS)"], 25),
    fetchUSDA(query, ["Branded"], 25),
  ]);

  const rank = (foods: USDAFoodItem[]) =>
    foods
      .map((f) => ({
        food: f,
        score: relevanceScore(f.description, query) + dataTypeBonus(f.dataType),
      }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.food);

  const rankedWhole = rank(wholeFoods);
  const rankedBranded = rank(branded);

  // Interleave: whole-foods first (up to 10), then branded fills the rest.
  const combined = [...rankedWhole.slice(0, 10), ...rankedBranded];

  const seen = new Set<string>();
  const deduped: USDAFoodItem[] = [];
  for (const food of combined) {
    const key = `${food.description.toLowerCase()}|${(food.brandName ?? food.brandOwner ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(food);
    if (deduped.length >= 30) break;
  }

  return deduped.map(normalizeUSDA);
}

// Look up a branded product in USDA by its GTIN/UPC barcode.
// USDA stores GTIN-14; consumer UPC-A codes (12 digits) are often padded with
// leading zeros, so we match on the normalized numeric tail.
export async function getUSDAByBarcode(
  barcode: string,
): Promise<NormalizedFood | null> {
  const normalized = barcode.replace(/^0+/, "");
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", barcode);
  url.searchParams.set("dataType", "Branded");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("api_key", process.env.USDA_API_KEY ?? "DEMO_KEY");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as { foods: USDAFoodItem[] };
  const match = (data.foods ?? []).find((f) => {
    if (!f.gtinUpc) return false;
    const g = f.gtinUpc.replace(/^0+/, "").trim();
    return g === normalized || g === barcode;
  });

  return match ? normalizeUSDA(match) : null;
}

// ─── Open Food Facts ───────────────────────────────────────────────

interface OFFProduct {
  product_name?: string;
  brands?: string;
  code?: string;
  nutriments?: Record<string, number>;
  serving_quantity?: string;
  serving_size?: string;
}

export async function getOpenFoodFactsByBarcode(
  barcode: string,
): Promise<NormalizedFood | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    { headers: { "User-Agent": "CalorieTracker/1.0 (wesley.b.hansen@gmail.com)" } },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { status: number; product?: OFFProduct };
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};

  return {
    name: p.product_name ?? "Unknown Product",
    brand: p.brands ?? null,
    calories: n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0,
    proteinG: n["proteins_100g"] ?? n["proteins"] ?? 0,
    fatG: n["fat_100g"] ?? n["fat"] ?? 0,
    carbsG: n["carbohydrates_100g"] ?? n["carbohydrates"] ?? 0,
    fiberG: n["fiber_100g"] ?? n["fiber"] ?? 0,
    sugarG: n["sugars_100g"] ?? n["sugars"] ?? 0,
    sodiumMg: (n["sodium_100g"] ?? n["sodium"] ?? 0) * 1000, // g → mg
    servingSize: p.serving_quantity ?? null,
    servingUnit: p.serving_size ?? null,
    barcode: p.code ?? barcode,
    sourceId: p.code ?? barcode,
  };
}
