"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { format, subDays, isToday, getDay } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ActivityRings } from "@/components/dashboard/activity-rings";
import { DateSelector } from "@/components/dashboard/date-selector";
import { MealSection, type FoodEntry } from "@/components/dashboard/meal-section";
import { MacroSummary } from "@/components/dashboard/macro-summary";
import { QuickAddSheet } from "@/components/quick-add/quick-add-sheet";
import { AISuggestions } from "@/components/dashboard/ai-suggestions";
import { motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";

// ─── Training day helpers ────────────────────────────────────────

interface TrainingTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function getTrainingTargets(): TrainingTargets | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("training_targets");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getTrainingDays(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("training_days");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function checkIsTrainingDay(date: Date): boolean {
  const days = getTrainingDays();
  const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ...
  return days.includes(dayOfWeek);
}

function getTrainingDayEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("training_day_enabled") === "true";
}

// ─── Meal reminder helpers ───────────────────────────────────────

interface MealReminder {
  mealType: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

function getMealReminders(): MealReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("meal_reminders");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

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

const FALLBACK_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

// ─── Page ────────────────────────────────────────────────────────

function getMealTypeFromHour(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snack";
}

export default function DashboardPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMealType, setQuickAddMealType] = useState(getMealTypeFromHour);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const utils = trpc.useUtils();

  // ─── Onboarding check ──────────────────────────────────────────
  const onboardProfileQuery = trpc.user.getProfile.useQuery(undefined, {
    staleTime: Infinity,
  });
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const onboardMealsQuery = trpc.meals.getByDate.useQuery(
    { date: todayStr },
    { enabled: !!onboardProfileQuery.data },
  );

  useEffect(() => {
    if (!onboardProfileQuery.data || onboardMealsQuery.isLoading) return;
    const profile = onboardProfileQuery.data;
    const meals = onboardMealsQuery.data;
    const hasNoMeals =
      !meals || Object.keys(meals).length === 0 ||
      Object.values(meals).every((logs) => logs.length === 0);
    const isDefaultTarget = profile.dailyCalorieTarget === 2000;

    if (isDefaultTarget && hasNoMeals) {
      router.push("/onboarding");
    }
  }, [onboardProfileQuery.data, onboardMealsQuery.data, onboardMealsQuery.isLoading, router]);

  // ─── Pull-to-refresh state ─────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, 40, 80], [0, 0.5, 1]);
  const pullRotation = useTransform(pullY, [0, 80], [0, 360]);
  const pullScale = useTransform(pullY, [0, 40, 80], [0.5, 0.8, 1]);
  const indicatorHeight = useTransform(pullY, [0, 80], [0, 48]);

  const handlePullEnd = useCallback(async () => {
    const currentY = pullY.get();
    if (currentY > 50 && !isRefreshing) {
      setIsRefreshing(true);
      await Promise.all([
        utils.daily.get.invalidate(),
        utils.meals.getByDate.invalidate(),
      ]);
      setIsRefreshing(false);
    }
  }, [pullY, isRefreshing, utils]);

  // ─── Training day state ────────────────────────────────────────
  const [trainingEnabled, setTrainingEnabled] = useState(false);
  const [trainingTargets, setTrainingTargets] = useState<TrainingTargets | null>(null);
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    setTrainingEnabled(getTrainingDayEnabled());
    setTrainingTargets(getTrainingTargets());
    setIsTraining(checkIsTrainingDay(selectedDate));
  }, [selectedDate]);

  // ─── Meal reminders ────────────────────────────────────────────
  const firedReminders = useRef<Set<string>>(new Set());

  useEffect(() => {
    const reminders = getMealReminders();
    if (reminders.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      for (const r of reminders) {
        if (!r.enabled) continue;
        const key = `${r.mealType}-${dateStr}`;
        if (firedReminders.current.has(key)) continue;

        if (r.hour === currentHour && Math.abs(r.minute - currentMin) <= 1) {
          firedReminders.current.add(key);
          toast(`Time for ${r.mealType}!`, {
            description: "Tap to log your meal.",
            action: {
              label: "Log",
              onClick: () => {
                setQuickAddMealType(r.mealType);
                setQuickAddOpen(true);
              },
            },
            duration: 10000,
          });
        }
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [dateStr]);

  // ─── Queries ─────────────────────────────────────────────────
  const dailyQuery = trpc.daily.get.useQuery({ date: dateStr });
  const mealsQuery = trpc.meals.getByDate.useQuery({ date: dateStr });
  const profileQuery = trpc.user.getProfile.useQuery();
  const hasAiKey = !!profileQuery.data?.encryptedApiKey;

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

  const copyMeal = trpc.meals.copyMeal.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate({ date: dateStr });
      utils.meals.getByDate.invalidate({ date: dateStr });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to copy meal");
    },
  });

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      deleteEntry.mutate({ entryId });
    },
    [deleteEntry],
  );

  const handleCopyYesterday = useCallback(async () => {
    const yesterdayStr = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    const promises = userMealTypes.map((mt) =>
      copyMeal.mutateAsync({
        fromDate: yesterdayStr,
        fromMealType: mt,
        toDate: dateStr,
        toMealType: mt,
      }).catch(() => null),
    );
    await Promise.all(promises);
    toast.success("Copied yesterday's meals");
  }, [copyMeal, selectedDate, dateStr]);

  const handleCopyMealFromDate = useCallback(
    async (mealType: string, fromDate: string) => {
      await copyMeal.mutateAsync({
        fromDate,
        fromMealType: mealType,
        toDate: dateStr,
        toMealType: mealType,
      });
      toast.success(`Copied ${mealType} from ${fromDate}`);
    },
    [copyMeal, dateStr],
  );

  // ─── Derived data ────────────────────────────────────────────
  const consumed = dailyQuery.data?.consumed ?? {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
  };

  const serverTargets = dailyQuery.data?.targets ?? {
    calories: 2000,
    proteinG: 150,
    carbsG: 200,
    fatG: 65,
    fiberG: 25,
  };

  // Override targets if training day mode is enabled and it is a training day
  const targets = useMemo(() => {
    if (trainingEnabled && isTraining && trainingTargets) {
      return {
        calories: trainingTargets.calories,
        proteinG: trainingTargets.protein,
        carbsG: trainingTargets.carbs,
        fatG: trainingTargets.fat,
        fiberG: serverTargets.fiberG,
      };
    }
    return serverTargets;
  }, [trainingEnabled, isTraining, trainingTargets, serverTargets]);

  // Use profile meal types (ordered by user) or fallback
  const userMealTypes: string[] = profileQuery.data?.mealTypes ?? FALLBACK_MEAL_TYPES;

  // Build meal sections from API data
  const mealSections = useMemo(() => {
    const grouped = mealsQuery.data ?? {};
    const sections: Record<string, FoodEntry[]> = {};

    for (const mt of userMealTypes) {
      sections[mt] = [];
    }

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
  }, [mealsQuery.data, userMealTypes]);

  const isLoading = dailyQuery.isLoading || mealsQuery.isLoading;

  const totalEntries = useMemo(
    () => Object.values(mealSections).reduce((sum, entries) => sum + entries.length, 0),
    [mealSections],
  );
  const showCopyYesterday = isToday(selectedDate) && totalEntries === 0 && !isLoading;

  // Show user's meal types (in their order) + any extra types from logged data
  const visibleMealTypes = useMemo(() => {
    const ordered = [...userMealTypes];
    for (const mt of Object.keys(mealSections)) {
      if (!ordered.includes(mt)) ordered.push(mt);
    }
    return ordered;
  }, [userMealTypes, mealSections]);

  return (
    <div className="flex flex-col gap-6 pt-4 pb-4">
      {/* Pull-to-refresh indicator */}
      <motion.div
        className="flex items-center justify-center overflow-hidden"
        style={{ opacity: pullOpacity, height: indicatorHeight }}
      >
        {isRefreshing ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
            style={{ rotate: pullRotation, scale: pullScale }}
          >
            <path d="M12 2v6" />
            <path d="m9 5 3-3 3 3" />
            <path d="M21 12a9 9 0 1 1-9-9" />
          </motion.svg>
        )}
      </motion.div>

      {/* Pull-to-refresh drag surface wrapping all content */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        style={{ y: pullY }}
        onDragEnd={() => handlePullEnd()}
        className="flex flex-col gap-6"
      >
        {/* Date selector */}
        <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {/* Training/rest day badge */}
        {trainingEnabled && (
          <div className="flex justify-center -mt-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isTraining
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-2 text-text-tertiary"
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isTraining ? (
                  <path d="M6 4v16M18 4v16M2 12h4M18 12h4M6 8h12M6 16h12" />
                ) : (
                  <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
                )}
              </svg>
              {isTraining ? "Training Day" : "Rest Day"}
            </span>
          </div>
        )}

        {/* Copy from yesterday */}
        {showCopyYesterday && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleCopyYesterday}
            disabled={copyMeal.isPending}
            className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            style={{ backgroundColor: "rgba(99,102,241,0.08)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copyMeal.isPending ? "Copying..." : "Copy from yesterday"}
          </motion.button>
        )}

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

        {/* AI Suggestions */}
        {hasAiKey && (
          <AISuggestions
            selectedDate={selectedDate}
            dateStr={dateStr}
            onQuickAdd={(mt) => {
              setQuickAddMealType(mt);
              setQuickAddOpen(true);
            }}
          />
        )}

        {/* Meal sections */}
        <div className="flex flex-col gap-3">
          {isLoading
            ? userMealTypes.map((mt) => <MealSkeleton key={mt} />)
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
                    onAddFood={() => {
                      setQuickAddMealType(mt);
                      setQuickAddOpen(true);
                    }}
                    onCopyFromDate={(fromDate) =>
                      handleCopyMealFromDate(mt, fromDate)
                    }
                    isCopying={copyMeal.isPending}
                  />
                );
              })}
        </div>
      </motion.div>

      {/* Chat FAB */}
      <Link href="/chat">
        <motion.div
          className="fixed bottom-40 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
          style={{ backgroundColor: "var(--surface-2)" }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
            <path d="M9 11h.01" />
            <path d="M12 11h.01" />
            <path d="M15 11h.01" />
          </svg>
        </motion.div>
      </Link>

      {/* Quick Add FAB */}
      <motion.button
        onClick={() => {
          setQuickAddMealType(getMealTypeFromHour());
          setQuickAddOpen(true);
        }}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-primary/25"
        style={{ backgroundColor: "#6366F1" }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </motion.button>

      <QuickAddSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        selectedDate={selectedDate}
        defaultMealType={quickAddMealType}
      />
    </div>
  );
}
