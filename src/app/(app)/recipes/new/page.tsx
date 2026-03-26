"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  ChefHat,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────
type IngredientEntry = {
  localId: string;
  foodItemId: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  servingSize: number;
};

const UNITS = ["g", "oz", "cup", "tbsp", "tsp", "piece"];

// ─── Page ─────────────────────────────────────────────────────────
export default function NewRecipePage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(1);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(searchQuery),
      300,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const foodSearch = trpc.food.search.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 1 },
  );

  const createRecipe = trpc.recipes.create.useMutation({
    onSuccess: () => {
      toast.success("Recipe created!");
      router.push("/recipes");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create recipe"),
  });

  // ─── Nutrition totals ──────────────────────────────────────────
  const totals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let fiber = 0;

    for (const ing of ingredients) {
      const servSize = ing.servingSize || 1;
      const ratio = ing.quantity / servSize;
      calories += ing.calories * ratio;
      protein += ing.proteinG * ratio;
      carbs += ing.carbsG * ratio;
      fat += ing.fatG * ratio;
      fiber += ing.fiberG * ratio;
    }

    return { calories, protein, carbs, fat, fiber };
  }, [ingredients]);

  const perServing = useMemo(
    () => ({
      calories: Math.round(totals.calories / (servings || 1)),
      protein: Math.round(totals.protein / (servings || 1)),
      carbs: Math.round(totals.carbs / (servings || 1)),
      fat: Math.round(totals.fat / (servings || 1)),
      fiber: Math.round(totals.fiber / (servings || 1)),
    }),
    [totals, servings],
  );

  // ─── Handlers ──────────────────────────────────────────────────
  const addIngredient = (food: {
    id: string;
    name: string;
    calories: string | null;
    proteinG: string | null;
    carbsG: string | null;
    fatG: string | null;
    fiberG: string | null;
    servingSize: string | null;
    servingUnit: string | null;
  }) => {
    const servSize = Number(food.servingSize ?? 1) || 1;
    setIngredients((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        foodItemId: food.id,
        name: food.name,
        quantity: servSize,
        unit: food.servingUnit ?? "g",
        calories: Number(food.calories ?? 0),
        proteinG: Number(food.proteinG ?? 0),
        carbsG: Number(food.carbsG ?? 0),
        fatG: Number(food.fatG ?? 0),
        fiberG: Number(food.fiberG ?? 0),
        servingSize: servSize,
      },
    ]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const removeIngredient = (localId: string) => {
    setIngredients((prev) => prev.filter((i) => i.localId !== localId));
  };

  const updateIngredientQty = (localId: string, qty: number) => {
    setIngredients((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, quantity: qty } : i)),
    );
  };

  const updateIngredientUnit = (localId: string, unit: string) => {
    setIngredients((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, unit } : i)),
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Recipe name is required");
      return;
    }
    if (ingredients.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }

    createRecipe.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      servings,
      prepTimeMin: prepTime ? Number(prepTime) : undefined,
      cookTimeMin: cookTime ? Number(cookTime) : undefined,
      isShared,
      ingredients: ingredients.map((i) => ({
        foodItemId: i.foodItemId,
        quantity: i.quantity,
        unit: i.unit,
      })),
    });
  };

  return (
    <div className="flex flex-col gap-5 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/recipes">
          <motion.div
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-1"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <ArrowLeft size={18} className="text-text-secondary" />
          </motion.div>
        </Link>
        <h1 className="text-xl font-light tracking-tight text-text-primary">
          New Recipe
        </h1>
      </div>

      {/* Name */}
      <div>
        <Label className="mb-1.5 text-xs text-text-secondary">
          Recipe Name *
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chicken Stir Fry"
          className="h-12 bg-surface-1 border-none text-base"
        />
      </div>

      {/* Description */}
      <div>
        <Label className="mb-1.5 text-xs text-text-secondary">
          Description
        </Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes or instructions..."
          rows={2}
          className="w-full resize-none rounded-xl bg-surface-1 px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Servings stepper + time */}
      <div className="grid grid-cols-3 gap-3">
        {/* Servings */}
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Servings
          </Label>
          <div
            className="flex h-12 items-center justify-between rounded-xl bg-surface-1 px-2"
          >
            <motion.button
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-secondary"
            >
              <Minus size={14} />
            </motion.button>
            <span
              className="text-sm font-medium text-text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {servings}
            </span>
            <motion.button
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setServings(Math.min(20, servings + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-secondary"
            >
              <Plus size={14} />
            </motion.button>
          </div>
        </div>

        {/* Prep time */}
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Prep (min)
          </Label>
          <Input
            type="number"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="0"
            className="h-12 bg-surface-1 border-none text-center"
          />
        </div>

        {/* Cook time */}
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Cook (min)
          </Label>
          <Input
            type="number"
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            placeholder="0"
            className="h-12 bg-surface-1 border-none text-center"
          />
        </div>
      </div>

      {/* Share toggle */}
      <div className="flex items-center justify-between rounded-2xl bg-surface-1 px-4 py-3.5">
        <span className="text-sm text-text-primary">Share with group</span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={() => setIsShared(!isShared)}
          className={`relative h-7 w-12 rounded-full transition-colors ${
            isShared ? "bg-primary" : "bg-surface-3"
          }`}
        >
          <motion.span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm"
            animate={{ x: isShared ? 22 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </motion.button>
      </div>

      {/* ─── Ingredients Section ────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-text-primary">
            Ingredients ({ingredients.length})
          </p>
        </div>

        {/* Ingredient search */}
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => searchQuery && setSearchOpen(true)}
            placeholder="Search foods to add..."
            className="h-12 bg-surface-1 border pl-10 pr-10 text-base"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            >
              <X size={16} />
            </button>
          )}

          {/* Search results dropdown */}
          <AnimatePresence>
            {searchOpen && debouncedSearch.length >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-2xl border bg-surface-1 shadow-xl"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                {foodSearch.isLoading && (
                  <div className="flex items-center gap-2 px-4 py-3">
                    <Loader2
                      size={14}
                      className="animate-spin text-text-tertiary"
                    />
                    <span className="text-sm text-text-tertiary">
                      Searching...
                    </span>
                  </div>
                )}
                {!foodSearch.isLoading &&
                  (foodSearch.data ?? []).length === 0 && (
                    <div className="px-4 py-3 text-sm text-text-tertiary">
                      No foods found
                    </div>
                  )}
                {(foodSearch.data ?? []).map((food) => (
                  <motion.button
                    key={food.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addIngredient(food)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {food.name}
                      </p>
                      {food.brand && (
                        <p className="text-[11px] text-text-tertiary">
                          {food.brand}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="text-xs text-text-tertiary">
                        {Math.round(Number(food.calories ?? 0))} cal
                      </span>
                      <Plus size={14} className="text-primary" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ingredient list */}
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {ingredients.map((ing) => {
              const servSize = ing.servingSize || 1;
              const ratio = ing.quantity / servSize;
              const ingCals = Math.round(ing.calories * ratio);

              return (
                <motion.div
                  key={ing.localId}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="overflow-hidden"
                >
                  <div
                    className="rounded-2xl border bg-surface-1 p-3"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {ing.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-tertiary">
                          {ingCals} cal
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                        onClick={() => removeIngredient(ing.localId)}
                        className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-text-tertiary"
                      >
                        <X size={14} />
                      </motion.button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        value={ing.quantity || ""}
                        onChange={(e) =>
                          updateIngredientQty(
                            ing.localId,
                            Number(e.target.value) || 0,
                          )
                        }
                        className="h-9 w-20 bg-surface-2 border-none text-center text-sm"
                      />
                      <select
                        value={ing.unit}
                        onChange={(e) =>
                          updateIngredientUnit(ing.localId, e.target.value)
                        }
                        className="h-9 rounded-lg bg-surface-2 px-2 text-sm text-text-primary outline-none"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {ingredients.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-8"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <ChefHat size={28} className="text-text-disabled" />
            <p className="text-sm text-text-tertiary">
              Search above to add ingredients
            </p>
          </div>
        )}
      </div>

      {/* ─── Live Nutrition Totals ──────────────────────────────── */}
      {ingredients.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="rounded-2xl border bg-surface-1 p-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
            Nutrition Totals
          </p>

          {/* Per serving */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text-secondary">Per serving</span>
            <span
              className="text-lg font-semibold text-text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {perServing.calories} cal
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <NutrientPill
              label="Protein"
              value={perServing.protein}
              unit="g"
              color="var(--protein)"
            />
            <NutrientPill
              label="Carbs"
              value={perServing.carbs}
              unit="g"
              color="var(--carbs)"
            />
            <NutrientPill
              label="Fat"
              value={perServing.fat}
              unit="g"
              color="var(--fat)"
            />
            <NutrientPill
              label="Fiber"
              value={perServing.fiber}
              unit="g"
              color="var(--text-tertiary)"
            />
          </div>

          {/* Total */}
          <div
            className="mt-3 border-t pt-3"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span>Total ({servings} {servings === 1 ? "serving" : "servings"})</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(totals.calories)} cal | P{" "}
                {Math.round(totals.protein)}g | C {Math.round(totals.carbs)}g |
                F {Math.round(totals.fat)}g
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Save Button ───────────────────────────────────────── */}
      <Button
        size="lg"
        onClick={handleSave}
        disabled={
          !name.trim() ||
          ingredients.length === 0 ||
          createRecipe.isPending
        }
        className="w-full"
      >
        {createRecipe.isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ChefHat size={16} />
        )}
        {createRecipe.isPending ? "Saving..." : "Save Recipe"}
      </Button>
    </div>
  );
}

// ─── Nutrient pill ─────────────────────────────────────────────────
function NutrientPill({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-sm font-medium"
        style={{ color, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
        {unit}
      </span>
      <span className="text-[10px] text-text-disabled">{label}</span>
    </div>
  );
}
