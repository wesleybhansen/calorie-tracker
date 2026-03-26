"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { QuickAddSheet } from "@/components/quick-add/quick-add-sheet";

function getMealTypeFromHour(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snack";
}

interface QuickAddFABProps {
  selectedDate: Date;
}

export function QuickAddFAB({ selectedDate }: QuickAddFABProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-primary/25"
        style={{ backgroundColor: "#6366F1" }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </motion.button>

      <QuickAddSheet
        open={open}
        onOpenChange={setOpen}
        selectedDate={selectedDate}
        defaultMealType={getMealTypeFromHour()}
      />
    </>
  );
}
