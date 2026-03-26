import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import { profiles } from "@/db/schema";

export const userRouter = createTRPCRouter({
  // ─── get profile ───────────────────────────────────────────────
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ctx.user.id))
      .limit(1);

    return profile ?? null;
  }),

  // ─── update profile ────────────────────────────────────────────
  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        dailyCalorieTarget: z.number().int().positive().optional(),
        proteinTargetG: z.number().int().nonnegative().optional(),
        carbsTargetG: z.number().int().nonnegative().optional(),
        fatTargetG: z.number().int().nonnegative().optional(),
        fiberTargetG: z.number().int().nonnegative().optional(),
        mealTypes: z.array(z.string()).optional(),
        aiProvider: z.string().optional(),
        encryptedApiKey: z.string().optional(),
        units: z.enum(["imperial", "metric"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Build set object, only including provided fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { updatedAt: new Date() };
        if (input.displayName !== undefined) data.displayName = input.displayName;
        if (input.dailyCalorieTarget !== undefined) data.dailyCalorieTarget = input.dailyCalorieTarget;
        if (input.proteinTargetG !== undefined) data.proteinTargetG = input.proteinTargetG;
        if (input.carbsTargetG !== undefined) data.carbsTargetG = input.carbsTargetG;
        if (input.fatTargetG !== undefined) data.fatTargetG = input.fatTargetG;
        if (input.fiberTargetG !== undefined) data.fiberTargetG = input.fiberTargetG;
        if (input.aiProvider !== undefined) data.aiProvider = input.aiProvider;
        if (input.encryptedApiKey !== undefined) data.encryptedApiKey = input.encryptedApiKey;
        if (input.units !== undefined) data.units = input.units;

        // Handle mealTypes separately via raw SQL since jsonb can be tricky with Drizzle
        if (input.mealTypes !== undefined) {
          const jsonValue = JSON.stringify(input.mealTypes);
          await ctx.db.execute(
            sql.raw(
              `UPDATE profiles SET meal_types = '${jsonValue.replace(/'/g, "''")}'::jsonb, updated_at = now() WHERE id = '${ctx.user.id}'`
            )
          );
          // If only mealTypes was provided, return early
          if (Object.keys(data).length === 1) {
            const [profile] = await ctx.db.select().from(profiles).where(eq(profiles.id, ctx.user.id)).limit(1);
            return profile;
          }
        }

        const [updated] = await ctx.db
          .update(profiles)
          .set(data)
          .where(eq(profiles.id, ctx.user.id))
          .returning();

        return updated;
      } catch (error) {
        console.error("updateProfile error:", error);
        throw error;
      }
    }),
});
