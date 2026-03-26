"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Target,
  Scale,
  TrendingDown,
  TrendingUp,
  Activity,
  Loader2,
  Sparkles,
  Check,
  X,
  Plus,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────
const GOALS = [
  {
    id: "lose",
    label: "Lose Weight",
    icon: TrendingDown,
    description: "Cut calories to drop body fat",
    color: "#F87171",
  },
  {
    id: "maintain",
    label: "Maintain",
    icon: Scale,
    description: "Stay at your current weight",
    color: "#60A5FA",
  },
  {
    id: "gain",
    label: "Gain Muscle",
    icon: TrendingUp,
    description: "Surplus calories for growth",
    color: "#34D399",
  },
] as const;

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", multiplier: 1.2, description: "Office job, little exercise" },
  { id: "light", label: "Lightly Active", multiplier: 1.375, description: "Light exercise 1-3 days/week" },
  { id: "active", label: "Active", multiplier: 1.55, description: "Moderate exercise 3-5 days/week" },
  { id: "very_active", label: "Very Active", multiplier: 1.725, description: "Hard exercise 6-7 days/week" },
] as const;

const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI", description: "GPT-4o" },
  { id: "anthropic", label: "Anthropic", description: "Claude" },
  { id: "google", label: "Google", description: "Gemini" },
] as const;

type GoalType = "lose" | "maintain" | "gain";
type ActivityLevel = "sedentary" | "light" | "active" | "very_active";

// ─── Mifflin-St Jeor estimate ─────────────────────────────────────
function estimateCalories(
  weightLbs: number,
  goal: GoalType,
  activity: ActivityLevel,
): { calories: number; protein: number; carbs: number; fat: number } {
  // Rough BMR estimate (assumes average height/age — male formula baseline)
  const weightKg = weightLbs * 0.4536;
  const bmr = 10 * weightKg + 6.25 * 175 - 5 * 30 + 5; // ~average male baseline
  const multiplier =
    ACTIVITY_LEVELS.find((a) => a.id === activity)?.multiplier ?? 1.375;
  let tdee = Math.round(bmr * multiplier);

  if (goal === "lose") tdee -= 500;
  if (goal === "gain") tdee += 300;

  const calories = Math.max(1200, tdee);
  // Standard macro split
  const proteinCals = calories * 0.3;
  const carbsCals = calories * 0.4;
  const fatCals = calories * 0.3;

  return {
    calories,
    protein: Math.round(proteinCals / 4),
    carbs: Math.round(carbsCals / 4),
    fat: Math.round(fatCals / 9),
  };
}

