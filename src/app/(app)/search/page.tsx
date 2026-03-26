"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Drawer } from "vaul";
import {
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  ChefHat,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────
type FoodItem = {
  id: string;
  name: string;
  brand?: string | null;
  calories?: string | null;
  proteinG?: string | null;
  carbsG?: string | null;
  fatG?: string | null;
  fiberG?: string | null;
  sugarG?: string | null;
  sodiumMg?: string | null;
  servingSize?: string | null;
  servingUnit?: string | null;
  source?: string | null;
  isShared?: boolean | null;
};

// ─── Tabs ─────────────────────────────────────────────────────────
type TabValue = "all" | "my-foods" | "shared";
const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "my-foods", label: "My Foods" },
  { value: "shared", label: "Shared" },
];

// ─── Macro bar (thin colored bar showing P/C/F ratio) ────────────
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
  const pPct = (protein / total) * 100;
  const cPct = (carbs / total) * 100;
  const fPct = (fat / total) * 100;

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      <div
        className="h-full"
        style={{ width: `${pPct}%`, backgroundColor: "var(--protein)" }}
      />
      <div
        className="h-full"
        style={{ width: `${cPct}%`, backgroundColor: "var(--carbs)" }}
      />
      <div
        className="h-full"
        style={{ width: `${fPct}%`, backgroundColor: "var(--fat)" }}
      />
    </div>
  );
}

