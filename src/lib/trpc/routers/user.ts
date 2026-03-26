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
      const [updated] = await ctx.db
        .update(profiles)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, ctx.user.id))
        .returning();

      return updated;
    }),
});
