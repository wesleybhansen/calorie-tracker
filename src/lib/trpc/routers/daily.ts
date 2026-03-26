import { z } from "zod";
import { eq, and, sql, gte, lte, asc } from "drizzle-orm";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import {
  profiles,
  mealLogs,
  mealLogEntries,
  dailySummaries,
} from "@/db/schema";

export const dailyRouter = createTRPCRouter({
  // ─── get daily summary (computed totals + targets + weight) ────
  get: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      // Run all 3 queries in parallel instead of sequential
      const [totalsResult, profileResult, summaryResult] = await Promise.all([
        ctx.db
          .select({
            calories: sql<number>`coalesce(sum(${mealLogEntries.calories}::numeric), 0)`,
            proteinG: sql<number>`coalesce(sum(${mealLogEntries.proteinG}::numeric), 0)`,
            carbsG: sql<number>`coalesce(sum(${mealLogEntries.carbsG}::numeric), 0)`,
            fatG: sql<number>`coalesce(sum(${mealLogEntries.fatG}::numeric), 0)`,
            fiberG: sql<number>`coalesce(sum(${mealLogEntries.fiberG}::numeric), 0)`,
          })
          .from(mealLogEntries)
          .innerJoin(mealLogs, eq(mealLogEntries.mealLogId, mealLogs.id))
          .where(
            and(
              eq(mealLogs.userId, ctx.user.id),
              eq(mealLogs.date, input.date),
            ),
          ),
        ctx.db
          .select({
            dailyCalorieTarget: profiles.dailyCalorieTarget,
            proteinTargetG: profiles.proteinTargetG,
            carbsTargetG: profiles.carbsTargetG,
            fatTargetG: profiles.fatTargetG,
            fiberTargetG: profiles.fiberTargetG,
            mealTypes: profiles.mealTypes,
            encryptedApiKey: profiles.encryptedApiKey,
          })
          .from(profiles)
          .where(eq(profiles.id, ctx.user.id))
          .limit(1),
        ctx.db
          .select({ weightKg: dailySummaries.weightKg })
          .from(dailySummaries)
          .where(
            and(
              eq(dailySummaries.userId, ctx.user.id),
              eq(dailySummaries.date, input.date),
            ),
          )
          .limit(1),
      ]);

      const totals = totalsResult[0];
      const profile = profileResult[0];
      const summary = summaryResult[0];

      return {
        consumed: {
          calories: Number(totals?.calories ?? 0),
          proteinG: Number(totals?.proteinG ?? 0),
          carbsG: Number(totals?.carbsG ?? 0),
          fatG: Number(totals?.fatG ?? 0),
          fiberG: Number(totals?.fiberG ?? 0),
        },
        targets: {
          calories: profile?.dailyCalorieTarget ?? 2000,
          proteinG: profile?.proteinTargetG ?? 150,
          carbsG: profile?.carbsTargetG ?? 200,
          fatG: profile?.fatTargetG ?? 65,
          fiberG: profile?.fiberTargetG ?? 25,
        },
        weight: summary?.weightKg ? Number(summary.weightKg) : null,
        mealTypes: (profile?.mealTypes as string[] | null) ?? ["Breakfast", "Lunch", "Dinner", "Snack"],
        hasAiKey: !!profile?.encryptedApiKey,
      };
    }),

  // ─── log weight for a date ─────────────────────────────────────
  logWeight: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        weightKg: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .insert(dailySummaries)
        .values({
          userId: ctx.user.id,
          date: input.date,
          weightKg: input.weightKg.toString(),
        })
        .onConflictDoUpdate({
          target: [dailySummaries.userId, dailySummaries.date],
          set: {
            weightKg: input.weightKg.toString(),
          },
        })
        .returning();

      return result;
    }),

  // ─── get range of daily data ──────────────────────────────────
  getRange: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Generate all dates in range (use noon to avoid DST edge cases)
      const start = new Date(input.startDate + "T12:00:00");
      const end = new Date(input.endDate + "T12:00:00");
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Format as YYYY-MM-DD using local date parts
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        dates.push(`${year}-${month}-${day}`);
      }

      // Get computed totals from meal_log_entries grouped by date
      const mealTotals = await ctx.db
        .select({
          date: mealLogs.date,
          calories: sql<number>`coalesce(sum(${mealLogEntries.calories}::numeric), 0)`,
          proteinG: sql<number>`coalesce(sum(${mealLogEntries.proteinG}::numeric), 0)`,
          carbsG: sql<number>`coalesce(sum(${mealLogEntries.carbsG}::numeric), 0)`,
          fatG: sql<number>`coalesce(sum(${mealLogEntries.fatG}::numeric), 0)`,
          fiberG: sql<number>`coalesce(sum(${mealLogEntries.fiberG}::numeric), 0)`,
          entryCount: sql<number>`count(${mealLogEntries.id})`,
        })
        .from(mealLogEntries)
        .innerJoin(mealLogs, eq(mealLogEntries.mealLogId, mealLogs.id))
        .where(
          and(
            eq(mealLogs.userId, ctx.user.id),
            gte(mealLogs.date, input.startDate),
            lte(mealLogs.date, input.endDate),
          ),
        )
        .groupBy(mealLogs.date)
        .orderBy(asc(mealLogs.date));

      // Get weight data from daily_summaries
      const weights = await ctx.db
        .select({
          date: dailySummaries.date,
          weightKg: dailySummaries.weightKg,
        })
        .from(dailySummaries)
        .where(
          and(
            eq(dailySummaries.userId, ctx.user.id),
            gte(dailySummaries.date, input.startDate),
            lte(dailySummaries.date, input.endDate),
          ),
        )
        .orderBy(asc(dailySummaries.date));

      // Get user targets
      const [profile] = await ctx.db
        .select({
          dailyCalorieTarget: profiles.dailyCalorieTarget,
          proteinTargetG: profiles.proteinTargetG,
          carbsTargetG: profiles.carbsTargetG,
          fatTargetG: profiles.fatTargetG,
          fiberTargetG: profiles.fiberTargetG,
        })
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      const mealMap = new Map(mealTotals.map((m) => [m.date, m]));
      const weightMap = new Map(weights.map((w) => [w.date, w.weightKg]));

      return {
        days: dates.map((date) => {
          const meal = mealMap.get(date);
          return {
            date,
            calories: Number(meal?.calories ?? 0),
            proteinG: Number(meal?.proteinG ?? 0),
            carbsG: Number(meal?.carbsG ?? 0),
            fatG: Number(meal?.fatG ?? 0),
            fiberG: Number(meal?.fiberG ?? 0),
            entryCount: Number(meal?.entryCount ?? 0),
            weightKg: weightMap.get(date)
              ? Number(weightMap.get(date))
              : null,
          };
        }),
        targets: {
          calories: profile?.dailyCalorieTarget ?? 2000,
          proteinG: profile?.proteinTargetG ?? 150,
          carbsG: profile?.carbsTargetG ?? 200,
          fatG: profile?.fatTargetG ?? 65,
          fiberG: profile?.fiberTargetG ?? 25,
        },
      };
    }),
});
