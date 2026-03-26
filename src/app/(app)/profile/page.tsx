"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  User,
  Target,
  Utensils,
  Sparkles,
  Settings,
  LogOut,
  Eye,
  EyeOff,
  X,
  Plus,
  Save,
  ChevronDown,
  Dumbbell,
  Bell,
  Clock,
  GripVertical,
  Pencil,
  Check,
} from "lucide-react";

// ─── Skeleton loader ──────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className ?? ""}`}
    />
  );
}

// ─── Section card wrapper ─────────────────────────────────────────
function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-surface-1 p-5"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

// ─── AI Provider options ──────────────────────────────────────────
const AI_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
];

// ─── Day-of-week options ─────────────────────────────────────────
const DAY_LABELS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// ─── Meal reminder type ──────────────────────────────────────────
interface MealReminder {
  mealType: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

export default function ProfilePage() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.getProfile.invalidate();
    },
  });

  // ─── Profile state ──────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");

  // ─── Targets state ──────────────────────────────────────────────
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(150);
  const [carbsTarget, setCarbsTarget] = useState(200);
  const [fatTarget, setFatTarget] = useState(65);
  const [fiberTarget, setFiberTarget] = useState(25);

  // ─── Training day state ─────────────────────────────────────────
  const [trainingEnabled, setTrainingEnabled] = useState(false);
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 3, 5]);
  const [trainingCalories, setTrainingCalories] = useState(2500);
  const [trainingProtein, setTrainingProtein] = useState(180);
  const [trainingCarbs, setTrainingCarbs] = useState(280);
  const [trainingFat, setTrainingFat] = useState(70);

  // ─── Meal types state ───────────────────────────────────────────
  const [mealTypes, setMealTypes] = useState<string[]>(["Breakfast", "Lunch", "Dinner", "Snack"]);
  const [newMealType, setNewMealType] = useState("");

  // ─── AI settings state ──────────────────────────────────────────
  const [aiProvider, setAiProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);

  // ─── Units state ────────────────────────────────────────────────
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");

  // ─── Meal reminders state ───────────────────────────────────────
  const [reminders, setReminders] = useState<MealReminder[]>([]);

  // ─── Sync from server ───────────────────────────────────────────
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setCalorieTarget(profile.dailyCalorieTarget ?? 2000);
      setProteinTarget(profile.proteinTargetG ?? 150);
      setCarbsTarget(profile.carbsTargetG ?? 200);
      setFatTarget(profile.fatTargetG ?? 65);
      setFiberTarget(profile.fiberTargetG ?? 25);
      setMealTypes(profile.mealTypes ?? ["Breakfast", "Lunch", "Dinner", "Snack"]);
      setAiProvider(profile.aiProvider ?? "openai");
      setUnits((profile.units as "imperial" | "metric") ?? "imperial");
    }
  }, [profile]);

  // ─── Load training day settings from localStorage ───────────────
  useEffect(() => {
    try {
      const enabled = localStorage.getItem("training_day_enabled") === "true";
      setTrainingEnabled(enabled);

      const days = localStorage.getItem("training_days");
      if (days) setTrainingDays(JSON.parse(days));

      const targets = localStorage.getItem("training_targets");
      if (targets) {
        const t = JSON.parse(targets);
        setTrainingCalories(t.calories ?? 2500);
        setTrainingProtein(t.protein ?? 180);
        setTrainingCarbs(t.carbs ?? 280);
        setTrainingFat(t.fat ?? 70);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // ─── Load meal reminders from localStorage ──────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("meal_reminders");
      if (raw) {
        setReminders(JSON.parse(raw));
      } else {
        // Initialize defaults
        const defaults: MealReminder[] = [
          { mealType: "Breakfast", hour: 8, minute: 0, enabled: false },
          { mealType: "Lunch", hour: 12, minute: 0, enabled: false },
          { mealType: "Dinner", hour: 18, minute: 0, enabled: false },
          { mealType: "Snack", hour: 15, minute: 0, enabled: false },
        ];
        setReminders(defaults);
      }
    } catch {
      // Ignore
    }
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────
  const handleSaveTargets = () => {
    updateProfile.mutate(
      {
        displayName: displayName || undefined,
        dailyCalorieTarget: calorieTarget,
        proteinTargetG: proteinTarget,
        carbsTargetG: carbsTarget,
        fatTargetG: fatTarget,
        fiberTargetG: fiberTarget,
      },
      {
        onSuccess: () => toast.success("Targets saved"),
        onError: () => toast.error("Failed to save targets"),
      },
    );
  };

  const handleSaveTrainingTargets = () => {
    localStorage.setItem("training_day_enabled", trainingEnabled.toString());
    localStorage.setItem("training_days", JSON.stringify(trainingDays));
    localStorage.setItem(
      "training_targets",
      JSON.stringify({
        calories: trainingCalories,
        protein: trainingProtein,
        carbs: trainingCarbs,
        fat: trainingFat,
      }),
    );
    toast.success("Training day settings saved");
  };

  const toggleTrainingDay = (day: number) => {
    setTrainingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  const [editingMealName, setEditingMealName] = useState("");
  const [draggedMealIndex, setDraggedMealIndex] = useState<number | null>(null);
  const [dragOverMealIndex, setDragOverMealIndex] = useState<number | null>(null);

  const saveMealTypes = (updated: string[]) => {
    setMealTypes(updated);
    updateProfile.mutate(
      { mealTypes: updated },
      {
        onSuccess: () => toast.success("Meal types updated"),
        onError: () => toast.error("Failed to update meal types"),
      },
    );
  };

  const handleAddMealType = () => {
    const trimmed = newMealType.trim();
    if (!trimmed || mealTypes.includes(trimmed)) return;
    saveMealTypes([...mealTypes, trimmed]);
    setNewMealType("");
  };

  const handleRemoveMealType = (type: string) => {
    saveMealTypes(mealTypes.filter((t) => t !== type));
  };

  const handleRenameMealType = (index: number) => {
    const trimmed = editingMealName.trim();
    if (!trimmed || (trimmed !== mealTypes[index] && mealTypes.includes(trimmed))) {
      setEditingMealIndex(null);
      return;
    }
    const updated = [...mealTypes];
    updated[index] = trimmed;
    saveMealTypes(updated);
    setEditingMealIndex(null);
  };

  const handleMealDragStart = (index: number) => {
    setDraggedMealIndex(index);
  };

  const handleMealDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedMealIndex === null || draggedMealIndex === index) return;
    setDragOverMealIndex(index);
  };

  const handleMealDrop = (index: number) => {
    if (draggedMealIndex === null || draggedMealIndex === index) {
      setDraggedMealIndex(null);
      setDragOverMealIndex(null);
      return;
    }
    const updated = [...mealTypes];
    const [moved] = updated.splice(draggedMealIndex, 1);
    updated.splice(index, 0, moved);
    saveMealTypes(updated);
    setDraggedMealIndex(null);
    setDragOverMealIndex(null);
  };

  const handleMealDragEnd = () => {
    setDraggedMealIndex(null);
    setDragOverMealIndex(null);
  };

  const handleSaveApiKey = () => {
    updateProfile.mutate(
      {
        aiProvider,
        encryptedApiKey: apiKey || undefined,
      },
      {
        onSuccess: () => {
          toast.success("AI settings saved");
          setApiKey("");
        },
        onError: () => toast.error("Failed to save AI settings"),
      },
    );
  };

  const handleToggleUnits = (value: "imperial" | "metric") => {
    setUnits(value);
    updateProfile.mutate(
      { units: value },
      {
        onSuccess: () => toast.success(`Units set to ${value}`),
        onError: () => toast.error("Failed to update units"),
      },
    );
  };

  const handleUpdateReminder = (index: number, updates: Partial<MealReminder>) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], ...updates };
    setReminders(updated);
    localStorage.setItem("meal_reminders", JSON.stringify(updated));
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-6 pb-4">
        <div className="mb-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-1.5 h-4 w-48" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-6 pb-4">
      {/* Page header */}
      <div className="mb-2">
        <h1 className="text-2xl font-light tracking-tight text-text-primary">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Manage your account and preferences.
        </p>
      </div>

      {/* ─── Profile Section ─────────────────────────────────────── */}
      <SectionCard icon={<User size={16} />} title="Profile">
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="displayName" className="mb-1.5 text-xs text-text-secondary">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-10 bg-surface-2 border-none"
              onBlur={() => {
                if (displayName !== (profile?.displayName ?? "")) {
                  updateProfile.mutate(
                    { displayName },
                    { onSuccess: () => toast.success("Name updated") },
                  );
                }
              }}
            />
          </div>
          <Button
            variant="destructive"
            size="lg"
            onClick={handleSignOut}
            className="mt-1 w-full"
          >
            <LogOut size={14} />
            Sign Out
          </Button>
        </div>
      </SectionCard>

      {/* ─── Daily Targets Section ───────────────────────────────── */}
      <SectionCard icon={<Target size={16} />} title="Daily Targets (Rest Day)">
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="calorieTarget" className="mb-1.5 text-xs text-text-secondary">
              Calories
            </Label>
            <Input
              id="calorieTarget"
              type="number"
              value={calorieTarget}
              onChange={(e) => setCalorieTarget(Number(e.target.value))}
              className="h-10 bg-surface-2 border-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="proteinTarget" className="mb-1.5 text-xs text-text-secondary">
                Protein (g)
              </Label>
              <Input
                id="proteinTarget"
                type="number"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(Number(e.target.value))}
                className="h-10 bg-surface-2 border-none"
              />
            </div>
            <div>
              <Label htmlFor="carbsTarget" className="mb-1.5 text-xs text-text-secondary">
                Carbs (g)
              </Label>
              <Input
                id="carbsTarget"
                type="number"
                value={carbsTarget}
                onChange={(e) => setCarbsTarget(Number(e.target.value))}
                className="h-10 bg-surface-2 border-none"
              />
            </div>
            <div>
              <Label htmlFor="fatTarget" className="mb-1.5 text-xs text-text-secondary">
                Fat (g)
              </Label>
              <Input
                id="fatTarget"
                type="number"
                value={fatTarget}
                onChange={(e) => setFatTarget(Number(e.target.value))}
                className="h-10 bg-surface-2 border-none"
              />
            </div>
            <div>
              <Label htmlFor="fiberTarget" className="mb-1.5 text-xs text-text-secondary">
                Fiber (g)
              </Label>
              <Input
                id="fiberTarget"
                type="number"
                value={fiberTarget}
                onChange={(e) => setFiberTarget(Number(e.target.value))}
                className="h-10 bg-surface-2 border-none"
              />
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleSaveTargets}
            disabled={updateProfile.isPending}
            className="mt-1 w-full"
          >
            <Save size={14} />
            {updateProfile.isPending ? "Saving..." : "Save Targets"}
          </Button>
        </div>
      </SectionCard>

      {/* ─── Training Day Section ──────────────────────────────────── */}
      <SectionCard icon={<Dumbbell size={16} />} title="Training Day Targets">
        <div className="flex flex-col gap-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-primary">
              Different targets on training days?
            </span>
            <button
              onClick={() => setTrainingEnabled(!trainingEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                trainingEnabled ? "bg-primary" : "bg-surface-3"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  trainingEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {trainingEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-3 overflow-hidden"
            >
              {/* Training days picker */}
              <div>
                <Label className="mb-2 block text-xs text-text-secondary">
                  Training Days
                </Label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => toggleTrainingDay(d.value)}
                      className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                        trainingDays.includes(d.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Training day targets */}
              <div>
                <Label className="mb-1.5 text-xs text-text-secondary">
                  Training Day Calories
                </Label>
                <Input
                  type="number"
                  value={trainingCalories}
                  onChange={(e) => setTrainingCalories(Number(e.target.value))}
                  className="h-10 bg-surface-2 border-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Protein (g)
                  </Label>
                  <Input
                    type="number"
                    value={trainingProtein}
                    onChange={(e) => setTrainingProtein(Number(e.target.value))}
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Carbs (g)
                  </Label>
                  <Input
                    type="number"
                    value={trainingCarbs}
                    onChange={(e) => setTrainingCarbs(Number(e.target.value))}
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-text-secondary">
                    Fat (g)
                  </Label>
                  <Input
                    type="number"
                    value={trainingFat}
                    onChange={(e) => setTrainingFat(Number(e.target.value))}
                    className="h-10 bg-surface-2 border-none"
                  />
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleSaveTrainingTargets}
                className="mt-1 w-full"
              >
                <Save size={14} />
                Save Training Settings
              </Button>
            </motion.div>
          )}

          {!trainingEnabled && (
            <p className="text-xs text-text-disabled">
              Enable to set higher targets on training days.
            </p>
          )}
        </div>
      </SectionCard>

      {/* ─── Meal Reminders Section ────────────────────────────────── */}
      <SectionCard icon={<Bell size={16} />} title="Meal Reminders">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-tertiary">
            Get a reminder when it is time to log each meal. Times are in 24h format.
          </p>
          {reminders.map((r, i) => (
            <div
              key={r.mealType}
              className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
            >
              <button
                onClick={() => handleUpdateReminder(i, { enabled: !r.enabled })}
                className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                  r.enabled ? "bg-primary" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    r.enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="flex-1 text-sm text-text-primary">{r.mealType}</span>
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-text-tertiary" />
                <input
                  type="time"
                  value={`${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    handleUpdateReminder(i, { hour: h, minute: m });
                  }}
                  className="bg-transparent text-sm text-text-primary outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ─── Meal Types Section ──────────────────────────────────── */}
      <SectionCard icon={<Utensils size={16} />} title="Meal Types">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-tertiary">
            Drag to reorder. Tap the pencil to rename. This controls the meals shown on your tracking page.
          </p>

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          )}

          {/* Draggable meal type list */}
          <div className="flex flex-col gap-1.5">
            {mealTypes.map((type, index) => (
              <motion.div
                key={`${type}-${index}`}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{
                  opacity: draggedMealIndex !== null && draggedMealIndex === index ? 0.5 : 1,
                  x: 0,
                  scale: dragOverMealIndex === index ? 1.02 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                draggable
                onDragStart={() => handleMealDragStart(index)}
                onDragOver={(e) => handleMealDragOver(e as unknown as React.DragEvent, index)}
                onDrop={() => handleMealDrop(index)}
                onDragEnd={handleMealDragEnd}
                className={`flex items-center gap-2 rounded-xl px-2 py-2.5 transition-colors ${
                  dragOverMealIndex === index
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-surface-2 border border-transparent"
                }`}
              >
                {/* Drag handle */}
                <div className="cursor-grab touch-none text-text-disabled active:cursor-grabbing">
                  <GripVertical size={16} />
                </div>

                {/* Name (view or edit mode) */}
                {editingMealIndex === index ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <Input
                      value={editingMealName}
                      onChange={(e) => setEditingMealName(e.target.value)}
                      className="h-8 flex-1 bg-surface-3 border-none text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameMealType(index);
                        if (e.key === "Escape") setEditingMealIndex(null);
                      }}
                    />
                    <button
                      onClick={() => handleRenameMealType(index)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-success transition-colors hover:bg-success/10"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">
                      {type}
                    </span>

                    {/* Edit button */}
                    <button
                      onClick={() => {
                        setEditingMealIndex(index);
                        setEditingMealName(type);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
                    >
                      <Pencil size={13} />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleRemoveMealType(type)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </motion.div>
            ))}
          </div>

          {/* Add new meal type */}
          <div className="flex gap-2">
            <Input
              value={newMealType}
              onChange={(e) => setNewMealType(e.target.value)}
              placeholder="Add a meal type..."
              className="h-10 flex-1 bg-surface-2 border-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddMealType();
              }}
            />
            <Button
              size="lg"
              variant="secondary"
              onClick={handleAddMealType}
              disabled={!newMealType.trim()}
            >
              <Plus size={14} />
              Add
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ─── AI Settings Section ─────────────────────────────────── */}
      <SectionCard icon={<Sparkles size={16} />} title="AI Settings">
        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1.5 text-xs text-text-secondary">Provider</Label>
            <div className="relative">
              <button
                onClick={() => setProviderOpen(!providerOpen)}
                className="flex h-10 w-full items-center justify-between rounded-lg bg-surface-2 px-3 text-sm text-text-primary"
              >
                <span>
                  {AI_PROVIDERS.find((p) => p.value === aiProvider)?.label ??
                    "Select provider"}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-text-tertiary transition-transform ${providerOpen ? "rotate-180" : ""}`}
                />
              </button>
              {providerOpen && (
                <div
                  className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-surface-1 shadow-lg"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setAiProvider(p.value);
                        setProviderOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2 ${
                        aiProvider === p.value
                          ? "text-primary"
                          : "text-text-primary"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="apiKey" className="mb-1.5 text-xs text-text-secondary">
              API Key
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  profile?.encryptedApiKey ? "Key saved (enter new to replace)" : "Enter API key"
                }
                className="h-10 bg-surface-2 border-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-primary"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">
            Your key is encrypted and only used for AI features.
          </p>
          <Button
            size="lg"
            onClick={handleSaveApiKey}
            disabled={updateProfile.isPending}
            className="w-full"
          >
            <Save size={14} />
            Save Key
          </Button>
        </div>
      </SectionCard>

      {/* ─── App Settings Section ────────────────────────────────── */}
      <SectionCard icon={<Settings size={16} />} title="App Settings">
        <div>
          <Label className="mb-2 text-xs text-text-secondary">Units</Label>
          <div className="flex rounded-lg bg-surface-2 p-1">
            {(["imperial", "metric"] as const).map((value) => (
              <button
                key={value}
                onClick={() => handleToggleUnits(value)}
                className={`relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  units === value
                    ? "bg-primary text-primary-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
