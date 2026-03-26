"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";

export interface FoodEntry {
  id: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealSectionProps {
  mealType: string;
  entries: FoodEntry[];
  totalCalories: number;
  onAddFood?: () => void;
  onDeleteEntry?: (id: string) => void;
}

function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein + carbs + fat;
  if (total === 0) return null;

  const pPct = (protein / total) * 100;
  const cPct = (carbs / total) * 100;
  const fPct = (fat / total) * 100;

  return (
    <div className="mt-1.5 flex h-[3px] w-full gap-px overflow-hidden rounded-full">
      <div className="rounded-full" style={{ width: `${pPct}%`, backgroundColor: "#6CB4EE" }} />
      <div className="rounded-full" style={{ width: `${cPct}%`, backgroundColor: "#FFB347" }} />
      <div className="rounded-full" style={{ width: `${fPct}%`, backgroundColor: "#B19CD9" }} />
    </div>
  );
}

function SwipeableEntry({
  entry,
  onDelete,
}: {
  entry: FoodEntry;
  onDelete?: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -60], [1, 0]);
  const deleteScale = useTransform(x, [-100, -60], [1, 0.8]);

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center pr-4"
        style={{ opacity: deleteOpacity, scale: deleteScale }}
      >
        <button
          onClick={() => onDelete?.(entry.id)}
          className="rounded-lg bg-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive"
        >
          Delete
        </button>
      </motion.div>

      {/* Entry content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) {
            onDelete?.(entry.id);
          }
        }}
        className="relative z-10 bg-surface-1 px-4 py-3"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{entry.name}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{entry.serving}</p>
          </div>
          <span
            className="ml-3 text-sm text-text-secondary flex-shrink-0"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {entry.calories}
          </span>
        </div>
        <MacroBar protein={entry.protein} carbs={entry.carbs} fat={entry.fat} />
      </motion.div>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: expanded ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <path d="M4 6l4 4 4-4" />
    </motion.svg>
  );
}

export function MealSection({
  mealType,
  entries,
  totalCalories,
  onAddFood,
  onDeleteEntry,
}: MealSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "var(--surface-1)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <span className="text-sm font-semibold text-text-primary">{mealType}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-sm text-text-secondary"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {totalCalories} cal
          </span>
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {/* Entries */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {entries.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-text-disabled">Tap + to add food</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  {entries.map((entry) => (
                    <SwipeableEntry key={entry.id} entry={entry} onDelete={onDeleteEntry} />
                  ))}
                </div>
              )}

              {/* Add button */}
              <button
                onClick={onAddFood}
                className="flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M7 2v10M2 7h10" />
                </svg>
                Add Food
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
