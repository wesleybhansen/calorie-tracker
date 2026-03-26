import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── profiles ───────────────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // references auth.users
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  dailyCalorieTarget: integer("daily_calorie_target").default(2000),
  proteinTargetG: integer("protein_target_g").default(150),
  carbsTargetG: integer("carbs_target_g").default(200),
  fatTargetG: integer("fat_target_g").default(65),
  fiberTargetG: integer("fiber_target_g").default(25),
  mealTypes: jsonb("meal_types")
    .$type<string[]>()
    .default(["Breakfast", "Lunch", "Dinner", "Snack"]),
  aiProvider: text("ai_provider").default("openai"),
  encryptedApiKey: text("encrypted_api_key"),
  units: text("units").default("imperial"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── food_items ─────────────────────────────────────────────────────
export const foodItems = pgTable("food_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  brand: text("brand"),
  barcode: text("barcode"),
  calories: numeric("calories"),
  proteinG: numeric("protein_g"),
  carbsG: numeric("carbs_g"),
  fatG: numeric("fat_g"),
  fiberG: numeric("fiber_g"),
  sugarG: numeric("sugar_g"),
  sodiumMg: numeric("sodium_mg"),
  servingSize: text("serving_size"),
  servingUnit: text("serving_unit"),
  source: text("source").default("custom"),
  sourceId: text("source_id"),
  imageUrl: text("image_url"),
  createdBy: uuid("created_by").references(() => profiles.id),
  isShared: boolean("is_shared").default(true),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── recipes ────────────────────────────────────────────────────────
export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  servings: numeric("servings").default("1"),
  prepTimeMin: integer("prep_time_min"),
  cookTimeMin: integer("cook_time_min"),
  isShared: boolean("is_shared").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── recipe_ingredients ─────────────────────────────────────────────
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  foodItemId: uuid("food_item_id")
    .notNull()
    .references(() => foodItems.id, { onDelete: "cascade" }),
  quantity: numeric("quantity"),
  unit: text("unit"),
});

// ─── meal_logs ──────────────────────────────────────────────────────
export const mealLogs = pgTable("meal_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  date: date("date").notNull(),
  mealType: text("meal_type"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow(),
  notes: text("notes"),
  photoUrl: text("photo_url"),
});

// ─── meal_log_entries ───────────────────────────────────────────────
export const mealLogEntries = pgTable("meal_log_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealLogId: uuid("meal_log_id")
    .notNull()
    .references(() => mealLogs.id, { onDelete: "cascade" }),
  foodItemId: uuid("food_item_id").references(() => foodItems.id),
  recipeId: uuid("recipe_id").references(() => recipes.id),
  servings: numeric("servings").default("1"),
  calories: numeric("calories"),
  proteinG: numeric("protein_g"),
  carbsG: numeric("carbs_g"),
  fatG: numeric("fat_g"),
  fiberG: numeric("fiber_g"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── daily_summaries ────────────────────────────────────────────────
export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    date: date("date").notNull(),
    totalCalories: numeric("total_calories"),
    totalProteinG: numeric("total_protein_g"),
    totalCarbsG: numeric("total_carbs_g"),
    totalFatG: numeric("total_fat_g"),
    totalFiberG: numeric("total_fiber_g"),
    weightKg: numeric("weight_kg"),
    notes: text("notes"),
  },
  (t) => [unique("daily_summaries_user_date_unique").on(t.userId, t.date)],
);

// ─── water_logs ─────────────────────────────────────────────────────
export const waterLogs = pgTable("water_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  date: date("date").notNull(),
  amountMl: integer("amount_ml"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow(),
});

// ─── ai_chat_history ────────────────────────────────────────────────
export const aiChatHistory = pgTable("ai_chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  messages: jsonb("messages").$type<unknown[]>(),
  context: text("context").default("general"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// Relations
// ═══════════════════════════════════════════════════════════════════

export const profilesRelations = relations(profiles, ({ many }) => ({
  foodItems: many(foodItems),
  recipes: many(recipes),
  mealLogs: many(mealLogs),
  dailySummaries: many(dailySummaries),
  waterLogs: many(waterLogs),
  aiChatHistory: many(aiChatHistory),
}));

export const foodItemsRelations = relations(foodItems, ({ one, many }) => ({
  createdByProfile: one(profiles, {
    fields: [foodItems.createdBy],
    references: [profiles.id],
  }),
  recipeIngredients: many(recipeIngredients),
  mealLogEntries: many(mealLogEntries),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(profiles, {
    fields: [recipes.userId],
    references: [profiles.id],
  }),
  ingredients: many(recipeIngredients),
  mealLogEntries: many(mealLogEntries),
}));

export const recipeIngredientsRelations = relations(
  recipeIngredients,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipeIngredients.recipeId],
      references: [recipes.id],
    }),
    foodItem: one(foodItems, {
      fields: [recipeIngredients.foodItemId],
      references: [foodItems.id],
    }),
  }),
);

export const mealLogsRelations = relations(mealLogs, ({ one, many }) => ({
  user: one(profiles, {
    fields: [mealLogs.userId],
    references: [profiles.id],
  }),
  entries: many(mealLogEntries),
}));

export const mealLogEntriesRelations = relations(
  mealLogEntries,
  ({ one }) => ({
    mealLog: one(mealLogs, {
      fields: [mealLogEntries.mealLogId],
      references: [mealLogs.id],
    }),
    foodItem: one(foodItems, {
      fields: [mealLogEntries.foodItemId],
      references: [foodItems.id],
    }),
    recipe: one(recipes, {
      fields: [mealLogEntries.recipeId],
      references: [recipes.id],
    }),
  }),
);

export const dailySummariesRelations = relations(
  dailySummaries,
  ({ one }) => ({
    user: one(profiles, {
      fields: [dailySummaries.userId],
      references: [profiles.id],
    }),
  }),
);

export const waterLogsRelations = relations(waterLogs, ({ one }) => ({
  user: one(profiles, {
    fields: [waterLogs.userId],
    references: [profiles.id],
  }),
}));

export const aiChatHistoryRelations = relations(aiChatHistory, ({ one }) => ({
  user: one(profiles, {
    fields: [aiChatHistory.userId],
    references: [profiles.id],
  }),
}));
