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
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: USDANutrient[];
}

function extractUSDANutrient(nutrients: USDANutrient[], id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

export async function searchUSDA(query: string): Promise<NormalizedFood[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("api_key", process.env.USDA_API_KEY ?? "DEMO_KEY");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`USDA API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { foods: USDAFoodItem[] };

  return (data.foods ?? []).map((food) => ({
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
    barcode: null,
    sourceId: food.fdcId.toString(),
  }));
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
    `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(barcode)}`,
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