// ─── Food card ────────────────────────────────────────────────────
function FoodCard({ food }: { food: FoodItem }) {
  const [expanded, setExpanded] = useState(false);
  const cal = Number(food.calories ?? 0);
  const p = Number(food.proteinG ?? 0);
  const c = Number(food.carbsG ?? 0);
  const f = Number(food.fatG ?? 0);
  const fiber = Number(food.fiberG ?? 0);
  const sugar = Number(food.sugarG ?? 0);
  const sodium = Number(food.sodiumMg ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border bg-surface-1"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">
            {food.name}
          </p>
          {food.brand && (
            <p className="mt-0.5 truncate text-xs text-text-tertiary">
              {food.brand}
            </p>
          )}
          <div className="mt-2 w-full max-w-[180px]">
            <MacroBar protein={p} carbs={c} fat={f} />
          </div>
        </div>
        <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
          <span
            className="text-sm font-medium text-text-primary"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(cal)} cal
          </span>
          <span className="text-[10px] text-text-disabled">
            {food.servingSize
              ? `${food.servingSize}${food.servingUnit ? ` ${food.servingUnit}` : ""}`
              : "per serving"}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-text-tertiary" />
          ) : (
            <ChevronDown size={14} className="text-text-tertiary" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="overflow-hidden"
          >
            <div
              className="border-t px-4 py-3"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="grid grid-cols-3 gap-3">
                <MacroDetail label="Protein" value={p} unit="g" color="var(--protein)" />
                <MacroDetail label="Carbs" value={c} unit="g" color="var(--carbs)" />
                <MacroDetail label="Fat" value={f} unit="g" color="var(--fat)" />
                <MacroDetail label="Fiber" value={fiber} unit="g" color="var(--text-tertiary)" />
                <MacroDetail label="Sugar" value={sugar} unit="g" color="var(--text-tertiary)" />
                <MacroDetail label="Sodium" value={sodium} unit="mg" color="var(--text-tertiary)" />
              </div>
              {food.source && (
                <p className="mt-2 text-[10px] uppercase tracking-wide text-text-disabled">
                  Source: {food.source}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MacroDetail({
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
        {Math.round(value)}
        {unit}
      </span>
      <span className="text-[10px] text-text-disabled">{label}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className ?? ""}`}
    />
  );
}

// ─── Create Food Drawer ───────────────────────────────────────────
function CreateFoodDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const createFood = trpc.food.create.useMutation({
    onSuccess: () => {
      utils.food.getFavorites.invalidate();
      toast.success("Custom food created");
      onOpenChange(false);
      resetForm();
    },
    onError: () => toast.error("Failed to create food"),
  });

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [servingUnit, setServingUnit] = useState("");
  const [isShared, setIsShared] = useState(false);

  const resetForm = () => {
    setName("");
    setBrand("");
    setBarcode("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFiber("");
    setSugar("");
    setSodium("");
    setServingSize("");
    setServingUnit("");
    setIsShared(false);
  };

  const handleSubmit = () => {
    if (!name.trim() || !calories) return;
    createFood.mutate({
      name: name.trim(),
      brand: brand || undefined,
      barcode: barcode || undefined,
      calories: Number(calories),
      proteinG: protein ? Number(protein) : undefined,
      carbsG: carbs ? Number(carbs) : undefined,
      fatG: fat ? Number(fat) : undefined,
      fiberG: fiber ? Number(fiber) : undefined,
      sugarG: sugar ? Number(sugar) : undefined,
      sodiumMg: sodium ? Number(sodium) : undefined,
      servingSize: servingSize || undefined,
      servingUnit: servingUnit || undefined,
      isShared,
    });
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] max-w-lg flex-col rounded-t-2xl bg-surface-1 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-surface-3" />
          <div className="overflow-y-auto px-5 pb-8 pt-4">
            <Drawer.Title className="mb-4 text-lg font-semibold text-text-primary">
              Create Custom Food
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Enter nutrition information for a custom food item
            </Drawer.Description>

            <div className="flex flex-col gap-3">
              {/* Name & Brand */}
              <div>
                <Label className="mb-1.5 text-xs text-text-secondary">
                  Name *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Food name"
                  className="h-10 bg-surface-2 border-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Brand
                  </Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Brand"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Barcode
                  </Label>
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Barcode"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
              </div>

              {/* Nutrition */}
              <div className="mt-2">
                <p className="mb-2 text-xs font-medium text-text-secondary">
                  Nutrition per serving
                </p>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Calories *
                  </Label>
                  <Input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Protein (g)
                  </Label>
                  <Input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Carbs (g)
                  </Label>
                  <Input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Fat (g)
                  </Label>
                  <Input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Fiber (g)
                  </Label>
                  <Input
                    type="number"
                    value={fiber}
                    onChange={(e) => setFiber(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Sugar (g)
                  </Label>
                  <Input
                    type="number"
                    value={sugar}
                    onChange={(e) => setSugar(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Sodium (mg)
                  </Label>
                  <Input
                    type="number"
                    value={sodium}
                    onChange={(e) => setSodium(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
              </div>

              {/* Serving */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Serving Size
                  </Label>
                  <Input
                    value={servingSize}
                    onChange={(e) => setServingSize(e.target.value)}
                    placeholder="e.g. 100"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Serving Unit
                  </Label>
                  <Input
                    value={servingUnit}
                    onChange={(e) => setServingUnit(e.target.value)}
                    placeholder="e.g. g, oz, cup"
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
              </div>

              {/* Share toggle */}
              <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-3">
                <span className="text-sm text-text-primary">
                  Share with group
                </span>
                <button
                  onClick={() => setIsShared(!isShared)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    isShared ? "bg-primary" : "bg-surface-3"
                  }`}
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                    style={{
                      transform: isShared ? "translateX(22px)" : "translateX(2px)",
                    }}
                  />
                </button>
              </div>

              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={!name.trim() || !calories || createFood.isPending}
                className="mt-2 w-full"
              >
                {createFood.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {createFood.isPending ? "Creating..." : "Create Food"}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ─── Queries ──────────────────────────────────────────────────
  const searchEnabled = debouncedQuery.length >= 1;

  const localSearch = trpc.food.search.useQuery(
    { query: debouncedQuery },
    { enabled: searchEnabled && activeTab === "all" },
  );

  const sharedSearch = trpc.food.search.useQuery(
    { query: debouncedQuery, sharedOnly: true },
    { enabled: searchEnabled && activeTab === "shared" },
  );

  const usdaSearch = trpc.food.searchUSDA.useQuery(
    { query: debouncedQuery },
    { enabled: searchEnabled && activeTab === "all" },
  );

  const favorites = trpc.food.getFavorites.useQuery(undefined, {
    enabled: activeTab === "my-foods",
  });

  // ─── Compute results ─────────────────────────────────────────
  const getResults = useCallback((): FoodItem[] => {
    if (activeTab === "my-foods") {
      const items = favorites.data ?? [];
      if (!debouncedQuery) return items;
      const q = debouncedQuery.toLowerCase();
      return items.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand?.toLowerCase().includes(q),
      );
    }

    if (activeTab === "shared") {
      return (sharedSearch.data ?? []) as FoodItem[];
    }

    // "all" tab: merge local + USDA
    const local = (localSearch.data ?? []) as FoodItem[];
    const usda = (usdaSearch.data ?? []).map((u) => ({
      id: u.sourceId ?? u.name,
      name: u.name,
      brand: u.brand,
      calories: String(u.calories ?? 0),
      proteinG: String(u.proteinG ?? 0),
      carbsG: String(u.carbsG ?? 0),
      fatG: String(u.fatG ?? 0),
      source: "usda" as const,
    })) as FoodItem[];

    // Deduplicate by name
    const seen = new Set(local.map((f) => f.name.toLowerCase()));
    const merged = [...local];
    for (const u of usda) {
      const key = (u.name ?? "").toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(u);
      }
    }
    return merged;
  }, [activeTab, favorites.data, sharedSearch.data, localSearch.data, usdaSearch.data, debouncedQuery]);

  const results = getResults();
  const isSearching =
    (activeTab === "all" && (localSearch.isFetching || usdaSearch.isFetching)) ||
    (activeTab === "shared" && sharedSearch.isFetching) ||
    (activeTab === "my-foods" && favorites.isFetching);

  return (
    <div className="flex flex-col gap-4 pt-6 pb-4">
      {/* Page header */}
      <div className="mb-1">
        <h1 className="text-2xl font-light tracking-tight text-text-primary">
          Food Library
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Find foods and manage your custom items.
        </p>
      </div>

      {/* Recipes button */}
      <Link href="/recipes">
        <motion.div
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex items-center gap-3 rounded-2xl border bg-surface-1 px-4 py-3.5 transition-colors active:bg-surface-2"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <ChefHat size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">
              Recipe Builder
            </p>
            <p className="text-[11px] text-text-tertiary">
              Create and manage your recipes
            </p>
          </div>
          <ChevronDown
            size={16}
            className="-rotate-90 text-text-tertiary"
          />
        </motion.div>
      </Link>

      {/* Search bar */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods..."
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

      {/* Tabs */}
      <div className="flex rounded-lg bg-surface-1 p-1" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.value
                ? "bg-surface-2 text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create custom food button (shown on My Foods tab) */}
      {activeTab === "my-foods" && (
        <Button
          size="lg"
          variant="secondary"
          onClick={() => setDrawerOpen(true)}
          className="w-full"
        >
          <Plus size={14} />
          Create Custom Food
        </Button>
      )}

      {/* Loading */}
      {isSearching && (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
          <span className="text-sm text-text-tertiary">Searching...</span>
        </div>
      )}

      {/* Results */}
      {!isSearching && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((food) => (
            <FoodCard key={food.id} food={food} />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isSearching && results.length === 0 && searchEnabled && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Search size={32} className="text-text-disabled" />
          <p className="text-sm text-text-tertiary">
            No foods found for &quot;{debouncedQuery}&quot;
          </p>
        </div>
      )}

      {!isSearching && !searchEnabled && activeTab !== "my-foods" && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Search size={32} className="text-text-disabled" />
          <p className="text-sm text-text-tertiary">
            Search for foods to get started
          </p>
        </div>
      )}

      {!isSearching && activeTab === "my-foods" && !searchEnabled && results.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Plus size={32} className="text-text-disabled" />
          <p className="text-sm text-text-tertiary">
            No custom foods yet. Create one above!
          </p>
        </div>
      )}

      {/* Floating create button (for non my-foods tabs) */}
      {activeTab !== "my-foods" && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          style={{ maxWidth: "calc(100% - 40px)" }}
        >
          <Plus size={24} />
        </motion.button>
      )}

      {/* Create food drawer */}
      <CreateFoodDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
