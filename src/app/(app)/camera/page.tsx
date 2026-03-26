"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

interface AnalyzedItem {
  name: string;
  estimatedWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: "high" | "medium" | "low";
}

// ─── Tab selector ─────────────────────────────────────────────────

function TabSelector({
  activeTab,
  onTabChange,
}: {
  activeTab: "barcode" | "photo";
  onTabChange: (tab: "barcode" | "photo") => void;
}) {
  return (
    <div className="relative flex rounded-xl bg-surface-1 p-1">
      <motion.div
        className="absolute inset-y-1 rounded-lg bg-primary"
        layout
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        style={{
          width: "calc(50% - 4px)",
          left: activeTab === "barcode" ? "4px" : "calc(50% + 0px)",
        }}
      />
      <button
        className={cn(
          "relative z-10 flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
          activeTab === "barcode"
            ? "text-primary-foreground"
            : "text-text-secondary"
        )}
        onClick={() => onTabChange("barcode")}
      >
        Scan Barcode
      </button>
      <button
        className={cn(
          "relative z-10 flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
          activeTab === "photo"
            ? "text-primary-foreground"
            : "text-text-secondary"
        )}
        onClick={() => onTabChange("photo")}
      >
        AI Photo
      </button>
    </div>
  );
}

// ─── Meal type selector ───────────────────────────────────────────

