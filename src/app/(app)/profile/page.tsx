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

  // ─── Meal types state ───────────────────────────────────────────
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [newMealType, setNewMealType] = useState("");

  // ─── AI settings state ──────────────────────────────────────────
  const [aiProvider, setAiProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);

  // ─── Units state ────────────────────────────────────────────────
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");

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

  const handleAddMealType = () => {
    const trimmed = newMealType.trim();
    if (!trimmed || mealTypes.includes(trimmed)) return;
    const updated = [...mealTypes, trimmed];
    setMealTypes(updated);
    setNewMealType("");
    updateProfile.mutate(
      { mealTypes: updated },
      {
        onSuccess: () => toast.success("Meal type added"),
        onError: () => toast.error("Failed to update meal types"),
      },
    );
  };

  const handleRemoveMealType = (type: string) => {
    const updated = mealTypes.filter((t) => t !== type);
    setMealTypes(updated);
    updateProfile.mutate(
      { mealTypes: updated },
      {
        onSuccess: () => toast.success("Meal type removed"),
        onError: () => toast.error("Failed to update meal types"),
      },
    );
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
      <SectionCard icon={<Target size={16} />} title="Daily Targets">
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

      {/* ─── Meal Types Section ──────────────────────────────────── */}
      <SectionCard icon={<Utensils size={16} />} title="Meal Types">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {mealTypes.map((type) => (
              <motion.span
                key={type}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-text-primary"
              >
                {type}
                <button
                  onClick={() => handleRemoveMealType(type)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
                >
                  <X size={12} />
                </button>
              </motion.span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newMealType}
              onChange={(e) => setNewMealType(e.target.value)}
              placeholder="New meal type"
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
