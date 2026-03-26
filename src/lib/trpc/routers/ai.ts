import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import { profiles, mealLogs, mealLogEntries } from "@/db/schema";

interface Suggestion {
  name: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reason: string;
}

const FOOD_ANALYSIS_SYSTEM_PROMPT = `You are an expert registered dietitian with 20 years of experience. Analyze the food in this image step by step:
1. Identify each food item
2. Estimate portion sizes using the plate/container as reference
3. Look for hidden calories (oils, sauces, dressings)
4. Provide calorie and macro estimates for each item
Return your analysis as JSON only (no markdown, no code fences): { "items": [{ "name": string, "estimatedWeightG": number, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "confidence": "high"|"medium"|"low" }], "totalCalories": number, "notes": string, "questions": ["follow-up questions if uncertain"] }`;

function getAIModel(provider: string, apiKey: string) {
  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic("claude-sonnet-4-20250514");
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google("gemini-2.0-flash");
    }
    case "openai":
    default: {
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4o");
    }
  }
}

export const aiRouter = createTRPCRouter({
  // ─── analyze photo ─────────────────────────────────────────────
  analyzePhoto: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string().min(1),
        description: z.string().optional(),
        provider: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get user profile for API key
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      if (!profile?.encryptedApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No API key configured. Go to Profile → AI Settings to add one.",
        });
      }

      const provider = input.provider ?? profile.aiProvider ?? "openai";
      const model = getAIModel(provider, profile.encryptedApiKey);

      const userMessage = input.description
        ? `Here is a photo of food. The user describes it as: "${input.description}". Analyze the food and estimate nutritional information.`
        : "Here is a photo of food. Analyze the food and estimate nutritional information.";

      try {
        const result = await generateText({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  image: input.imageBase64,
                },
                {
                  type: "text",
                  text: userMessage,
                },
              ],
            },
          ],
          system: FOOD_ANALYSIS_SYSTEM_PROMPT,
          maxOutputTokens: 2000,
        });

        // Parse the JSON response
        const text = result.text.trim();
        // Remove markdown code fences if present
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

        try {
          const parsed = JSON.parse(cleaned) as {
            items: Array<{
              name: string;
              estimatedWeightG: number;
              calories: number;
              proteinG: number;
              carbsG: number;
              fatG: number;
              confidence: "high" | "medium" | "low";
            }>;
            totalCalories: number;
            notes?: string;
            questions?: string[];
          };

          return {
            items: parsed.items ?? [],
            totalCalories: parsed.totalCalories ?? 0,
            notes: parsed.notes,
            questions: parsed.questions ?? [],
          };
        } catch {
          // If JSON parsing fails, return a generic response
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to parse AI response. Please try again.",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to analyze photo. Check your API key and try again.",
        });
      }
    }),

  // ─── parse text (voice / text food description) ─────────────────
  parseText: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        mealType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      if (!profile?.encryptedApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No API key configured. Go to Profile → AI Settings to add one.",
        });
      }

      const provider = profile.aiProvider ?? "openai";
      const model = getAIModel(provider, profile.encryptedApiKey);

      const systemPrompt = `You are an expert registered dietitian. Parse the following food description into individual food items with calorie and macronutrient estimates. Be accurate with portion sizes - use standard serving sizes when not specified. Return JSON only (no markdown, no code fences): { "items": [{ "name": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "confidence": "high"|"medium"|"low" }] }`;

      const userMessage = input.mealType
        ? `Parse this food description for ${input.mealType}: "${input.text}"`
        : `Parse this food description: "${input.text}"`;

      try {
        const result = await generateText({
          model,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
          system: systemPrompt,
          maxOutputTokens: 1500,
        });

        const text = result.text.trim();
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

        try {
          const parsed = JSON.parse(cleaned) as {
            items: Array<{
              name: string;
              calories: number;
              proteinG: number;
              carbsG: number;
              fatG: number;
              confidence: "high" | "medium" | "low";
            }>;
          };

          return {
            items: parsed.items ?? [],
          };
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to parse AI response. Please try again.",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to parse food description. Check your API key and try again.",
        });
      }
    }),

  // ─── AI meal suggestions ──────────────────────────────────────────
  suggest: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      if (!profile?.encryptedApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No API key configured.",
        });
      }

      // Get consumed totals for the day
      const [totals] = await ctx.db
        .select({
          calories: sql<number>`coalesce(sum(${mealLogEntries.calories}::numeric), 0)`,
          proteinG: sql<number>`coalesce(sum(${mealLogEntries.proteinG}::numeric), 0)`,
          carbsG: sql<number>`coalesce(sum(${mealLogEntries.carbsG}::numeric), 0)`,
          fatG: sql<number>`coalesce(sum(${mealLogEntries.fatG}::numeric), 0)`,
        })
        .from(mealLogEntries)
        .innerJoin(mealLogs, eq(mealLogEntries.mealLogId, mealLogs.id))
        .where(
          and(
            eq(mealLogs.userId, ctx.user.id),
            eq(mealLogs.date, input.date),
          ),
        );

      const targetCals = profile.dailyCalorieTarget ?? 2000;
      const targetProtein = profile.proteinTargetG ?? 150;
      const targetCarbs = profile.carbsTargetG ?? 200;
      const targetFat = profile.fatTargetG ?? 65;

      const remainingCals = Math.max(0, targetCals - Number(totals?.calories ?? 0));
      const remainingProtein = Math.max(0, targetProtein - Number(totals?.proteinG ?? 0));
      const remainingCarbs = Math.max(0, targetCarbs - Number(totals?.carbsG ?? 0));
      const remainingFat = Math.max(0, targetFat - Number(totals?.fatG ?? 0));

      // Determine meal type from time of day
      const hour = new Date().getHours();
      let mealType = "Dinner";
      if (hour < 11) mealType = "Breakfast";
      else if (hour < 15) mealType = "Lunch";
      else if (hour >= 20) mealType = "Snack";

      const provider = profile.aiProvider ?? "openai";
      const model = getAIModel(provider, profile.encryptedApiKey);

      const systemPrompt = `You are a helpful nutrition assistant. Suggest practical, realistic meals that a person could easily prepare or order. Return JSON only (no markdown, no code fences): { "suggestions": [{ "name": string, "description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "reason": string }] }`;

      const userMessage = `Based on my remaining macros for today (${remainingCals} calories, ${remainingProtein}g protein, ${remainingCarbs}g carbs, ${remainingFat}g fat remaining), suggest 3 meals for ${mealType}. Each suggestion should help me hit my remaining targets. Keep meals simple and realistic. The "reason" should be a short phrase like "fills your protein gap" or "low-cal high-fiber option".`;

      try {
        const result = await generateText({
          model,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
          system: systemPrompt,
          maxOutputTokens: 1500,
        });

        const text = result.text.trim();
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

        try {
          const parsed = JSON.parse(cleaned) as {
            suggestions: Suggestion[];
          };

          return {
            suggestions: (parsed.suggestions ?? []).slice(0, 3),
            mealType,
            remaining: {
              calories: remainingCals,
              proteinG: remainingProtein,
              carbsG: remainingCarbs,
              fatG: remainingFat,
            },
          };
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to parse AI suggestions. Please try again.",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get suggestions. Check your API key and try again.",
        });
      }
    }),

  // ─── nutrition chat ────────────────────────────────────────────
  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          }),
        ),
        context: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);

      if (!profile?.encryptedApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No API key configured. Go to Profile → AI Settings to add one.",
        });
      }

      const provider = profile.aiProvider ?? "openai";
      const model = getAIModel(provider, profile.encryptedApiKey);

      const systemPrompt = input.context
        ? `You are a knowledgeable nutrition assistant. Context: ${input.context}. Answer questions helpfully and concisely.`
        : "You are a knowledgeable nutrition assistant. Answer questions about food, nutrition, and healthy eating helpfully and concisely.";

      try {
        const result = await generateText({
          model,
          messages: input.messages,
          system: systemPrompt,
          maxOutputTokens: 1000,
        });

        return { reply: result.text };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get AI response.",
        });
      }
    }),
});
