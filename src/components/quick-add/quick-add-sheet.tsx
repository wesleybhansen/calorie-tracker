"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Drawer } from "vaul";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { FoodResultCard, type FoodResult } from "./food-result-card";
import { VoiceInput } from "./voice-input";
import { format } from "date-fns";

interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  defaultMealType: string;
}

function getMealTypeFromHour(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snack";
}

export function QuickAddSheet({
  open,
  onOpenChange,
  selectedDate,
  defaultMealType,
}: QuickAddSheetProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mealType, setMealType] = useState(defaultMealType);
  const [quickCalMode, setQuickCalMode] = useState(false);
  const [quickCalAmount, setQuickCalAmount] = useState("");
  const [quickCalDescription, setQuickCalDescription] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const utils = trpc.useUtils();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setMealType(defaultMealType);
      setQuickCalMode(false);
      setQuickCalAmount("");
      setQuickCalDescription("");
      setVoiceMode(false);
      // Auto-focus the input after drawer animation
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [open, defaultMealType]);

  // ─── Queries ───────────────────────────────────────────────────
  const recentFoods = trpc.food.getRecent.useQuery(undefined, {
    enabled: open && !debouncedQuery,
  });

  const searchResults = trpc.food.search.useQuery(
    { query: debouncedQuery },
    { enabled: open && debouncedQuery.length > 0 },
  );

  const [usdaQuery, setUsdaQuery] = useState("");
  const usdaResults = trpc.food.searchUSDA.useQuery(
    { query: usdaQuery },
    { enabled: usdaQuery.length > 0 },
  );

  // ─── Mutations ─────────────────────────────────────────────────
  const logEntry = trpc.meals.logEntry.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate({ date: dateStr });
      utils.meals.getByDate.invalidate({ date: dateStr });
      utils.food.getRecent.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to log food");
    },
  });

  const quickAdd = trpc.meals.quickAdd.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate({ date: dateStr });
      utils.meals.getByDate.invalidate({ date: dateStr });
      utils.food.getRecent.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to add calories");
    },
  });

  const createFood = trpc.food.create.useMutation({
    onSuccess: () => {
      utils.food.getFavorites.invalidate();
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────
  const handleAddFood = useCallback(
    async (food: FoodResult, servings: number) => {
      const cals = Math.round(food.calories * servings);
      const protein = Math.round(food.proteinG * servings);
      const carbs = Math.round(food.carbsG * servings);
      const fat = Math.round(food.fatG * servings);

      let foodItemId = food.id;

      // If USDA result, create local food item first
      if (food.source === "usda") {
        try {
          const created = await createFood.mutateAsync({
            name: food.name,
            brand: food.brand ?? undefined,
            calories: food.calories,
            proteinG: food.proteinG,
            carbsG: food.carbsG,
            fatG: food.fatG,
            servingSize: food.servingSize ?? undefined,
            servingUnit: food.servingUnit ?? undefined,
            source: "usda",
            sourceId: food.id,
          });
          foodItemId = created.id;
        } catch {
          toast.error("Failed to save food item");
          return;
        }
      }

      logEntry.mutate(
        {
          date: dateStr,
          mealType,
          foodItemId,
          servings,
          calories: cals,
          proteinG: protein,
          carbsG: carbs,
          fatG: fat,
        },
        {
          onSuccess: () => {
            toast.success(`Added to ${mealType}`, {
              description: `${food.name} - ${cals} cal`,
            });
          },
        },
      );
    },
    [dateStr, mealType, logEntry, createFood],
  );

  const handleQuickAdd = useCallback(() => {
    const cals = parseInt(quickCalAmount);
    if (!cals || cals <= 0) return;

    quickAdd.mutate(
      {
        date: dateStr,
        mealType,
        calories: cals,
        description: quickCalDescription || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Added to ${mealType}`, {
            description: `Quick add - ${cals} cal`,
          });
          setQuickCalAmount("");
          setQuickCalDescription("");
          setQuickCalMode(false);
        },
      },
    );
  }, [dateStr, mealType, quickCalAmount, quickCalDescription, quickAdd]);

  const handleSearchUSDA = useCallback(() => {
    if (debouncedQuery) {
      setUsdaQuery(debouncedQuery);
    }
  }, [debouncedQuery]);

  // Map food items to FoodResult
  function toFoodResult(item: {
    id: string;
    name: string;
    brand?: string | null;
    calories?: string | null;
    proteinG?: string | null;
    carbsG?: string | null;
    fatG?: string | null;
    servingSize?: string | null;
    servingUnit?: string | null;
    source?: string | null;
  }): FoodResult {
    return {
      id: item.id,
      name: item.name,
      brand: item.brand,
      calories: Number(item.calories ?? 0),
      proteinG: Number(item.proteinG ?? 0),
      carbsG: Number(item.carbsG ?? 0),
      fatG: Number(item.fatG ?? 0),
      servingSize: item.servingSize,
      servingUnit: item.servingUnit,
      source: item.source,
    };
  }

  const isSearching = debouncedQuery.length > 0;
  const localResults = isSearching
    ? (searchResults.data ?? []).map(toFoodResult)
    : [];
  const recentResults = !isSearching
    ? (recentFoods.data ?? []).map(toFoodResult)
    : [];
  const usdaMapped = (usdaResults.data ?? []).map((item, i) => ({
    id: item.sourceId ?? `usda-${i}`,
    name: item.name,
    brand: item.brand,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    servingSize: item.servingSize,
    servingUnit: item.servingUnit,
    source: "usda" as const,
  } satisfies FoodResult));
  const showUSDAButton =
    isSearching && localResults.length < 5 && !usdaQuery;

  const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl bg-[#0A0A0C]">
          {/* Handle */}
          <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-text-disabled/30" />

          {/* Header */}
          <div className="px-5 pt-4 pb-2">
            <Drawer.Title className="text-lg font-semibold text-text-primary">
              Add Food
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Search and add food to your diary
            </Drawer.Description>

            {/* Meal type selector */}
            <div className="mt-3 flex gap-2">
              {mealTypes.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMealType(mt)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    mealType === mt
                      ? "bg-primary text-primary-foreground"
                      : "bg-[#1C1C22] text-text-tertiary"
                  }`}
                >
                  {mt}
                </button>
              ))}
            </div>

            {/* Search bar */}
            <div
              className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{
                backgroundColor: "#24242C",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-tertiary flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setUsdaQuery("");
                }}
                placeholder="Search foods..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled outline-none"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setDebouncedQuery("");
                    setUsdaQuery("");
                  }}
                  className="text-text-tertiary"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
              {/* Mic button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setVoiceMode(true)}
                className="flex-shrink-0 rounded-lg p-1 text-text-tertiary transition-colors hover:text-primary"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </motion.button>
            </div>

            {/* Action row */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setQuickCalMode(!quickCalMode)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  quickCalMode
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-white/6 bg-[#1C1C22] text-text-secondary"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Quick Cal
              </button>
              <button
                className="flex items-center gap-1.5 rounded-lg border bg-[#1C1C22] px-3 py-2 text-xs font-medium text-text-secondary"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M7 7v10M12 7v10M17 7v10" />
                </svg>
                Scan Barcode
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-safe">
            {/* Voice Input Mode */}
            {voiceMode ? (
              <VoiceInput
                mealType={mealType}
                dateStr={dateStr}
                onAddFood={handleAddFood}
                onClose={() => setVoiceMode(false)}
              />
            ) : (
            <>
            {/* Quick Cal Mode */}
            <AnimatePresence>
              {quickCalMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mb-4 rounded-xl border p-4"
                    style={{
                      backgroundColor: "#141418",
                      borderColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-sm font-medium text-text-primary mb-3">
                      Quick Add Calories
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={quickCalDescription}
                        onChange={(e) => setQuickCalDescription(e.target.value)}
                        placeholder="Description (optional)"
                        className="rounded-lg border bg-[#24242C] px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled outline-none"
                        style={{ borderColor: "rgba(255,255,255,0.08)" }}
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={quickCalAmount}
                          onChange={(e) => setQuickCalAmount(e.target.value)}
                          placeholder="Calories"
                          className="flex-1 rounded-lg border bg-[#24242C] px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled outline-none"
                          style={{ borderColor: "rgba(255,255,255,0.08)" }}
                        />
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handleQuickAdd}
                          disabled={
                            !quickCalAmount ||
                            parseInt(quickCalAmount) <= 0 ||
                            quickAdd.isPending
                          }
                          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {quickAdd.isPending ? "..." : "Add"}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results section */}
            {!isSearching ? (
              /* Recent foods */
              <div className="pb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Recent
                </p>
                {recentFoods.isLoading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded-xl"
                        style={{ backgroundColor: "#141418" }}
                      />
                    ))}
                  </div>
                ) : recentResults.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-disabled">
                    No recent foods yet. Search to get started!
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentResults.map((food) => (
                      <FoodResultCard
                        key={food.id}
                        food={food}
                        onAdd={handleAddFood}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Search results */
              <div className="pb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Results
                </p>
                {searchResults.isLoading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded-xl"
                        style={{ backgroundColor: "#141418" }}
                      />
                    ))}
                  </div>
                ) : localResults.length === 0 && !usdaQuery ? (
                  <p className="py-8 text-center text-sm text-text-disabled">
                    No local results for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {localResults.map((food) => (
                      <FoodResultCard
                        key={food.id}
                        food={food}
                        onAdd={handleAddFood}
                      />
                    ))}
                  </div>
                )}

                {/* Search USDA button */}
                {showUSDAButton && (
                  <button
                    onClick={handleSearchUSDA}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    Search USDA Database
                  </button>
                )}

                {/* USDA Results */}
                {usdaQuery && (
                  <div className="mt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      USDA Results
                    </p>
                    {usdaResults.isLoading ? (
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 animate-pulse rounded-xl"
                            style={{ backgroundColor: "#141418" }}
                          />
                        ))}
                      </div>
                    ) : usdaMapped.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-disabled">
                        No USDA results found
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {usdaMapped.map((food) => (
                          <FoodResultCard
                            key={food.id}
                            food={food}
                            onAdd={handleAddFood}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
