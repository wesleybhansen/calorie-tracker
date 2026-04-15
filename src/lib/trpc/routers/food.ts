import { z } from "zod";
import { eq, ilike, and, desc, inArray } from "drizzle-orm";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import {
  foodItems,
  mealLogEntries,
  mealLogs,
} from "@/db/schema";
import {
  searchUSDA as searchUSDAApi,
  getOpenFoodFactsByBarcode,
  getUSDAByBarcode,
  type NormalizedFood,
} from "@/lib/food-apis";

export const foodRouter = createTRPCRouter({
  // ─── search local food_items ───────────────────────────────────
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().positive().optional().default(20),
        sharedOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Escape SQL LIKE pattern characters in user input
      const escapedQuery = input.query.replace(/[%_\\]/g, "\\$&");
      const conditions = [ilike(foodItems.name, `%${escapedQuery}%`)];
      if (input.sharedOnly) {
        conditions.push(eq(foodItems.isShared, true));
      }
      const results = await ctx.db
        .select()
        .from(foodItems)
        .where(and(...conditions))
        .limit(input.limit);

      return results;
    }),

  // ─── get by barcode (local first, then Open Food Facts) ────────
  getByBarcode: protectedProcedure
    .input(z.object({ barcode: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Check local DB first
      const [local] = await ctx.db
        .select()
        .from(foodItems)
        .where(eq(foodItems.barcode, input.barcode))
        .limit(1);

      if (local) return local;

      // Query Open Food Facts and USDA Branded in parallel, then pick the
      // result with the most complete nutrition data. OFF has broader barcode
      // coverage but often has zero/missing nutrients; USDA Branded has
      // cleaner data but smaller catalog.
      const [offResult, usdaResult] = await Promise.allSettled([
        getOpenFoodFactsByBarcode(input.barcode),
        getUSDAByBarcode(input.barcode),
      ]);

      const off = offResult.status === "fulfilled" ? offResult.value : null;
      const usda = usdaResult.status === "fulfilled" ? usdaResult.value : null;

      const score = (f: NormalizedFood | null): number => {
        if (!f) return -1;
        let s = 0;
        if (f.calories > 0) s += 10;
        if (f.proteinG > 0) s += 2;
        if (f.carbsG > 0) s += 2;
        if (f.fatG > 0) s += 2;
        if (f.name && f.name !== "Unknown Product") s += 1;
        return s;
      };

      const pick: { food: NormalizedFood; source: string } | null =
        score(usda) > score(off)
          ? usda
            ? { food: usda, source: "usda" }
            : null
          : off
            ? { food: off, source: "openfoodfacts" }
            : null;

      if (!pick) return null;

      // Cache in local DB so repeat scans are instant.
      const [inserted] = await ctx.db
        .insert(foodItems)
        .values({
          name: pick.food.name,
          brand: pick.food.brand,
          barcode: pick.food.barcode ?? input.barcode,
          calories: pick.food.calories.toString(),
          proteinG: pick.food.proteinG.toString(),
          carbsG: pick.food.carbsG.toString(),
          fatG: pick.food.fatG.toString(),
          fiberG: pick.food.fiberG.toString(),
          sugarG: pick.food.sugarG.toString(),
          sodiumMg: pick.food.sodiumMg.toString(),
          servingSize: pick.food.servingSize,
          servingUnit: pick.food.servingUnit,
          source: pick.source,
          sourceId: pick.food.sourceId,
          createdBy: ctx.user.id,
        })
        .returning();

      return inserted;
    }),

  // ─── search USDA FoodData Central ──────────────────────────────
  searchUSDA: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const results = await searchUSDAApi(input.query);
      return results;
    }),

  // ─── get recent (last 12 logged food items) ────────────────────
  getRecent: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinctOn([foodItems.id], {
        foodItem: foodItems,
        loggedAt: mealLogEntries.createdAt,
      })
      .from(mealLogEntries)
      .innerJoin(mealLogs, eq(mealLogEntries.mealLogId, mealLogs.id))
      .innerJoin(foodItems, eq(mealLogEntries.foodItemId, foodItems.id))
      .where(eq(mealLogs.userId, ctx.user.id))
      .orderBy(foodItems.id, desc(mealLogEntries.createdAt))
      .limit(12);

    // Re-sort by most recent logged time
    rows.sort((a, b) => {
      const aTime = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
      const bTime = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
      return bTime - aTime;
    });

    return rows.map((r) => r.foodItem);
  }),

  // ─── get favorites (user-created custom food items) ────────────
  getFavorites: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select()
      .from(foodItems)
      .where(
        and(
          eq(foodItems.createdBy, ctx.user.id),
          inArray(foodItems.source, ["custom", "ai_photo"]),
        ),
      )
      .orderBy(desc(foodItems.createdAt));

    return results;
  }),

  // ─── create a food item ────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        brand: z.string().optional(),
        barcode: z.string().optional(),
        calories: z.number().optional(),
        proteinG: z.number().optional(),
        carbsG: z.number().optional(),
        fatG: z.number().optional(),
        fiberG: z.number().optional(),
        sugarG: z.number().optional(),
        sodiumMg: z.number().optional(),
        servingSize: z.string().optional(),
        servingUnit: z.string().optional(),
        source: z.string().optional().default("custom"),
        sourceId: z.string().optional(),
        imageUrl: z.string().optional(),
        isShared: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(foodItems)
        .values({
          name: input.name,
          brand: input.brand,
          barcode: input.barcode,
          calories: input.calories?.toString(),
          proteinG: input.proteinG?.toString(),
          carbsG: input.carbsG?.toString(),
          fatG: input.fatG?.toString(),
          fiberG: input.fiberG?.toString(),
          sugarG: input.sugarG?.toString(),
          sodiumMg: input.sodiumMg?.toString(),
          servingSize: input.servingSize,
          servingUnit: input.servingUnit,
          source: input.source,
          sourceId: input.sourceId,
          imageUrl: input.imageUrl,
          isShared: input.isShared,
          createdBy: ctx.user.id,
        })
        .returning();

      return created;
    }),
});
