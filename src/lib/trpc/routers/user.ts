import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";

// Convert Supabase snake_case response to camelCase for the frontend
function normalizeProfile(data: Record<string, unknown>) {
  return {
    id: data.id as string,
    displayName: data.display_name as string | null,
    avatarUrl: data.avatar_url as string | null,
    dailyCalorieTarget: data.daily_calorie_target as number | null,
    proteinTargetG: data.protein_target_g as number | null,
    carbsTargetG: data.carbs_target_g as number | null,
    fatTargetG: data.fat_target_g as number | null,
    fiberTargetG: data.fiber_target_g as number | null,
    mealTypes: data.meal_types as string[] | null,
    aiProvider: data.ai_provider as string | null,
    encryptedApiKey: data.encrypted_api_key as string | null,
    units: data.units as string | null,
    createdAt: data.created_at as string | null,
    updatedAt: data.updated_at as string | null,
  };
}

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("*")
      .eq("id", ctx.user.id)
      .single();

    if (error) throw new Error(error.message);
    return normalizeProfile(data);
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

      const { data, error } = await ctx.supabase
        .from("profiles")
        .update(updateData)
        .eq("id", ctx.user.id)
        .select()
        .single();

      if (error) throw new Error(`Update failed: ${error.message}`);

      return normalizeProfile(data);
    }),
});