function MealTypeSelector({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (v: MealType) => void;
}) {
  const options: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
  return (
    <div className="flex gap-2">
      {options.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            value === m
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2 text-text-secondary hover:text-text-primary"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ─── Portion stepper ──────────────────────────────────────────────

function PortionStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary">Servings</span>
      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-1">
        <button
          onClick={() => onChange(Math.max(0.5, value - 0.5))}
          className="flex h-7 w-7 items-center justify-center text-lg font-medium text-text-secondary hover:text-text-primary"
        >
          -
        </button>
        <span className="min-w-[2rem] text-center text-sm font-semibold text-text-primary">
          {value}
        </span>
        <button
          onClick={() => onChange(value + 0.5)}
          className="flex h-7 w-7 items-center justify-center text-lg font-medium text-text-secondary hover:text-text-primary"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────

function ConfidenceBadge({
  confidence,
}: {
  confidence: "high" | "medium" | "low";
}) {
  const colors = {
    high: "bg-success/20 text-success",
    medium: "bg-warning/20 text-warning",
    low: "bg-over/20 text-over",
  };
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        colors[confidence]
      )}
    >
      {confidence}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Barcode Scanner Tab
// ═══════════════════════════════════════════════════════════════════

function BarcodeScanner() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>("Dinner");
  const [servings, setServings] = useState(1);
  const utils = trpc.useUtils();

  // Custom food form state (for barcode not found)
  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customServingSize, setCustomServingSize] = useState("");
  const [customServingUnit, setCustomServingUnit] = useState("g");
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  const {
    data: foodItem,
    isLoading: foodLoading,
    error: foodError,
  } = trpc.food.getByBarcode.useQuery(
    { barcode: scannedBarcode! },
    { enabled: !!scannedBarcode }
  );

  const createFood = trpc.food.create.useMutation();

  const logEntry = trpc.meals.logEntry.useMutation({
    onSuccess: () => {
      toast.success("Added to your diary!");
      setDrawerOpen(false);
      setScannedBarcode(null);
      setServings(1);
      // Reset custom form
      setCustomName("");
      setCustomCalories("");
      setCustomProtein("");
      setCustomCarbs("");
      setCustomFat("");
      setCustomServingSize("");
      setCustomServingUnit("g");
      // Invalidate dashboard queries
      utils.daily.get.invalidate();
      utils.meals.getByDate.invalidate();
      utils.food.getRecent.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSaveCustomFood = async () => {
    if (!customName.trim() || !customCalories) return;
    setIsSavingCustom(true);

    try {
      const cal = Number(customCalories) || 0;
      const pro = Number(customProtein) || 0;
      const carb = Number(customCarbs) || 0;
      const fat = Number(customFat) || 0;

      // 1) Create the food item with barcode
      const food = await createFood.mutateAsync({
        name: customName.trim(),
        barcode: scannedBarcode ?? undefined,
        calories: cal,
        proteinG: pro,
        carbsG: carb,
        fatG: fat,
        servingSize: customServingSize || undefined,
        servingUnit: customServingUnit || undefined,
        source: "custom",
        isShared: true,
      });

      // 2) Log the entry
      await logEntry.mutateAsync({
        date: format(new Date(), "yyyy-MM-dd"),
        mealType,
        foodItemId: food.id,
        servings,
        calories: Math.round(cal * servings),
        proteinG: Math.round(pro * servings),
        carbsG: Math.round(carb * servings),
        fatG: Math.round(fat * servings),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save food",
      );
    } finally {
      setIsSavingCustom(false);
    }
  };

  const startScanner = useCallback(async () => {
    if (!scannerRef.current || html5QrRef.current) return;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("barcode-reader");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // On successful scan
          setScannedBarcode(decodedText);
          setDrawerOpen(true);
          // Stop scanning after a successful read
          scanner.stop().catch(() => {});
          html5QrRef.current = null;
          setScanning(false);
        },
        () => {
          // Scan failure (each frame without barcode) — ignore
        }
      );

      setScanning(true);
      setCameraError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not access camera";
      if (
        message.includes("NotAllowedError") ||
        message.includes("Permission")
      ) {
        setCameraError(
          "Camera access denied. Please allow camera permission in your browser settings."
        );
      } else {
        setCameraError(message);
      }
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      html5QrRef.current = null;
    }
    setScanning(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, []);

  const handleAddFood = () => {
    if (!foodItem) return;
    const cal = parseFloat(foodItem.calories ?? "0");
    const pro = parseFloat(foodItem.proteinG ?? "0");
    const carb = parseFloat(foodItem.carbsG ?? "0");
    const fat = parseFloat(foodItem.fatG ?? "0");
    const fiber = parseFloat(foodItem.fiberG ?? "0");

    logEntry.mutate({
      date: format(new Date(), "yyyy-MM-dd"),
      mealType,
      foodItemId: foodItem.id,
      servings,
      calories: Math.round(cal * servings),
      proteinG: Math.round(pro * servings),
      carbsG: Math.round(carb * servings),
      fatG: Math.round(fat * servings),
      fiberG: Math.round(fiber * servings),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Camera viewfinder area */}
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <div
          id="barcode-reader"
          ref={scannerRef}
          className="relative min-h-[300px] w-full"
        />

        {/* Scanning overlay */}
        {scanning && (
          <div className="pointer-events-none absolute inset-0">
            {/* Dark overlay with cutout effect */}
            <div className="absolute inset-0 bg-black/40" />
            {/* Scan line animation */}
            <div className="absolute left-[10%] right-[10%] top-[15%] bottom-[15%]">
              <div className="relative h-full w-full rounded-xl border-2 border-primary/60">
                <div className="scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              </div>
            </div>
            {/* Corner brackets */}
            <div className="absolute left-[10%] top-[15%] h-6 w-6 rounded-tl-lg border-t-2 border-l-2 border-primary" />
            <div className="absolute right-[10%] top-[15%] h-6 w-6 rounded-tr-lg border-t-2 border-r-2 border-primary" />
            <div className="absolute left-[10%] bottom-[15%] h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-primary" />
            <div className="absolute right-[10%] bottom-[15%] h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-primary" />
          </div>
        )}

        {/* Not scanning state */}
        {!scanning && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-1">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-tertiary"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            <p className="text-sm text-text-secondary">
              Point camera at a barcode
            </p>
          </div>
        )}

        {/* Camera error state */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-1 p-6 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-over"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-sm text-text-secondary">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Start / stop button */}
      <Button
        variant={scanning ? "destructive" : "default"}
        size="lg"
        className="w-full py-3"
        onClick={scanning ? stopScanner : startScanner}
      >
        {scanning ? "Stop Scanner" : "Start Scanner"}
      </Button>

      {/* Scanned barcode result drawer */}
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl bg-surface-1">
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-text-disabled/30" />
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <Drawer.Title className="text-lg font-semibold text-text-primary">
                {foodLoading
                  ? "Looking up barcode..."
                  : foodItem
                    ? foodItem.name
                    : "Not Found"}
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                Scanned barcode food details
              </Drawer.Description>

              {foodLoading && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm text-text-secondary">
                    Searching database...
                  </span>
                </div>
              )}

              {!foodLoading && foodItem && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex flex-col gap-4"
                >
                  {foodItem.brand && (
                    <p className="text-sm text-text-secondary">
                      {foodItem.brand}
                    </p>
                  )}

                  {/* Nutrition info */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col items-center rounded-xl bg-surface-2 py-3">
                      <span className="text-lg font-bold text-calories">
                        {Math.round(
                          parseFloat(foodItem.calories ?? "0") * servings
                        )}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Calories
                      </span>
                    </div>
                    <div className="flex flex-col items-center rounded-xl bg-surface-2 py-3">
                      <span className="text-lg font-bold text-protein">
                        {Math.round(
                          parseFloat(foodItem.proteinG ?? "0") * servings
                        )}
                        g
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Protein
                      </span>
                    </div>
                    <div className="flex flex-col items-center rounded-xl bg-surface-2 py-3">
                      <span className="text-lg font-bold text-carbs">
                        {Math.round(
                          parseFloat(foodItem.carbsG ?? "0") * servings
                        )}
                        g
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Carbs
                      </span>
                    </div>
                    <div className="flex flex-col items-center rounded-xl bg-surface-2 py-3">
                      <span className="text-lg font-bold text-fat">
                        {Math.round(
                          parseFloat(foodItem.fatG ?? "0") * servings
                        )}
                        g
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Fat
                      </span>
                    </div>
                  </div>

                  {/* Serving info */}
                  {(foodItem.servingSize || foodItem.servingUnit) && (
                    <p className="text-xs text-text-tertiary">
                      Serving: {foodItem.servingSize} {foodItem.servingUnit}
                    </p>
                  )}

                  {/* Portion stepper */}
                  <PortionStepper value={servings} onChange={setServings} />

                  {/* Meal type selector */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-text-secondary">
                      Add to meal
                    </span>
                    <MealTypeSelector value={mealType} onChange={setMealType} />
                  </div>

                  {/* Add button */}
                  <Button
                    className="mt-2 w-full py-3"
                    size="lg"
                    onClick={handleAddFood}
                    disabled={logEntry.isPending}
                  >
                    {logEntry.isPending ? "Adding..." : `Add to ${mealType}`}
                  </Button>
                </motion.div>
              )}

              {!foodLoading && !foodItem && !foodError && scannedBarcode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex flex-col gap-4"
                >
                  <p className="text-sm text-text-secondary">
                    Barcode <span className="font-mono text-text-tertiary">{scannedBarcode}</span>{" "}
                    was not found. Add it below:
                  </p>

                  {/* Name */}
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">Name</label>
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Chocolate Protein Bar"
                      className="h-10 bg-surface-2 border-none"
                    />
                  </div>

                  {/* Nutrition grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">Calories</label>
                      <Input
                        type="number"
                        value={customCalories}
                        onChange={(e) => setCustomCalories(e.target.value)}
                        placeholder="0"
                        className="h-10 bg-surface-2 border-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">Protein (g)</label>
                      <Input
                        type="number"
                        value={customProtein}
                        onChange={(e) => setCustomProtein(e.target.value)}
                        placeholder="0"
                        className="h-10 bg-surface-2 border-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">Carbs (g)</label>
                      <Input
                        type="number"
                        value={customCarbs}
                        onChange={(e) => setCustomCarbs(e.target.value)}
                        placeholder="0"
                        className="h-10 bg-surface-2 border-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">Fat (g)</label>
                      <Input
                        type="number"
                        value={customFat}
                        onChange={(e) => setCustomFat(e.target.value)}
                        placeholder="0"
                        className="h-10 bg-surface-2 border-none"
                      />
                    </div>
                  </div>

                  {/* Serving size row */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-text-secondary">Serving size</label>
                      <Input
                        value={customServingSize}
                        onChange={(e) => setCustomServingSize(e.target.value)}
                        placeholder="e.g. 40"
                        className="h-10 bg-surface-2 border-none"
                      />
                    </div>
                    <div className="w-24">
                      <label className="mb-1 block text-xs text-text-secondary">Unit</label>
                      <Input
                        value={customServingUnit}
                        onChange={(e) => setCustomServingUnit(e.target.value)}
                        placeholder="g"
                        className="h-10 bg-surface-2 border-none"
                      />
                    </div>
                  </div>

                  {/* Portion stepper */}
                  <PortionStepper value={servings} onChange={setServings} />

                  {/* Meal type selector */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-text-secondary">Add to meal</span>
                    <MealTypeSelector value={mealType} onChange={setMealType} />
                  </div>

                  {/* Save & Add button */}
                  <Button
                    className="mt-2 w-full py-3"
                    size="lg"
                    onClick={handleSaveCustomFood}
                    disabled={isSavingCustom || !customName.trim() || !customCalories}
                  >
                    {isSavingCustom ? "Saving..." : "Save & Add"}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDrawerOpen(false);
                      setScannedBarcode(null);
                      startScanner();
                    }}
                  >
                    Scan Again
                  </Button>
                </motion.div>
              )}

              {foodError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4"
                >
                  <p className="text-sm text-over">{foodError.message}</p>
                  <Button
                    variant="ghost"
                    className="mt-3"
                    onClick={() => {
                      setDrawerOpen(false);
                      setScannedBarcode(null);
                      startScanner();
                    }}
                  >
                    Try Again
                  </Button>
                </motion.div>
              )}
            </div>
            <div className="pb-safe" />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AI Photo Analysis Tab
// ═══════════════════════════════════════════════════════════════════

function AIPhotoAnalysis() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [results, setResults] = useState<{
    items: AnalyzedItem[];
    totalCalories: number;
    notes?: string;
    questions?: string[];
  } | null>(null);
  const [mealType, setMealType] = useState<MealType>("Dinner");
  const [addingItems, setAddingItems] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = trpc.user.getProfile.useQuery();
  const utils = trpc.useUtils();

  const analyzePhoto = trpc.ai.analyzePhoto.useMutation({
    onSuccess: (data) => {
      setResults(data);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const createFood = trpc.food.create.useMutation({
    onSuccess: () => {
      utils.food.getFavorites.invalidate();
    },
  });
  const logEntry = trpc.meals.logEntry.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate();
      utils.meals.getByDate.invalidate();
      utils.food.getRecent.invalidate();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);

    // Clear previous results
    setResults(null);
  };

  const handleAnalyze = () => {
    if (!imageBase64) return;
    analyzePhoto.mutate({
      imageBase64,
      description: description || undefined,
    });
  };

  const handleAddAllItems = async () => {
    if (!results?.items.length) return;
    setAddingItems(true);

    const today = format(new Date(), "yyyy-MM-dd");

    try {
      for (const item of results.items) {
        // Create the food item first
        const food = await createFood.mutateAsync({
          name: item.name,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          servingSize: item.estimatedWeightG
            ? `${item.estimatedWeightG}`
            : undefined,
          servingUnit: item.estimatedWeightG ? "g" : undefined,
          source: "ai_photo",
        });

        // Log the entry
        await logEntry.mutateAsync({
          date: today,
          mealType,
          foodItemId: food.id,
          servings: 1,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        });
      }

      toast.success(
        `Added ${results.items.length} item${results.items.length > 1 ? "s" : ""} to ${mealType}!`
      );
      // Reset state
      setResults(null);
      setImageBase64(null);
      setImagePreview(null);
      setDescription("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add items."
      );
    } finally {
      setAddingItems(false);
    }
  };

  const handleAddSingleItem = async (item: AnalyzedItem) => {
    const today = format(new Date(), "yyyy-MM-dd");

    try {
      const food = await createFood.mutateAsync({
        name: item.name,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        servingSize: item.estimatedWeightG
          ? `${item.estimatedWeightG}`
          : undefined,
        servingUnit: item.estimatedWeightG ? "g" : undefined,
        source: "ai_photo",
      });

      await logEntry.mutateAsync({
        date: today,
        mealType,
        foodItemId: food.id,
        servings: 1,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
      });

      toast.success(`Added ${item.name}!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add item."
      );
    }
  };

  const handleQuestionTap = (question: string) => {
    setDescription(question);
  };

  const hasApiKey = !!profile?.encryptedApiKey;

  if (!hasApiKey && profile !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-text-tertiary"
        >
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
        <div>
          <p className="text-sm font-medium text-text-primary">
            AI Key Required
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Go to Profile &rarr; AI Settings to add your API key.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Photo capture / preview */}
      {!imagePreview ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-text-disabled/30 bg-surface-1 transition-colors hover:bg-surface-2"
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-text-tertiary"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <p className="text-sm text-text-secondary">
            Tap to take a photo of your meal
          </p>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Food photo"
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: "300px" }}
          />
          <button
            onClick={() => {
              setImagePreview(null);
              setImageBase64(null);
              setResults(null);
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Description input */}
      {imageBase64 && !results && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3"
        >
          <Input
            placeholder="What are you eating? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-10"
          />
          <Button
            size="lg"
            className="w-full py-3"
            onClick={handleAnalyze}
            disabled={analyzePhoto.isPending}
          >
            {analyzePhoto.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Analyzing...
              </span>
            ) : (
              "Analyze Photo"
            )}
          </Button>
        </motion.div>
      )}

      {/* Analysis results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-4"
          >
            {/* Total calories summary */}
            <div className="flex items-center justify-between rounded-xl bg-surface-1 p-4">
              <span className="text-sm font-medium text-text-secondary">
                Total Estimated Calories
              </span>
              <span className="text-2xl font-bold text-calories">
                {results.totalCalories}
              </span>
            </div>

            {/* Items list */}
            <div className="flex flex-col gap-2">
              {results.items.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col gap-2 rounded-xl bg-surface-1 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {item.name}
                        </span>
                        <ConfidenceBadge confidence={item.confidence} />
                      </div>
                      {item.estimatedWeightG > 0 && (
                        <span className="text-xs text-text-tertiary">
                          ~{item.estimatedWeightG}g
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-calories">
                      {item.calories} cal
                    </span>
                  </div>

                  {/* Macros row */}
                  <div className="flex gap-3 text-xs">
                    <span className="text-protein">
                      P: {item.proteinG}g
                    </span>
                    <span className="text-carbs">
                      C: {item.carbsG}g
                    </span>
                    <span className="text-fat">
                      F: {item.fatG}g
                    </span>
                  </div>

                  {/* Add individual item */}
                  <button
                    onClick={() => handleAddSingleItem(item)}
                    className="mt-1 self-end text-xs font-medium text-primary hover:text-primary/80"
                  >
                    + Add this item
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Notes */}
            {results.notes && (
              <p className="text-xs text-text-tertiary italic">
                {results.notes}
              </p>
            )}

            {/* Follow-up questions */}
            {results.questions && results.questions.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  AI has questions
                </span>
                <div className="flex flex-wrap gap-2">
                  {results.questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuestionTap(q)}
                      className="rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Meal type + Add all button */}
            <div className="flex flex-col gap-3 rounded-xl bg-surface-1 p-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">
                  Add to meal
                </span>
                <MealTypeSelector value={mealType} onChange={setMealType} />
              </div>

              <Button
                size="lg"
                className="w-full py-3"
                onClick={handleAddAllItems}
                disabled={addingItems}
              >
                {addingItems ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Adding...
                  </span>
                ) : (
                  `Add All to ${mealType}`
                )}
              </Button>
            </div>

            {/* Re-analyze button */}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setResults(null);
                fileInputRef.current?.click();
              }}
            >
              Take Another Photo
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Camera Page
// ═══════════════════════════════════════════════════════════════════

export default function CameraPage() {
  const [activeTab, setActiveTab] = useState<"barcode" | "photo">("barcode");

  return (
    <div className="flex flex-1 flex-col gap-5 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          Camera
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Scan a barcode or snap a photo for AI analysis.
        </p>
      </div>

      {/* Tab selector */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "barcode" ? (
          <motion.div
            key="barcode"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <BarcodeScanner />
          </motion.div>
        ) : (
          <motion.div
            key="photo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <AIPhotoAnalysis />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
