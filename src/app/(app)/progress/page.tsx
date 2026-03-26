"use client";

import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Drawer } from "vaul";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Scale,
  Flame,
  TrendingUp,
  Target,
  Plus,
  Loader2,
  Activity,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatShortDay(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getDateString(daysAgo: number) {
  return format(subDays(new Date(), daysAgo), "yyyy-MM-dd");
}

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

// 7-day EWMA
function computeEWMA(
  weights: { date: string; weight: number }[],
  alpha = 0.3,
): { date: string; weight: number; trend: number }[] {
  if (weights.length === 0) return [];
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  let trend = sorted[0].weight;
  return sorted.map((w) => {
    trend = alpha * w.weight + (1 - alpha) * trend;
    return { date: w.date, weight: w.weight, trend: Math.round(trend * 10) / 10 };
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className ?? ""}`}
    />
  );
}

// ─── Section card ─────────────────────────────────────────────────
function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-surface-1 p-5"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
            {icon}
          </div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: "#1C1C22",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <p className="text-xs text-text-tertiary">{label}</p>
      {payload.map((p, i) => (
        <p
          key={i}
          className="text-sm font-medium"
          style={{ color: p.color }}
        >
          {Math.round(p.value * 10) / 10}
          {suffix ?? ""}
        </p>
      ))}
    </div>
  );
}

// ─── Log Weight Drawer ────────────────────────────────────────────
function LogWeightDrawer({
  open,
  onOpenChange,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: "imperial" | "metric";
}) {
  const utils = trpc.useUtils();
  const logWeight = trpc.daily.logWeight.useMutation({
    onSuccess: () => {
      utils.daily.getRange.invalidate();
      toast.success("Weight logged");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to log weight"),
  });

  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayString());

  const handleSubmit = () => {
    const val = Number(weight);
    if (!val || val <= 0) return;
    // Convert lbs to kg if imperial
    const weightKg = units === "imperial" ? val * 0.453592 : val;
    logWeight.mutate({ date, weightKg });
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg flex-col rounded-t-2xl bg-surface-1 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-surface-3" />
          <div className="px-5 pb-8 pt-4">
            <Drawer.Title className="mb-4 text-lg font-semibold text-text-primary">
              Log Weight
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Enter your weight for the selected date
            </Drawer.Description>
            <div className="flex flex-col gap-3">
              <div>
                <Label className="mb-1.5 text-xs text-text-secondary">
                  Weight ({units === "imperial" ? "lbs" : "kg"})
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={units === "imperial" ? "e.g. 180" : "e.g. 82"}
                  className="h-12 bg-surface-2 border-none text-lg"
                  autoFocus
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-text-secondary">
                  Date
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 bg-surface-2 border-none"
                />
              </div>
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={!weight || logWeight.isPending}
                className="mt-2 w-full"
              >
                {logWeight.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Scale size={14} />
                )}
                {logWeight.isPending ? "Saving..." : "Log Weight"}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ─── Macro progress bar ───────────────────────────────────────────
function MacroProgress({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-primary">{label}</span>
        <span
          className="text-sm font-medium"
          style={{ color, fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(current)}g / {target}g
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ProgressPage() {
  const [weightDrawerOpen, setWeightDrawerOpen] = useState(false);

  // Get user profile for units + targets
  const { data: profile } = trpc.user.getProfile.useQuery();
  const units = (profile?.units as "imperial" | "metric") ?? "imperial";

  // 30-day range for weight chart
  const thirtyDaysAgo = getDateString(30);
  const today = todayString();

  const { data: rangeData, isLoading } = trpc.daily.getRange.useQuery({
    startDate: thirtyDaysAgo,
    endDate: today,
  });

  // ─── Weight data ──────────────────────────────────────────────
  const weightData = useMemo(() => {
    if (!rangeData) return [];
    const raw = rangeData.days
      .filter((d) => d.weightKg !== null)
      .map((d) => ({
        date: d.date,
        weight:
          units === "imperial"
            ? Math.round(d.weightKg! * 2.20462 * 10) / 10
            : d.weightKg!,
      }));
    return computeEWMA(raw);
  }, [rangeData, units]);

  const currentTrend =
    weightData.length > 0 ? weightData[weightData.length - 1].trend : null;

  // ─── Weekly calorie data (last 7 days) ────────────────────────
  const weeklyData = useMemo(() => {
    if (!rangeData) return [];
    const days = rangeData.days;
    const last7 = days.slice(-7);
    const target = rangeData.targets.calories;
    return last7.map((d) => {
      const ratio = target > 0 ? d.calories / target : 0;
      let fill = "var(--success)";
      if (ratio > 1.05) fill = "var(--over)";
      else if (ratio > 0.9) fill = "var(--warning)";
      return {
        date: d.date,
        label: formatShortDay(d.date),
        calories: Math.round(d.calories),
        fill,
      };
    });
  }, [rangeData]);

  // ─── Weekly macro averages ────────────────────────────────────
  const macroAverages = useMemo(() => {
    if (!rangeData) return { protein: 0, carbs: 0, fat: 0 };
    const last7 = rangeData.days.slice(-7);
    const daysWithData = last7.filter((d) => d.entryCount > 0);
    const count = daysWithData.length || 1;
    return {
      protein:
        daysWithData.reduce((sum, d) => sum + d.proteinG, 0) / count,
      carbs:
        daysWithData.reduce((sum, d) => sum + d.carbsG, 0) / count,
      fat: daysWithData.reduce((sum, d) => sum + d.fatG, 0) / count,
    };
  }, [rangeData]);

  // ─── Streak calculation ───────────────────────────────────────
  const streak = useMemo(() => {
    if (!rangeData) return 0;
    const days = [...rangeData.days].reverse();
    let count = 0;
    for (const d of days) {
      if (d.entryCount > 0) count++;
      else break;
    }
    return count;
  }, [rangeData]);

  const calorieTarget = rangeData?.targets.calories ?? 2000;

  // ─── Adaptive TDEE calculation ─────────────────────────────────
  const tdeeEstimate = useMemo(() => {
    if (!rangeData || weightData.length < 4) return null;

    // Need at least 2 weeks of calorie data + 2 weight points
    const daysWithCalories = rangeData.days.filter((d) => d.calories > 0);
    if (daysWithCalories.length < 14) return null;

    // Average daily calories over the period
    const avgCalories =
      daysWithCalories.reduce((sum, d) => sum + d.calories, 0) /
      daysWithCalories.length;

    // Weight trend: use first and last trend values to get weekly change
    const firstWeight = weightData[0];
    const lastWeight = weightData[weightData.length - 1];
    const daysBetween =
      (new Date(lastWeight.date).getTime() - new Date(firstWeight.date).getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysBetween < 14) return null;

    const weeksBetween = daysBetween / 7;
    // Weight change per week (in lbs if imperial, kg if metric)
    const weightChangePerWeek =
      (lastWeight.trend - firstWeight.trend) / weeksBetween;

    // Convert to kg for calorie calculation if needed
    const changeKgPerWeek =
      units === "imperial"
        ? weightChangePerWeek * 0.453592
        : weightChangePerWeek;

    // 1 kg of body weight ~ 7700 kcal
    const tdee = Math.round(avgCalories - (changeKgPerWeek * 7700) / 7);

    return {
      tdee,
      weeksOfData: Math.round(weeksBetween),
      avgCalories: Math.round(avgCalories),
      weightChangePerWeek: Math.round(weightChangePerWeek * 10) / 10,
    };
  }, [rangeData, weightData, units]);

  // ─── Weight chart data for recharts ───────────────────────────
  const weightChartData = useMemo(() => {
    if (!rangeData || weightData.length === 0) return [];
    // Fill 30 days with null for gaps
    return rangeData.days.map((d) => {
      const match = weightData.find((w) => w.date === d.date);
      return {
        date: formatDate(d.date),
        rawDate: d.date,
        weight: match?.weight ?? null,
        trend: match?.trend ?? null,
      };
    });
  }, [rangeData, weightData]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-6 pb-4">
        <div className="mb-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-1.5 h-4 w-48" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-52 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-6 pb-4">
      {/* Page header */}
      <div className="mb-2">
        <h1 className="text-2xl font-light tracking-tight text-text-primary">
          Progress
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Track your trends and achievements.
        </p>
      </div>

      {/* ─── Weight Section ──────────────────────────────────────── */}
      <SectionCard
        icon={<Scale size={16} />}
        title="Weight"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setWeightDrawerOpen(true)}
          >
            <Plus size={12} />
            Log
          </Button>
        }
      >
        {/* Trend weight display */}
        {currentTrend !== null ? (
          <div className="mb-4 flex items-baseline gap-2">
            <span
              className="text-4xl font-extralight text-text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {currentTrend}
            </span>
            <span className="text-sm text-text-tertiary">
              {units === "imperial" ? "lbs" : "kg"} trend
            </span>
          </div>
        ) : (
          <p className="mb-4 text-sm text-text-tertiary">
            No weight data yet. Log your first weight!
          </p>
        )}

        {/* Weight chart */}
        {weightChartData.some((d) => d.weight !== null) && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={weightChartData}
                margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#A1A1AA" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#A1A1AA" }}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 2", "dataMax + 2"]}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as unknown as Array<{ value: number; name: string; color: string }>}
                      label={label as string}
                      suffix={units === "imperial" ? " lbs" : " kg"}
                    />
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="rgba(161,161,170,0.4)"
                  strokeWidth={1}
                  dot={{ r: 3, fill: "#A1A1AA", strokeWidth: 0 }}
                  connectNulls
                  name="Raw"
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  name="Trend"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* ─── Calorie Section ─────────────────────────────────────── */}
      <SectionCard icon={<TrendingUp size={16} />} title="Weekly Calories">
        {weeklyData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#A1A1AA" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#A1A1AA" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload as unknown as Array<{ value: number; name: string; color: string }>}
                      label={label as string}
                      suffix=" cal"
                    />
                  )}
                />
                <ReferenceLine
                  y={calorieTarget}
                  stroke="rgba(255,255,255,0.2)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Target: ${calorieTarget}`,
                    position: "insideTopRight",
                    style: { fontSize: 10, fill: "#71717A" },
                  }}
                />
                <Bar
                  dataKey="calories"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  name="Calories"
                >
                  {weeklyData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            No calorie data for this week yet.
          </p>
        )}
      </SectionCard>

      {/* ─── Macro Section ───────────────────────────────────────── */}
      <SectionCard icon={<Target size={16} />} title="Weekly Macro Averages">
        <div className="flex flex-col gap-4">
          <MacroProgress
            label="Protein"
            current={macroAverages.protein}
            target={rangeData?.targets.proteinG ?? 150}
            color="var(--protein)"
          />
          <MacroProgress
            label="Carbs"
            current={macroAverages.carbs}
            target={rangeData?.targets.carbsG ?? 200}
            color="var(--carbs)"
          />
          <MacroProgress
            label="Fat"
            current={macroAverages.fat}
            target={rangeData?.targets.fatG ?? 65}
            color="var(--fat)"
          />
        </div>
      </SectionCard>

      {/* ─── Streak Section ──────────────────────────────────────── */}
      <SectionCard icon={<Flame size={16} />} title="Logging Streak">
        <div className="flex items-baseline gap-3">
          <span
            className="text-4xl font-extralight text-text-primary"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {streak}
          </span>
          <span className="text-sm text-text-tertiary">
            {streak === 1 ? "day" : "days"} in a row
          </span>
          {streak >= 3 && (
            <span className="text-2xl" role="img" aria-label="fire">
              🔥
            </span>
          )}
        </div>
        {streak === 0 && (
          <p className="mt-2 text-xs text-text-disabled">
            Log a meal today to start your streak!
          </p>
        )}
      </SectionCard>

      {/* ─── Estimated TDEE Section ──────────────────────────────── */}
      <SectionCard icon={<Activity size={16} />} title="Estimated TDEE">
        {tdeeEstimate ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span
                className="text-4xl font-extralight text-text-primary"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {tdeeEstimate.tdee}
              </span>
              <span className="text-sm text-text-tertiary">cal / day</span>
            </div>
            <p className="text-xs text-text-tertiary">
              Based on your last {tdeeEstimate.weeksOfData} weeks of data.
              Avg intake: {tdeeEstimate.avgCalories} cal/day, weight trend:{" "}
              {tdeeEstimate.weightChangePerWeek > 0 ? "+" : ""}
              {tdeeEstimate.weightChangePerWeek}{" "}
              {units === "imperial" ? "lbs" : "kg"}/week.
            </p>
            <p className="text-[10px] text-text-disabled">
              TDEE = avg calories adjusted for weight change. More data improves accuracy.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-tertiary">
              Log for 2+ weeks to see your estimated TDEE
            </p>
            <p className="text-xs text-text-disabled">
              We need at least 14 days of calorie data and 2 weight entries to calculate your Total Daily Energy Expenditure.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Log weight drawer */}
      <LogWeightDrawer
        open={weightDrawerOpen}
        onOpenChange={setWeightDrawerOpen}
        units={units}
      />
    </div>
  );
}
