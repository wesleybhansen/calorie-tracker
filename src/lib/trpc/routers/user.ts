import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import { profiles } from "@/db/schema";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ctx.user.id))
      .limit(1);

    return profile ?? null;
  }),

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
      // Separate mealTypes update from everything else
      // to handle jsonb properly
      if (input.mealTypes !== undefined) {
        try {
          const jsonStr = JSON.stringify(input.mealTypes).replace(/'/g, "''");
          await ctx.db.execute(
            sql.join([
              sql.raw(`UPDATE profiles SET meal_types = '${jsonStr}'::jsonb, updated_at = now() WHERE id = `),
              sql`${ctx.user.id}`,
            ])
          );
        } catch (e: any) {
          console.error("mealTypes update failed:", {
            message: e?.message,
            code: e?.code,
            detail: e?.detail,
            hint: e?.hint,
            severity: e?.severity,
            routine: e?.routine,
            full: JSON.stringify(e, Object.getOwnPropertyNames(e)),
          });
          throw new Error(`Meal types update failed: ${e?.message ?? e?.code ?? 'unknown'} | detail: ${e?.detail ?? 'none'} | hint: ${e?.hint ?? 'none'}`);
        }
      }

      // Handle non-mealTypes fields
      const hasOtherFields = Object.keys(input).some(k => k !== 'mealTypes' && input[k as keyof typeof input] !== undefined);

      if (hasOtherFields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: Record<string, any> = { updatedAt: new Date() };
        if (input.displayName !== undefined) data.displayName = input.displayName;
        if (input.dailyCalorieTarget !== undefined) data.dailyCalorieTarget = input.dailyCalorieTarget;
        if (input.proteinTargetG !== undefined) data.proteinTargetG = input.proteinTargetG;
        if (input.carbsTargetG !== undefined) data.carbsTargetG = input.carbsTargetG;
        if (input.fatTargetG !== undefined) data.fatTargetG = input.fatTargetG;
        if (input.fiberTargetG !== undefined) data.fiberTargetG = input.fiberTargetG;
        if (input.aiProvider !== undefined) data.aiProvider = input.aiProvider;
        if (input.encryptedApiKey !== undefined) data.encryptedApiKey = input.encryptedApiKey;
        if (input.units !== undefined) data.units = input.units;

        await ctx.db
          .update(profiles)
          .set(data)
          .where(eq(profiles.id, ctx.user.id));
      }

      // Return updated profile
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      return profile;
    }),
});