// ─── Screen 1: Goals ──────────────────────────────────────────────
function GoalsScreen({
  goal,
  setGoal,
  currentWeight,
  setCurrentWeight,
  targetWeight,
  setTargetWeight,
  activityLevel,
  setActivityLevel,
  suggestedCalories,
}: {
  goal: GoalType;
  setGoal: (g: GoalType) => void;
  currentWeight: string;
  setCurrentWeight: (v: string) => void;
  targetWeight: string;
  setTargetWeight: (v: string) => void;
  activityLevel: ActivityLevel;
  setActivityLevel: (a: ActivityLevel) => void;
  suggestedCalories: { calories: number; protein: number; carbs: number; fat: number };
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-light tracking-tight text-text-primary">
          What&apos;s your goal?
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          We&apos;ll customize your targets based on this.
        </p>
      </div>

      {/* Goal cards */}
      <div className="flex flex-col gap-3">
        {GOALS.map((g) => {
          const Icon = g.icon;
          const selected = goal === g.id;
          return (
            <motion.button
              key={g.id}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setGoal(g.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-transparent bg-surface-1"
              }`}
              style={
                !selected
                  ? { borderColor: "rgba(255,255,255,0.06)" }
                  : undefined
              }
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${g.color}20` }}
              >
                <Icon size={22} style={{ color: g.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">
                  {g.label}
                </p>
                <p className="text-xs text-text-tertiary">{g.description}</p>
              </div>
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <Check size={18} className="text-primary" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Weight inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Current Weight (lbs)
          </Label>
          <Input
            type="number"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            placeholder="180"
            className="h-12 bg-surface-1 border-none text-base"
          />
        </div>
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Target Weight (lbs)
          </Label>
          <Input
            type="number"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            placeholder="Optional"
            className="h-12 bg-surface-1 border-none text-base"
          />
        </div>
      </div>

      {/* Activity level */}
      <div>
        <Label className="mb-2 text-xs text-text-secondary">
          Activity Level
        </Label>
        <div className="flex flex-col gap-2">
          {ACTIVITY_LEVELS.map((a) => {
            const selected = activityLevel === a.id;
            return (
              <motion.button
                key={a.id}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => setActivityLevel(a.id)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                  selected
                    ? "bg-primary/10 ring-1 ring-primary"
                    : "bg-surface-1"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {a.label}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {a.description}
                  </p>
                </div>
                {selected && <Check size={16} className="text-primary" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Suggested calories */}
      {currentWeight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="rounded-2xl border bg-surface-1 p-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Target size={16} className="text-primary" />
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Suggested Daily Target
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-semibold text-text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {suggestedCalories.calories}
            </span>
            <span className="text-sm text-text-tertiary">calories</span>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-text-tertiary">
            <span>
              <span style={{ color: "var(--protein)" }}>P</span>{" "}
              {suggestedCalories.protein}g
            </span>
            <span>
              <span style={{ color: "var(--carbs)" }}>C</span>{" "}
              {suggestedCalories.carbs}g
            </span>
            <span>
              <span style={{ color: "var(--fat)" }}>F</span>{" "}
              {suggestedCalories.fat}g
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Screen 2: Meal Types ─────────────────────────────────────────
function MealTypesScreen({
  mealTypes,
  setMealTypes,
  customMeal,
  setCustomMeal,
}: {
  mealTypes: string[];
  setMealTypes: (m: string[]) => void;
  customMeal: string;
  setCustomMeal: (v: string) => void;
}) {
  const toggle = (mt: string) => {
    if (mealTypes.includes(mt)) {
      setMealTypes(mealTypes.filter((m) => m !== mt));
    } else {
      setMealTypes([...mealTypes, mt]);
    }
  };

  const addCustom = () => {
    const trimmed = customMeal.trim();
    if (trimmed && !mealTypes.includes(trimmed)) {
      setMealTypes([...mealTypes, trimmed]);
      setCustomMeal("");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-light tracking-tight text-text-primary">
          Which meals do you eat?
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          We&apos;ll organize your daily log around these.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {[...DEFAULT_MEALS, ...mealTypes.filter((m) => !DEFAULT_MEALS.includes(m))].map(
          (mt) => {
            const checked = mealTypes.includes(mt);
            const isCustom = !DEFAULT_MEALS.includes(mt);
            return (
              <motion.button
                key={mt}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => toggle(mt)}
                className={`flex items-center justify-between rounded-2xl px-4 py-4 text-left transition-colors ${
                  checked
                    ? "bg-primary/10 ring-1 ring-primary"
                    : "bg-surface-1"
                }`}
              >
                <span className="text-sm font-medium text-text-primary">
                  {mt}
                </span>
                <div className="flex items-center gap-2">
                  {isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMealTypes(mealTypes.filter((m) => m !== mt));
                      }}
                      className="text-text-tertiary"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                      checked ? "bg-primary" : "bg-surface-2"
                    }`}
                  >
                    {checked && <Check size={14} className="text-white" />}
                  </div>
                </div>
              </motion.button>
            );
          },
        )}
      </div>

      {/* Custom meal input */}
      <div className="flex gap-2">
        <Input
          value={customMeal}
          onChange={(e) => setCustomMeal(e.target.value)}
          placeholder="Add custom meal type..."
          className="h-12 flex-1 bg-surface-1 border-none text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter") addCustom();
          }}
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={addCustom}
          disabled={!customMeal.trim()}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-1 text-primary disabled:opacity-40"
        >
          <Plus size={20} />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Screen 3: AI Setup ───────────────────────────────────────────
function AISetupScreen({
  aiProvider,
  setAiProvider,
  apiKey,
  setApiKey,
}: {
  aiProvider: string;
  setAiProvider: (p: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles size={24} className="text-primary" />
        </div>
        <h2 className="text-2xl font-light tracking-tight text-text-primary">
          Supercharge with AI
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Bring your own API key for AI features like smart food logging,
          meal suggestions, and nutrition coaching. Your key is stored
          securely and never shared.
        </p>
      </div>

      {/* Provider selector */}
      <div>
        <Label className="mb-2 text-xs text-text-secondary">
          AI Provider
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {AI_PROVIDERS.map((p) => {
            const selected = aiProvider === p.id;
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => setAiProvider(p.id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center transition-colors ${
                  selected
                    ? "bg-primary/10 ring-1 ring-primary"
                    : "bg-surface-1"
                }`}
              >
                <span className="text-sm font-medium text-text-primary">
                  {p.label}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {p.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* API key */}
      <div>
        <Label className="mb-1.5 text-xs text-text-secondary">
          API Key
        </Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="h-12 bg-surface-1 border-none text-base font-mono"
        />
        <p className="mt-1.5 text-[11px] text-text-disabled">
          Your key is encrypted and only used for your requests.
        </p>
      </div>

      {/* What AI does */}
      <div
        className="rounded-2xl border bg-surface-1 p-4"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <p className="mb-2 text-xs font-medium text-text-secondary">
          AI features include:
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-text-tertiary">
          <li className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-primary" />
            Photo-based food logging
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-primary" />
            Smart meal suggestions
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-primary" />
            Nutrition coaching chat
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-primary" />
            Natural language food search
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  // Screen 1 state
  const [goal, setGoal] = useState<GoalType>("maintain");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");

  // Screen 2 state
  const [mealTypes, setMealTypes] = useState<string[]>([...DEFAULT_MEALS]);
  const [customMeal, setCustomMeal] = useState("");

  // Screen 3 state
  const [aiProvider, setAiProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");

  const suggestedCalories = estimateCalories(
    Number(currentWeight) || 170,
    goal,
    activityLevel,
  );

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile set up!");
      router.push("/");
      router.refresh();
    },
    onError: (err) => toast.error(err.message ?? "Failed to save"),
  });

  const goNext = useCallback(() => {
    if (screen < 2) {
      setDirection(1);
      setScreen((s) => s + 1);
    }
  }, [screen]);

  const goBack = useCallback(() => {
    if (screen > 0) {
      setDirection(-1);
      setScreen((s) => s - 1);
    }
  }, [screen]);

  const handleComplete = () => {
    const cals = suggestedCalories;
    updateProfile.mutate({
      dailyCalorieTarget: cals.calories,
      proteinTargetG: cals.protein,
      carbsTargetG: cals.carbs,
      fatTargetG: cals.fat,
      mealTypes: mealTypes.length > 0 ? mealTypes : DEFAULT_MEALS,
      aiProvider,
      encryptedApiKey: apiKey || undefined,
    });
  };

  const handleSkipScreen = () => {
    if (screen < 2) {
      goNext();
    } else {
      handleComplete();
    }
  };

  const slideVariants = {
    enter: (d: number) => ({
      x: d > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col pt-6 pb-8">
      {/* Top bar: back + skip */}
      <div className="mb-6 flex items-center justify-between">
        {screen > 0 ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-1"
          >
            <ArrowLeft size={18} className="text-text-secondary" />
          </motion.button>
        ) : (
          <div className="h-10 w-10" />
        )}
        <button
          onClick={handleSkipScreen}
          className="text-sm font-medium text-text-tertiary transition-colors hover:text-text-secondary"
        >
          Skip
        </button>
      </div>

      {/* Screen content */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screen}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className="w-full"
          >
            {screen === 0 && (
              <GoalsScreen
                goal={goal}
                setGoal={setGoal}
                currentWeight={currentWeight}
                setCurrentWeight={setCurrentWeight}
                targetWeight={targetWeight}
                setTargetWeight={setTargetWeight}
                activityLevel={activityLevel}
                setActivityLevel={setActivityLevel}
                suggestedCalories={suggestedCalories}
              />
            )}
            {screen === 1 && (
              <MealTypesScreen
                mealTypes={mealTypes}
                setMealTypes={setMealTypes}
                customMeal={customMeal}
                setCustomMeal={setCustomMeal}
              />
            )}
            {screen === 2 && (
              <AISetupScreen
                aiProvider={aiProvider}
                setAiProvider={setAiProvider}
                apiKey={apiKey}
                setApiKey={setApiKey}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom: progress dots + next button */}
      <div className="mt-8 flex flex-col gap-4">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                width: i === screen ? 24 : 8,
                backgroundColor:
                  i === screen ? "var(--primary)" : "var(--surface-3)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        {/* Next / Complete button */}
        <Button
          size="lg"
          className="w-full"
          onClick={screen === 2 ? handleComplete : goNext}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : screen === 2 ? (
            <Check size={16} />
          ) : (
            <ArrowRight size={16} />
          )}
          {updateProfile.isPending
            ? "Saving..."
            : screen === 2
              ? apiKey
                ? "Complete Setup"
                : "Skip & Finish"
              : "Next"}
        </Button>
      </div>
    </div>
  );
}
