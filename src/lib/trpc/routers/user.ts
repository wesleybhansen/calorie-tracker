import { z } from "zod";
import { eq } from "drizzle-orm";
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
      // Use Supabase client (PostgREST) for updates — it handles jsonb natively
      // and goes through the authenticated connection
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.displayName !== undefined) updateData.display_name = input.displayName;
      if (input.dailyCalorieTarget !== undefined) updateData.daily_calorie_target = input.dailyCalorieTarget;
      if (input.proteinTargetG !== undefined) updateData.protein_target_g = input.proteinTargetG;
      if (input.carbsTargetG !== undefined) updateData.carbs_target_g = input.carbsTargetG;
      if (input.fatTargetG !== undefined) updateData.fat_target_g = input.fatTargetG;
      if (input.fiberTargetG !== undefined) updateData.fiber_target_g = input.fiberTargetG;
      if (input.mealTypes !== undefined) updateData.meal_types = input.mealTypes;
      if (input.aiProvider !== undefined) updateData.ai_provider = input.aiProvider;
      if (input.encryptedApiKey !== undefined) updateData.encrypted_api_key = input.encryptedApiKey;
      if (input.units !== undefined) updateData.units = input.units;

      const { data: updatedRows, error } = await ctx.supabase
        .from("profiles")
        .update(updateData)
        .eq("id", ctx.user.id)
        .select();

      if (error) throw new Error(`Supabase error: ${error.message} (code: ${error.code})`);
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Update matched 0 rows — RLS may be blocking. User ID: " + ctx.user.id);
      }

      // Return updated profile via Drizzle (reads work fine)
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      return profile;
    }),
});
