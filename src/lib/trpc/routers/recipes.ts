import { z } from "zod";
import { eq, or, and, ilike, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import {
  recipes,
  recipeIngredients,
  foodItems,
  mealLogs,
  mealLogEntries,
} from "@/db/schema";

// ─── helpers ────────────────────────────────────────────────────
function computeNutrition(
  ingredients: {
    quantity: string | null;
    foodItem: {
      calories: string | null;
      proteinG: string | null;
      carbsG: string | null;
      fatG: string | null;
      fiberG: string | null;
      servingSize: string | null;
    };
  }[],
) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const ing of ingredients) {
    const qty = Number(ing.quantity ?? 1);
    const servingSize = Number(ing.foodItem.servingSize ?? 1) || 1;
    const ratio = qty / servingSize;

    totalCalories += Number(ing.foodItem.calories ?? 0) * ratio;
    totalProtein += Number(ing.foodItem.proteinG ?? 0) * ratio;
    totalCarbs += Number(ing.foodItem.carbsG ?? 0) * ratio;
    totalFat += Number(ing.foodItem.fatG ?? 0) * ratio;
    totalFiber += Number(ing.foodItem.fiberG ?? 0) * ratio;
  }

  return { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber };
}

// ─── ingredient input schema ────────────────────────────────────
const ingredientSchema = z.object({
  foodItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string(),
});

