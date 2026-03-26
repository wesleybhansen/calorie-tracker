"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { format } from "date-fns";

interface Suggestion {
  name: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reason: string;
}

interface AISuggestionsProps {
  selectedDate: Date;
  dateStr: string;
  onQuickAdd: (mealType: string) => void;
}

function SuggestionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

function getMealTypeFromHour(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snack";
}

export function AISuggestions({
  selectedDate,
  dateStr,
  onQuickAdd,
}: AISuggestionsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const suggestionsQuery = trpc.ai.suggest.useQuery(
    { date: dateStr },
    {
      staleTime: 30 * 60 * 1000, // 30 minutes
      retry: false,
    },
  );

  const quickAdd = trpc.meals.quickAdd.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate({ date: dateStr });
      utils.meals.getByDate.invalidate({ date: dateStr });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to add meal");
    },
  });

  const handleAddSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const mealType = getMealTypeFromHour();
      quickAdd.mutate(
        {
          date: dateStr,
          mealType,
          calories: suggestion.calories,
          description: suggestion.name,
        },
        {
          onSuccess: () => {
            toast.success(`Added to ${mealType}`, {
              description: `${suggestion.name} - ${suggestion.calories} cal`,
            });
          },
        },
      );
    },
    [dateStr, quickAdd],
  );

  const handleRefresh = useCallback(() => {
    suggestionsQuery.refetch();
  }, [suggestionsQuery]);

  if (suggestionsQuery.isError) {
    return null;
  }

  const suggestions = suggestionsQuery.data?.suggestions ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "#141418",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Sparkle icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6366F1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>
          <h3 className="text-sm font-semibold text-text-primary">
            AI Suggestions
          </h3>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleRefresh}
          disabled={suggestionsQuery.isFetching}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={
              suggestionsQuery.isFetching ? { rotate: 360 } : { rotate: 0 }
            }
            transition={
              suggestionsQuery.isFetching
                ? { duration: 1, repeat: Infinity, ease: "linear" }
                : { duration: 0 }
            }
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </motion.svg>
        </motion.button>
      </div>

      {/* Content */}
      {suggestionsQuery.isLoading ? (
        <SuggestionSkeleton />
      ) : suggestions.length === 0 ? (
        <p className="py-4 text-center text-xs text-text-disabled">
          No suggestions available right now
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: index * 0.05,
              }}
              className="overflow-hidden rounded-xl border"
              style={{
                backgroundColor: "#1C1C22",
                borderColor: "rgba(255,255,255,0.06)",
                borderLeftColor: "#6366F1",
                borderLeftWidth: "3px",
              }}
            >
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {suggestion.name}
                  </p>
                  <p className="mt-0.5 text-xs text-primary/80 truncate">
                    {suggestion.reason}
                  </p>
                </div>
                <div className="ml-3 flex-shrink-0 text-right">
                  <span
                    className="text-sm font-medium text-text-primary"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {suggestion.calories}
                  </span>
                  <p className="text-[10px] text-text-disabled">cal</p>
                </div>
              </button>

              <AnimatePresence>
                {expandedIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 35,
                    }}
                    className="overflow-hidden"
                  >
                    <div
                      className="border-t px-4 py-3"
                      style={{ borderColor: "rgba(255,255,255,0.06)" }}
                    >
                      {suggestion.description && (
                        <p className="mb-3 text-xs text-text-secondary">
                          {suggestion.description}
                        </p>
                      )}

                      {/* Macro breakdown */}
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "#6CB4EE" }}
                          />
                          {suggestion.proteinG}g protein
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "#FFB347" }}
                          />
                          {suggestion.carbsG}g carbs
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "#B19CD9" }}
                          />
                          {suggestion.fatG}g fat
                        </span>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSuggestion(suggestion);
                          setExpandedIndex(null);
                        }}
                        disabled={quickAdd.isPending}
                        className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {quickAdd.isPending ? "Adding..." : "Quick Add"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
