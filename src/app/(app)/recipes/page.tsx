"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Plus,
  Clock,
  Users,
  ChefHat,
  Loader2,
  X,
} from "lucide-react";

// ─── Macro bar ────────────────────────────────────────────────────
function MacroBar({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const total = protein + carbs + fat;
  if (total === 0) return null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      <div
        className="h-full"
        style={{
          width: `${(protein / total) * 100}%`,
          backgroundColor: "var(--protein)",
        }}
      />
      <div
        className="h-full"
        style={{
          width: `${(carbs / total) * 100}%`,
          backgroundColor: "var(--carbs)",
        }}
      />
      <div
        className="h-full"
        style={{
          width: `${(fat / total) * 100}%`,
          backgroundColor: "var(--fat)",
        }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function RecipesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const recipesQuery = trpc.recipes.list.useQuery();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const recipes = (recipesQuery.data ?? []).filter((r) => {
    if (!debouncedQuery) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-2xl font-light tracking-tight text-text-primary">
          Recipes
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Build and manage your recipes.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes..."
          className="h-12 bg-surface-1 border pl-10 pr-10 text-base"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-primary"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading */}
      {recipesQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
          <span className="text-sm text-text-tertiary">
            Loading recipes...
          </span>
        </div>
      )}

      {/* Recipe cards */}
      {!recipesQuery.isLoading && recipes.length > 0 && (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {recipes.map((recipe) => {
              const servings = Number(recipe.servings ?? 1) || 1;
              const totalTime =
                (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

              return (
                <motion.div
                  key={recipe.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 35,
                  }}
                >
                  <Link href={`/recipes/${recipe.id}`}>
                    <div
                      className="overflow-hidden rounded-2xl border bg-surface-1 p-4 transition-colors active:bg-surface-2"
                      style={{ borderColor: "rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {recipe.name}
                          </p>
                          {recipe.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-text-tertiary">
                              {recipe.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                          <span
                            className="text-sm font-medium text-text-primary"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {recipe.caloriesPerServing} cal
                          </span>
                          <span className="text-[10px] text-text-disabled">
                            per serving
                          </span>
                        </div>
                      </div>

                      {/* Macro bar */}
                      <div className="mt-3 w-full">
                        <MacroBar
                          protein={recipe.proteinPerServing}
                          carbs={recipe.carbsPerServing}
                          fat={recipe.fatPerServing}
                        />
                      </div>

                      {/* Meta row */}
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <ChefHat size={12} />
                          {servings} {servings === 1 ? "serving" : "servings"}
                        </span>
                        {totalTime > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {totalTime} min
                          </span>
                        )}
                        {recipe.isShared && (
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            Shared
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <span style={{ color: "var(--protein)" }}>
                            P {recipe.proteinPerServing}g
                          </span>
                          <span className="text-text-disabled">/</span>
                          <span style={{ color: "var(--carbs)" }}>
                            C {recipe.carbsPerServing}g
                          </span>
                          <span className="text-text-disabled">/</span>
                          <span style={{ color: "var(--fat)" }}>
                            F {recipe.fatPerServing}g
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {!recipesQuery.isLoading && recipes.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <ChefHat size={40} className="text-text-disabled" />
          <p className="text-sm text-text-tertiary">
            {debouncedQuery
              ? `No recipes matching "${debouncedQuery}"`
              : "No recipes yet. Create your first one!"}
          </p>
        </div>
      )}

      {/* FAB — Create Recipe */}
      <Link href="/recipes/new">
        <motion.div
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Plus size={24} />
        </motion.div>
      </Link>
    </div>
  );
}
