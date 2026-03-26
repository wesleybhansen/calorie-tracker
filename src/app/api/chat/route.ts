import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, mealLogs, mealLogEntries } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

function getMealTypeFromHour(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snack";
}

async function getUserContext(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  // Get profile + targets
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  // Get today's consumed totals
  const [totals] = await db
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
        eq(mealLogs.userId, userId),
        eq(mealLogs.date, today),
      ),
    );

  // Get today's food log details
  const todayLogs = await db
    .select({
      mealType: mealLogs.mealType,
      calories: mealLogEntries.calories,
      proteinG: mealLogEntries.proteinG,
      carbsG: mealLogEntries.carbsG,
      fatG: mealLogEntries.fatG,
      foodName: sql<string>`coalesce(
        (select name from food_items where id = ${mealLogEntries.foodItemId}),
        'Quick Add'
      )`,
    })
    .from(mealLogEntries)
    .innerJoin(mealLogs, eq(mealLogEntries.mealLogId, mealLogs.id))
    .where(
      and(
        eq(mealLogs.userId, userId),
        eq(mealLogs.date, today),
      ),
    );

  const targets = {
    calories: profile?.dailyCalorieTarget ?? 2000,
    proteinG: profile?.proteinTargetG ?? 150,
    carbsG: profile?.carbsTargetG ?? 200,
    fatG: profile?.fatTargetG ?? 65,
  };

  const consumed = {
    calories: Number(totals?.calories ?? 0),
    proteinG: Number(totals?.proteinG ?? 0),
    carbsG: Number(totals?.carbsG ?? 0),
    fatG: Number(totals?.fatG ?? 0),
  };

  const remaining = {
    calories: targets.calories - consumed.calories,
    proteinG: targets.proteinG - consumed.proteinG,
    carbsG: targets.carbsG - consumed.carbsG,
    fatG: targets.fatG - consumed.fatG,
  };

  const foodLogSummary = todayLogs.length > 0
    ? todayLogs
        .map(
          (l) =>
            `- ${l.mealType}: ${l.foodName} (${l.calories} cal, ${l.proteinG}g P, ${l.carbsG}g C, ${l.fatG}g F)`,
        )
        .join("\n")
    : "No food logged yet today.";

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return {
    profile,
    systemContext: `
CURRENT TIME: ${currentTime}
SUGGESTED MEAL TYPE: ${getMealTypeFromHour()}
TODAY'S DATE: ${today}

DAILY TARGETS:
- Calories: ${targets.calories} kcal
- Protein: ${targets.proteinG}g
- Carbs: ${targets.carbsG}g
- Fat: ${targets.fatG}g

CONSUMED TODAY:
- Calories: ${consumed.calories} kcal
- Protein: ${consumed.proteinG}g
- Carbs: ${consumed.carbsG}g
- Fat: ${consumed.fatG}g

REMAINING TODAY:
- Calories: ${remaining.calories} kcal
- Protein: ${remaining.proteinG}g
- Carbs: ${remaining.carbsG}g
- Fat: ${remaining.fatG}g

TODAY'S FOOD LOG:
${foodLogSummary}
`.trim(),
  };
}

const SYSTEM_PROMPT = `You are NutriBot, an expert nutrition assistant built into a calorie tracking app. You help users log food, answer nutrition questions, and give meal suggestions.

CORE RULES:
1. Be concise, friendly, and helpful. Use short paragraphs.
2. When a user describes food they ate, ALWAYS extract structured food items and include them in a FOOD_ITEMS block.
3. Estimate calories and macros as accurately as possible using standard USDA/nutrition data.
4. If uncertain about portions, make reasonable assumptions and note them.
5. When suggesting meals, consider the user's remaining macros for the day.

FOOD ITEM EXTRACTION:
When the user mentions food they ate or want to log, include a structured block in your response like this:

[FOOD_ITEMS]
{"items":[{"name":"Food Name","calories":100,"proteinG":10,"carbsG":20,"fatG":5}]}
[/FOOD_ITEMS]

Always include this block when food items are mentioned for logging. Include it AFTER your conversational text.
Each item must have: name (string), calories (number), proteinG (number), carbsG (number), fatG (number).
Be as accurate as possible with standard serving sizes.

USER CONTEXT:
{CONTEXT}`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages } = (await request.json()) as {
      messages: Array<{ role: string; content: string }>;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid request: messages required", { status: 400 });
    }

    // Get user context (with fallback if DB query fails)
    let profile: Awaited<ReturnType<typeof getUserContext>>["profile"];
    let systemContext: string;
    try {
      const ctx = await getUserContext(user.id);
      profile = ctx.profile;
      systemContext = ctx.systemContext;
    } catch (ctxError) {
      console.error("Failed to load user context for chat:", ctxError);
      // Fall back to minimal context so chat still works
      const [fallbackProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);
      profile = fallbackProfile;
      systemContext = "User context unavailable. Answer questions to the best of your ability without daily tracking data.";
    }

    if (!profile?.encryptedApiKey) {
      return new Response(
        JSON.stringify({
          error: "No API key configured. Go to Profile > AI Settings to add one.",
        }),
        { status: 412, headers: { "Content-Type": "application/json" } },
      );
    }

    const provider = profile.aiProvider ?? "openai";
    const model = getAIModel(provider, profile.encryptedApiKey);

    const systemPrompt = SYSTEM_PROMPT.replace("{CONTEXT}", systemContext);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      maxOutputTokens: 1500,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to process chat request",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
