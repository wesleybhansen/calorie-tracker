"use client";

import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { ActivityRings } from "@/components/dashboard/activity-rings";
import { DateSelector } from "@/components/dashboard/date-selector";
import { MealSection, type FoodEntry } from "@/components/dashboard/meal-section";
import { MacroSummary } from "@/components/dashboard/macro-summary";
import { QuickAddFAB } from "@/components/dashboard/quick-add-fab";

// ─── Skeleton shimmer ────────────────────────────────────────────

function RingsSkeleton() {
  return (
    <div className="flex justify-center">
      <div
        className="h-[280px] w-[280px] animate-pulse rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      />
    </div>
  );
}

function MacroSkeleton() {
  return (
    <div className="flex items-center justify-center gap-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-4 w-20 animate-pulse rounded"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

function MealSkeleton() {
  return (
    <div
      className="h-14 animate-pulse rounded-2xl"
      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
    />
  );
}

// ─── Default meal types ──────────────────────────────────────────

const DEFAULT_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

// ─── Page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const utils = trpc.useUtils();

  // ─── Queries ─────────────────────────────────────────────────
  const dailyQuery = trpc.daily.get.useQuery({ date: dateStr });
  const mealsQuery = trpc.meals.getByDate.useQuery({ date: dateStr });

  // ─── Mutations ───────────────────────────────────────────────
  const deleteEntry = trpc.meals.deleteEntry.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate({ date: dateStr });
      utils.meals.getByDate.invalidate({ date: dateStr });
      toast.success("Entry deleted");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete entry");
    },
  });

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      deleteEntry.mutate({ entryId });
    },
    [deleteEntry],
  );

  // ─── Derived data ────────────────────────────────────────────
  const consumed = dailyQuery.data?.consumed ?? {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
  };

  const targets = dailyQuery.data?.targets ?? {
    calories: 2000,
    proteinG: 150,
    carbsG: 200,
    fatG: 65,
    fiberG: 25,
  };

  // Build meal sections from API data
  const mealSections = useMemo(() => {
    const grouped = mealsQuery.data ?? {};
    const sections: Record<string, FoodEntry[]> = {};

    // Initialize all default meal types
    for (const mt of DEFAULT_MEAL_TYPES) {
      sections[mt] = [];
    }

    // Map API data to FoodEntry format
    for (const [mealType, logs] of Object.entries(grouped)) {
      if (!sections[mealType]) sections[mealType] = [];
      for (const log of logs) {
        for (const entry of log.entries) {
          const foodName =
            entry.foodItem?.name ?? entry.recipe?.name ?? "Unknown";
          const serving =
            entry.foodItem?.servingSize
              ? `${entry.foodItem.servingSize}${entry.foodItem.servingUnit ? ` ${entry.foodItem.servingUnit}` : ""}`
              : `${entry.servings ?? 1} serving`;

          sections[mealType].push({
            id: entry.id,
            name: foodName,
            serving,
            calories: Number(entry.calories ?? 0),
            protein: Number(entry.proteinG ?? 0),
            carbs: Number(entry.carbsG ?? 0),
            fat: Number(entry.fatG ?? 0),
          });
        }
      }
    }

    return sections;
  }, [mealsQuery.data]);

  const isLoading = dailyQuery.isLoading || mealsQuery.isLoading;

  // Get meal types that have entries + the default ones
  const visibleMealTypes = useMemo(() => {
    const allTypes = new Set(DEFAULT_MEAL_TYPES);
    for (const mt of Object.keys(mealSections)) {
      allTypes.add(mt);
    }
    // Keep ordered: defaults first, then any extras
    const ordered = [...DEFAULT_MEAL_TYPES];
    for (const mt of allTypes) {
      if (!ordered.includes(mt)) ordered.push(mt);
    }
    return ordered;
  }, [mealSections]);

  return (
    <div className="flex flex-col gap-6 pt-4 pb-4">
      {/* Date selector */}
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {/* Activity rings */}
      {isLoading ? (
        <RingsSkeleton />
      ) : (
        <div className="flex justify-center">
          <ActivityRings
            caloriesConsumed={consumed.calories}
            caloriesTarget={targets.calories}
            proteinConsumed={consumed.proteinG}
            proteinTarget={targets.proteinG}
            carbsConsumed={consumed.carbsG}
            carbsTarget={targets.carbsG}
            fatConsumed={consumed.fatG}
            fatTarget={targets.fatG}
          />
        </div>
      )}

      {/* Macro summary */}
      {isLoading ? (
        <MacroSkeleton />
      ) : (
        <MacroSummary
          proteinConsumed={consumed.proteinG}
          proteinTarget={targets.proteinG}
          carbsConsumed={consumed.carbsG}
          carbsTarget={targets.carbsG}
          fatConsumed={consumed.fatG}
          fatTarget={targets.fatG}
        />
      )}

      {/* Meal sections */}
      <div className="flex flex-col gap-3">
        {isLoading
          ? DEFAULT_MEAL_TYPES.map((mt) => <MealSkeleton key={mt} />)
          : visibleMealTypes.map((mt) => {
              const entries = mealSections[mt] ?? [];
              const totalCalories = entries.reduce(
                (sum, e) => sum + e.calories,
                0,
              );
              return (
                <MealSection
                  key={mt}
                  mealType={mt}
                  entries={entries}
                  totalCalories={totalCalories}
                  onDeleteEntry={handleDeleteEntry}
                />
              );
            })}
      </div>

      {/* FAB */}
      <QuickAddFAB selectedDate={selectedDate} />
    </div>
  );
}
