import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import {
  foodItems,
  mealLogs,
  mealLogEntries,
} from "@/db/schema";

export const mealsRouter = createTRPCRouter({
  // ─── get meals by date (grouped by meal_type) ──────────────────
  getByDate: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.query.mealLogs.findMany({
        where: and(
          eq(mealLogs.userId, ctx.user.id),
          eq(mealLogs.date, input.date),
        ),
        with: {
          entries: {
            with: {
              foodItem: true,
              recipe: true,
            },
          },
        },
        orderBy: [desc(mealLogs.loggedAt)],
      });

      // Group by mealType
      const grouped: Record<
        string,
        typeof logs
      > = {};

      for (const log of logs) {
        const key = log.mealType ?? "Other";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(log);
      }

      return grouped;
    }),

  // ─── log a meal entry ──────────────────────────────────────────
  logEntry: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        mealType: z.string(),
        foodItemId: z.string().uuid().optional(),
        recipeId: z.string().uuid().optional(),
        servings: z.number().positive().default(1),
        calories: z.number(),
        proteinG: z.number().optional(),
        carbsG: z.number().optional(),
        fatG: z.number().optional(),
        fiberG: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find or create meal_log for this user/date/mealType
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

      // Insert the entry
      const [entry] = await ctx.db
        .insert(mealLogEntries)
        .values({
          mealLogId: mealLog.id,
          foodItemId: input.foodItemId,
          recipeId: input.recipeId,
          servings: input.servings.toString(),
          calories: input.calories.toString(),
          proteinG: input.proteinG?.toString(),
          carbsG: input.carbsG?.toString(),
          fatG: input.fatG?.toString(),
          fiberG: input.fiberG?.toString(),
        })
        .returning();

      return entry;
    }),

  // ─── delete a meal entry ───────────────────────────────────────
  deleteEntry: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership: entry -> meal_log -> user
      const [entry] = await ctx.db
        .select({
          entryId: mealLogEntries.id,
          userId: mealLogs.userId,
        })
        .from(mealLogEntries)
        .innerJoin(mealLogs, eq(mealLogEntries.mealLogId, mealLogs.id))
        .where(eq(mealLogEntries.id, input.entryId))
        .limit(1);

      if (!entry || entry.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entry not found or access denied.",
        });
      }

      await ctx.db
        .delete(mealLogEntries)
        .where(eq(mealLogEntries.id, input.entryId));

      return { success: true };
    }),

  // ─── quick add (create food + log in one step) ─────────────────
  quickAdd: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        mealType: z.string(),
        calories: z.number(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create a quick-add food item
      const [food] = await ctx.db
        .insert(foodItems)
        .values({
          name: input.description ?? "Quick Add",
          calories: input.calories.toString(),
          source: "quick_add",
          createdBy: ctx.user.id,
        })
        .returning();

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

      // Log the entry
      const [entry] = await ctx.db
        .insert(mealLogEntries)
        .values({
          mealLogId: mealLog.id,
          foodItemId: food.id,
          servings: "1",
          calories: input.calories.toString(),
        })
        .returning();

      return entry;
    }),

  // ─── copy meal from one slot to another ────────────────────────
  copyMeal: protectedProcedure
    .input(
      z.object({
        fromDate: z.string(),
        fromMealType: z.string(),
        toDate: z.string(),
        toMealType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the source meal log with entries
      const sourceLogs = await ctx.db.query.mealLogs.findMany({
        where: and(
          eq(mealLogs.userId, ctx.user.id),
          eq(mealLogs.date, input.fromDate),
          eq(mealLogs.mealType, input.fromMealType),
        ),
        with: {
          entries: true,
        },
      });

      if (!sourceLogs.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source meal not found.",
        });
      }

      // Collect all source entries
      const sourceEntries = sourceLogs.flatMap((log) => log.entries);
      if (!sourceEntries.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No entries in source meal.",
        });
      }

      // Find or create target meal_log
      let [targetLog] = await ctx.db
        .select()
        .from(mealLogs)
        .where(
          and(
            eq(mealLogs.userId, ctx.user.id),
            eq(mealLogs.date, input.toDate),
            eq(mealLogs.mealType, input.toMealType),
          ),
        )
        .limit(1);

      if (!targetLog) {
        [targetLog] = await ctx.db
          .insert(mealLogs)
          .values({
            userId: ctx.user.id,
            date: input.toDate,
            mealType: input.toMealType,
          })
          .returning();
      }

      // Copy entries
      const newEntries = await ctx.db
        .insert(mealLogEntries)
        .values(
          sourceEntries.map((e) => ({
            mealLogId: targetLog.id,
            foodItemId: e.foodItemId,
            recipeId: e.recipeId,
            servings: e.servings,
            calories: e.calories,
            proteinG: e.proteinG,
            carbsG: e.carbsG,
            fatG: e.fatG,
            fiberG: e.fiberG,
          })),
        )
        .returning();

      return newEntries;
    }),
});
