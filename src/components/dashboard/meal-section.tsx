"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { Drawer } from "vaul";
import { format, subDays } from "date-fns";

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
  onCopyFromDate?: (fromDate: string) => void;
  isCopying?: boolean;
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

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CopyFromDateDrawer({
  open,
  onOpenChange,
  onSelectDate,
  isCopying,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDate: (dateStr: string) => void;
  isCopying?: boolean;
}) {
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, i + 1));

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface-1 outline-none">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-text-disabled/30" />
          <div className="px-5 pb-8 pt-4" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
            <Drawer.Title className="text-sm font-semibold text-text-primary mb-3">
              Copy meal from...
            </Drawer.Title>
            <div className="flex flex-col gap-1">
              {last7Days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      onSelectDate(dateStr);
                      onOpenChange(false);
                    }}
                    disabled={isCopying}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-text-primary transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <span>{format(day, "EEEE, MMM d")}</span>
                    <span className="text-xs text-text-tertiary">
                      {format(day, "yyyy-MM-dd") === format(subDays(today, 1), "yyyy-MM-dd")
                        ? "Yesterday"
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function MealSection({
  mealType,
  entries,
  totalCalories,
  onAddFood,
  onDeleteEntry,
  onCopyFromDate,
  isCopying,
}: MealSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [copyDrawerOpen, setCopyDrawerOpen] = useState(false);

  return (
    <>
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
            {/* Copy button */}
            {onCopyFromDate && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCopyDrawerOpen(true);
                }}
                className="flex items-center justify-center rounded-md p-1 text-text-tertiary transition-colors hover:text-primary hover:bg-primary/10"
              >
                <CopyIcon />
              </span>
            )}
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

      {/* Copy from date drawer */}
      <CopyFromDateDrawer
        open={copyDrawerOpen}
        onOpenChange={setCopyDrawerOpen}
        onSelectDate={(fromDate) => onCopyFromDate?.(fromDate)}
        isCopying={isCopying}
      />
    </>
  );
}
