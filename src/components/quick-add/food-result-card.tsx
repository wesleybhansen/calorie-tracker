"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface FoodResult {
  id: string;
  name: string;
  brand?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize?: string | null;
  servingUnit?: string | null;
  source?: string | null;
}

interface FoodResultCardProps {
  food: FoodResult;
  onAdd: (food: FoodResult, servings: number) => void;
}

export function FoodResultCard({ food, onAdd }: FoodResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [servings, setServings] = useState(1);

  const displayCals = Math.round(food.calories * servings);

  return (
    <motion.div
      layout
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: "#141418",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={() => {
          setExpanded(!expanded);
          setServings(1);
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {food.name}
          </p>
          {food.brand && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              {food.brand}
            </p>
          )}
          {/* Macro dots */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#6CB4EE" }}
              />
              {Math.round(food.proteinG)}p
            </span>
            <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#FFB347" }}
              />
              {Math.round(food.carbsG)}c
            </span>
            <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#B19CD9" }}
              />
              {Math.round(food.fatG)}f
            </span>
          </div>
        </div>
        <div className="ml-3 flex-shrink-0 text-right">
          <span
            className="text-sm font-medium text-text-primary"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(food.calories)}
          </span>
          <p className="text-[10px] text-text-disabled">
            {food.servingSize
              ? `per ${food.servingSize}${food.servingUnit ? ` ${food.servingUnit}` : ""}`
              : "per serving"}
          </p>
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
              className="flex items-center justify-between border-t px-4 py-3"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              {/* Stepper */}
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setServings(Math.max(0.5, servings - 0.5));
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-primary transition-colors active:bg-surface-1"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M3 7h8" />
                  </svg>
                </button>
                <span
                  className="min-w-[3rem] text-center text-sm font-semibold text-text-primary"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {servings}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setServings(servings + 0.5);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-primary transition-colors active:bg-surface-1"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M7 3v8M3 7h8" />
                  </svg>
                </button>
              </div>

              {/* Calories preview + Add button */}
              <div className="flex items-center gap-3">
                <span
                  className="text-sm text-text-secondary"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {displayCals} cal
                </span>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(food, servings);
                    setExpanded(false);
                    setServings(1);
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Add
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