export const recipesRouter = createTRPCRouter({
  // ─── list ───────────────────────────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db.query.recipes.findMany({
      where: or(
        eq(recipes.userId, ctx.user.id),
        eq(recipes.isShared, true),
      ),
      with: {
        ingredients: {
          with: {
            foodItem: true,
          },
        },
      },
      orderBy: [desc(recipes.updatedAt)],
    });

    return results.map((r) => {
      const servings = Number(r.servings ?? 1) || 1;
      const nutrition = computeNutrition(r.ingredients);
      return {
        ...r,
        totalCalories: Math.round(nutrition.totalCalories),
        totalProtein: Math.round(nutrition.totalProtein),
        totalCarbs: Math.round(nutrition.totalCarbs),
        totalFat: Math.round(nutrition.totalFat),
        totalFiber: Math.round(nutrition.totalFiber),
        caloriesPerServing: Math.round(nutrition.totalCalories / servings),
        proteinPerServing: Math.round(nutrition.totalProtein / servings),
        carbsPerServing: Math.round(nutrition.totalCarbs / servings),
        fatPerServing: Math.round(nutrition.totalFat / servings),
      };
    });
  }),

  // ─── getById ────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const recipe = await ctx.db.query.recipes.findFirst({
        where: eq(recipes.id, input.id),
        with: {
          ingredients: {
            with: {
              foodItem: true,
            },
          },
        },
      });

      if (!recipe) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found." });
      }

      // Verify access: owner or shared
      if (recipe.userId !== ctx.user.id && !recipe.isShared) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
      }

      const servings = Number(recipe.servings ?? 1) || 1;
      const nutrition = computeNutrition(recipe.ingredients);

      return {
        ...recipe,
        totalCalories: Math.round(nutrition.totalCalories),
        totalProtein: Math.round(nutrition.totalProtein),
        totalCarbs: Math.round(nutrition.totalCarbs),
        totalFat: Math.round(nutrition.totalFat),
        totalFiber: Math.round(nutrition.totalFiber),
        caloriesPerServing: Math.round(nutrition.totalCalories / servings),
        proteinPerServing: Math.round(nutrition.totalProtein / servings),
        carbsPerServing: Math.round(nutrition.totalCarbs / servings),
        fatPerServing: Math.round(nutrition.totalFat / servings),
      };
    }),

  // ─── create ─────────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        servings: z.number().int().positive().default(1),
        prepTimeMin: z.number().int().nonnegative().optional(),
        cookTimeMin: z.number().int().nonnegative().optional(),
        isShared: z.boolean().optional().default(false),
        ingredients: z.array(ingredientSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Transaction: create recipe + ingredients
      const [recipe] = await ctx.db
        .insert(recipes)
        .values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          servings: input.servings.toString(),
          prepTimeMin: input.prepTimeMin,
          cookTimeMin: input.cookTimeMin,
          isShared: input.isShared,
        })
        .returning();

      if (input.ingredients.length > 0) {
        await ctx.db.insert(recipeIngredients).values(
          input.ingredients.map((ing) => ({
            recipeId: recipe.id,
            foodItemId: ing.foodItemId,
            quantity: ing.quantity.toString(),
            unit: ing.unit,
          })),
        );
      }

      return recipe;
    }),

  // ─── update ─────────────────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        servings: z.number().int().positive().default(1),
        prepTimeMin: z.number().int().nonnegative().optional(),
        cookTimeMin: z.number().int().nonnegative().optional(),
        isShared: z.boolean().optional().default(false),
        ingredients: z.array(ingredientSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await ctx.db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, input.id), eq(recipes.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found." });
      }

      // Update recipe
      const [updated] = await ctx.db
        .update(recipes)
        .set({
          name: input.name,
          description: input.description,
          servings: input.servings.toString(),
          prepTimeMin: input.prepTimeMin,
          cookTimeMin: input.cookTimeMin,
          isShared: input.isShared,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, input.id))
        .returning();

      // Replace ingredients: delete old, insert new
      await ctx.db
        .delete(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, input.id));

      if (input.ingredients.length > 0) {
        await ctx.db.insert(recipeIngredients).values(
          input.ingredients.map((ing) => ({
            recipeId: input.id,
            foodItemId: ing.foodItemId,
            quantity: ing.quantity.toString(),
            unit: ing.unit,
          })),
        );
      }

      return updated;
    }),

  // ─── delete ─────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, input.id), eq(recipes.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found." });
      }

      // Cascade deletes ingredients via DB constraint
      await ctx.db.delete(recipes).where(eq(recipes.id, input.id));

      return { success: true };
    }),

  // ─── addToMeal ──────────────────────────────────────────────────
  addToMeal: protectedProcedure
    .input(
      z.object({
        recipeId: z.string().uuid(),
        date: z.string(),
        mealType: z.string(),
        servings: z.number().positive().default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get recipe with ingredients
      const recipe = await ctx.db.query.recipes.findFirst({
        where: eq(recipes.id, input.recipeId),
        with: {
          ingredients: {
            with: {
              foodItem: true,
            },
          },
        },
      });

      if (!recipe) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found." });
      }

      const recipeServings = Number(recipe.servings ?? 1) || 1;
      const nutrition = computeNutrition(recipe.ingredients);

      // Compute per-serving nutrition * requested servings
      const cals = Math.round((nutrition.totalCalories / recipeServings) * input.servings);
      const protein = Math.round((nutrition.totalProtein / recipeServings) * input.servings);
      const carbs = Math.round((nutrition.totalCarbs / recipeServings) * input.servings);
      const fat = Math.round((nutrition.totalFat / recipeServings) * input.servings);
      const fiber = Math.round((nutrition.totalFiber / recipeServings) * input.servings);

      // Find or create meal_log
      let [mealLog] = await ctx.db
        .select()
        .from(mealLogs)
        .where(
          and(
            eq(mealLogs.userId, ctx.user.id),
            eq(mealLogs.date, input.date),
            eq(mealLogs.mealType, input.mealType),
          ),
        )
        .limit(1);

      if (!mealLog) {
        [mealLog] = await ctx.db
          .insert(mealLogs)
          .values({
            userId: ctx.user.id,
            date: input.date,
            mealType: input.mealType,
          })
          .returning();
      }

      // Insert entry
      const [entry] = await ctx.db
        .insert(mealLogEntries)
        .values({
          mealLogId: mealLog.id,
          recipeId: input.recipeId,
          servings: input.servings.toString(),
          calories: cals.toString(),
          proteinG: protein.toString(),
          carbsG: carbs.toString(),
          fatG: fat.toString(),
          fiberG: fiber.toString(),
        })
        .returning();

      return entry;
    }),
});
