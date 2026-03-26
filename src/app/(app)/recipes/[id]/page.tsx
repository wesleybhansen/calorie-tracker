"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Drawer } from "vaul";
import { format } from "date-fns";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  ChefHat,
  Clock,
  Users,
  Trash2,
  Pencil,
  UtensilsCrossed,
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
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

// ─── Page ─────────────────────────────────────────────────────────
export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;
  const utils = trpc.useUtils();

  const recipeQuery = trpc.recipes.getById.useQuery({ id: recipeId });
  const profileQuery = trpc.user.getProfile.useQuery();

  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addToMealOpen, setAddToMealOpen] = useState(false);

  // Edit form state
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

  // Add to meal state
  const [mealType, setMealType] = useState("Lunch");
  const [mealDate, setMealDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [mealServings, setMealServings] = useState(1);

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

  // Populate edit form when recipe loads
  useEffect(() => {
    if (recipeQuery.data) {
      const r = recipeQuery.data;
      setName(r.name);
      setDescription(r.description ?? "");
      setServings(Number(r.servings ?? 1) || 1);
      setPrepTime(r.prepTimeMin?.toString() ?? "");
      setCookTime(r.cookTimeMin?.toString() ?? "");
      setIsShared(r.isShared ?? false);
      setIngredients(
        r.ingredients.map((ing) => ({
          localId: ing.id,
          foodItemId: ing.foodItemId,
          name: ing.foodItem.name,
          quantity: Number(ing.quantity ?? 1),
          unit: ing.unit ?? "g",
          calories: Number(ing.foodItem.calories ?? 0),
          proteinG: Number(ing.foodItem.proteinG ?? 0),
          carbsG: Number(ing.foodItem.carbsG ?? 0),
          fatG: Number(ing.foodItem.fatG ?? 0),
          fiberG: Number(ing.foodItem.fiberG ?? 0),
          servingSize: Number(ing.foodItem.servingSize ?? 1) || 1,
        })),
      );
    }
  }, [recipeQuery.data]);

  const foodSearch = trpc.food.search.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 1 },
  );

  const updateRecipe = trpc.recipes.update.useMutation({
    onSuccess: () => {
      toast.success("Recipe updated!");
      setEditing(false);
      utils.recipes.getById.invalidate({ id: recipeId });
      utils.recipes.list.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to update"),
  });

  const deleteRecipe = trpc.recipes.delete.useMutation({
    onSuccess: () => {
      toast.success("Recipe deleted");
      router.push("/recipes");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete"),
  });

  const addToMeal = trpc.recipes.addToMeal.useMutation({
    onSuccess: () => {
      toast.success("Added to meal!");
      setAddToMealOpen(false);
      utils.meals.getByDate.invalidate();
      utils.daily.get.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to add to meal"),
  });

  // ─── Nutrition totals (for edit mode) ──────────────────────────
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

  const handleUpdate = () => {
    if (!name.trim() || ingredients.length === 0) return;
    updateRecipe.mutate({
      id: recipeId,
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

  const recipe = recipeQuery.data;
  const isOwner = recipe?.userId === profileQuery.data?.id;

  // ─── Loading ───────────────────────────────────────────────────
  if (recipeQuery.isLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 pt-32">
        <ChefHat size={40} className="text-text-disabled" />
        <p className="text-sm text-text-tertiary">Recipe not found</p>
        <Link href="/recipes">
          <Button variant="secondary" size="sm">
            Back to recipes
          </Button>
        </Link>
      </div>
    );
  }

  // ─── View mode ─────────────────────────────────────────────────
  if (!editing) {
    const totalTime = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

    return (
      <div className="flex flex-col gap-5 pt-4 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/recipes">
            <motion.div
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-1"
            >
              <ArrowLeft size={18} className="text-text-secondary" />
            </motion.div>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-light tracking-tight text-text-primary">
              {recipe.name}
            </h1>
          </div>
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-sm text-text-secondary">{recipe.description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <ChefHat size={14} />
            {Number(recipe.servings ?? 1)}{" "}
            {Number(recipe.servings ?? 1) === 1 ? "serving" : "servings"}
          </span>
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {totalTime} min
            </span>
          )}
          {recipe.isShared && (
            <span className="flex items-center gap-1">
              <Users size={14} />
              Shared
            </span>
          )}
        </div>

        {/* Nutrition summary */}
        <div
          className="rounded-2xl border bg-surface-1 p-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Per Serving
            </span>
            <span
              className="text-lg font-semibold text-text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {recipe.caloriesPerServing} cal
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <NutrientPill
              label="Protein"
              value={recipe.proteinPerServing}
              unit="g"
              color="var(--protein)"
            />
            <NutrientPill
              label="Carbs"
              value={recipe.carbsPerServing}
              unit="g"
              color="var(--carbs)"
            />
            <NutrientPill
              label="Fat"
              value={recipe.fatPerServing}
              unit="g"
              color="var(--fat)"
            />
            <NutrientPill
              label="Fiber"
              value={recipe.totalFiber}
              unit="g"
              color="var(--text-tertiary)"
            />
          </div>
        </div>

        {/* Ingredients list */}
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">
            Ingredients ({recipe.ingredients.length})
          </p>
          <div className="flex flex-col gap-2">
            {recipe.ingredients.map((ing) => (
              <div
                key={ing.id}
                className="flex items-center justify-between rounded-2xl border bg-surface-1 px-4 py-3"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {ing.foodItem.name}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {ing.quantity} {ing.unit}
                  </p>
                </div>
                <span
                  className="text-xs text-text-tertiary"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {Math.round(
                    Number(ing.foodItem.calories ?? 0) *
                      (Number(ing.quantity ?? 1) /
                        (Number(ing.foodItem.servingSize ?? 1) || 1)),
                  )}{" "}
                  cal
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => setAddToMealOpen(true)}
          >
            <UtensilsCrossed size={16} />
            Add to Meal
          </Button>
          {isOwner && (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => setEditing(true)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-1 text-text-secondary"
              >
                <Pencil size={18} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => setDeleteConfirm(true)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-1 text-red-400"
              >
                <Trash2 size={18} />
              </motion.button>
            </>
          )}
        </div>

        {/* Delete confirmation */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4"
            >
              <p className="mb-3 text-sm text-text-primary">
                Delete this recipe? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => deleteRecipe.mutate({ id: recipeId })}
                  disabled={deleteRecipe.isPending}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  {deleteRecipe.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add to Meal Drawer */}
        <Drawer.Root open={addToMealOpen} onOpenChange={setAddToMealOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80dvh] max-w-lg flex-col rounded-t-2xl bg-surface-1 outline-none">
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-surface-3" />
              <div className="px-5 pb-8 pt-4">
                <Drawer.Title className="mb-4 text-lg font-semibold text-text-primary">
                  Add to Meal
                </Drawer.Title>
                <Drawer.Description className="sr-only">
                  Choose meal type, date, and servings to log this recipe
                </Drawer.Description>

                <div className="flex flex-col gap-4">
                  {/* Meal type */}
                  <div>
                    <Label className="mb-2 text-xs text-text-secondary">
                      Meal Type
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {MEAL_TYPES.map((mt) => (
                        <motion.button
                          key={mt}
                          whileTap={{ scale: 0.95 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                          }}
                          onClick={() => setMealType(mt)}
                          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                            mealType === mt
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface-2 text-text-secondary"
                          }`}
                        >
                          {mt}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <Label className="mb-1.5 text-xs text-text-secondary">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={mealDate}
                      onChange={(e) => setMealDate(e.target.value)}
                      className="h-12 bg-surface-2 border-none"
                    />
                  </div>

                  {/* Servings */}
                  <div>
                    <Label className="mb-1.5 text-xs text-text-secondary">
                      Servings
                    </Label>
                    <div className="flex h-12 items-center justify-between rounded-xl bg-surface-2 px-3">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                        onClick={() =>
                          setMealServings(Math.max(0.5, mealServings - 0.5))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-text-secondary"
                      >
                        <Minus size={14} />
                      </motion.button>
                      <span
                        className="text-base font-medium text-text-primary"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {mealServings}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                        onClick={() =>
                          setMealServings(Math.min(10, mealServings + 0.5))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-text-secondary"
                      >
                        <Plus size={14} />
                      </motion.button>
                    </div>
                  </div>

                  {/* Preview calories */}
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="text-sm text-text-secondary">
                      Total calories
                    </span>
                    <span
                      className="text-base font-semibold text-text-primary"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {Math.round(recipe.caloriesPerServing * mealServings)} cal
                    </span>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() =>
                      addToMeal.mutate({
                        recipeId,
                        date: mealDate,
                        mealType,
                        servings: mealServings,
                      })
                    }
                    disabled={addToMeal.isPending}
                  >
                    {addToMeal.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {addToMeal.isPending ? "Adding..." : "Add to Meal"}
                  </Button>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  }

  // ─── Edit mode ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={() => setEditing(false)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-1"
        >
          <ArrowLeft size={18} className="text-text-secondary" />
        </motion.button>
        <h1 className="text-xl font-light tracking-tight text-text-primary">
          Edit Recipe
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
          rows={2}
          className="w-full resize-none rounded-xl bg-surface-1 px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Servings + time */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Servings
          </Label>
          <div className="flex h-12 items-center justify-between rounded-xl bg-surface-1 px-2">
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
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Prep (min)
          </Label>
          <Input
            type="number"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            className="h-12 bg-surface-1 border-none text-center"
          />
        </div>
        <div>
          <Label className="mb-1.5 text-xs text-text-secondary">
            Cook (min)
          </Label>
          <Input
            type="number"
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
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

      {/* Ingredients */}
      <div>
        <p className="mb-3 text-sm font-medium text-text-primary">
          Ingredients ({ingredients.length})
        </p>

        {/* Search */}
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
      </div>

      {/* Nutrition totals */}
      {ingredients.length > 0 && (
        <div
          className="rounded-2xl border bg-surface-1 p-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
            Nutrition Totals
          </p>
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
        </div>
      )}

      {/* Save button */}
      <Button
        size="lg"
        onClick={handleUpdate}
        disabled={
          !name.trim() ||
          ingredients.length === 0 ||
          updateRecipe.isPending
        }
        className="w-full"
      >
        {updateRecipe.isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ChefHat size={16} />
        )}
        {updateRecipe.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

// ─── Nutrient pill ──────────────────────────────────────────────
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
