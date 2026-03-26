import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../init";
import { profiles } from "@/db/schema";

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
