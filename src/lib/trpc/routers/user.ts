import { z } from "zod";
import { eq } from "drizzle-orm";
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
      // Only include fields that were actually provided (not undefined)
      const setData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.displayName !== undefined) setData.displayName = input.displayName;
      if (input.avatarUrl !== undefined) setData.avatarUrl = input.avatarUrl;
      if (input.dailyCalorieTarget !== undefined) setData.dailyCalorieTarget = input.dailyCalorieTarget;
      if (input.proteinTargetG !== undefined) setData.proteinTargetG = input.proteinTargetG;
      if (input.carbsTargetG !== undefined) setData.carbsTargetG = input.carbsTargetG;
      if (input.fatTargetG !== undefined) setData.fatTargetG = input.fatTargetG;
      if (input.fiberTargetG !== undefined) setData.fiberTargetG = input.fiberTargetG;
      if (input.mealTypes !== undefined) setData.mealTypes = input.mealTypes;
      if (input.aiProvider !== undefined) setData.aiProvider = input.aiProvider;
      if (input.encryptedApiKey !== undefined) setData.encryptedApiKey = input.encryptedApiKey;
      if (input.units !== undefined) setData.units = input.units;

      const [updated] = await ctx.db
        .update(profiles)
        .set(setData)
        .where(eq(profiles.id, ctx.user.id))
        .returning();

      return updated;
    }),
});
