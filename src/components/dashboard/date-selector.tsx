"use client";

import { useState, useRef, useEffect } from "react";
import { format, addDays, isSameDay, isToday } from "date-fns";
import { motion } from "motion/react";

interface DateSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function DateSelector({ selectedDate, onDateChange }: DateSelectorProps) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Center scroll on mount
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const activeEl = container.querySelector("[data-active='true']");
      if (activeEl) {
        const elRect = (activeEl as HTMLElement).getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft =
          container.scrollLeft + elRect.left - containerRect.left - containerRect.width / 2 + elRect.width / 2;
        container.scrollTo({ left: scrollLeft, behavior: "instant" });
      }
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto py-2 scrollbar-none"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isDayToday = isToday(day);

        return (
          <button
            key={day.toISOString()}
            data-active={isSelected ? "true" : "false"}
            onClick={() => onDateChange(day)}
            className="relative flex flex-col items-center gap-1 rounded-xl px-3 py-2 min-w-[52px] transition-colors"
          >
            {isSelected && (
              <motion.div
                layoutId="date-selector-bg"
                className="absolute inset-0 rounded-xl bg-primary"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 text-[11px] font-medium uppercase ${
                isSelected
                  ? "text-primary-foreground"
                  : isDayToday
                    ? "text-primary"
                    : "text-text-tertiary"
              }`}
            >
              {format(day, "EEE")}
            </span>
            <span
              className={`relative z-10 text-lg font-semibold ${
                isSelected
                  ? "text-primary-foreground"
                  : isDayToday
                    ? "text-primary"
                    : "text-text-primary"
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {format(day, "d")}
            </span>
            {isDayToday && !isSelected && (
              <div className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
