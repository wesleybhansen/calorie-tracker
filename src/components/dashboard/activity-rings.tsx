"use client";

import { motion } from "motion/react";

interface ActivityRingsProps {
  caloriesConsumed: number;
  caloriesTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
}

interface RingConfig {
  consumed: number;
  target: number;
  color: string;
  trackColor: string;
  radius: number;
  strokeWidth: number;
  delay: number;
}

function Ring({ consumed, target, color, trackColor, radius, strokeWidth, delay }: RingConfig) {
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? consumed / target : 0;
  // For overshoot, allow up to 1.15 to show overlap effect
  const clampedProgress = Math.min(progress, 1.15);
  const offset = circumference * (1 - clampedProgress);

  return (
    <>
      {/* Background track */}
      <circle
        cx="140"
        cy="140"
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        opacity={0.15}
      />
      {/* Progress arc */}
      <motion.circle
        cx="140"
        cy="140"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{
          type: "spring",
          stiffness: 60,
          damping: 20,
          delay: delay / 1000,
        }}
        transform="rotate(-90 140 140)"
      />
    </>
  );
}

export function ActivityRings({
  caloriesConsumed,
  caloriesTarget,
  proteinConsumed,
  proteinTarget,
  carbsConsumed,
  carbsTarget,
  fatConsumed,
  fatTarget,
}: ActivityRingsProps) {
  const remaining = Math.max(0, Math.round(caloriesTarget - caloriesConsumed));

  const rings: RingConfig[] = [
    {
      consumed: caloriesConsumed,
      target: caloriesTarget,
      color: "#E8E8E8",
      trackColor: "#E8E8E8",
      radius: 128,
      strokeWidth: 12,
      delay: 0,
    },
    {
      consumed: proteinConsumed,
      target: proteinTarget,
      color: "#6CB4EE",
      trackColor: "#6CB4EE",
      radius: 112,
      strokeWidth: 10,
      delay: 100,
    },
    {
      consumed: carbsConsumed,
      target: carbsTarget,
      color: "#FFB347",
      trackColor: "#FFB347",
      radius: 97,
      strokeWidth: 10,
      delay: 200,
    },
    {
      consumed: fatConsumed,
      target: fatTarget,
      color: "#B19CD9",
      trackColor: "#B19CD9",
      radius: 82,
      strokeWidth: 10,
      delay: 300,
    },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      <svg width="280" height="280" viewBox="0 0 280 280">
        {rings.map((ring, i) => (
          <Ring key={i} {...ring} />
        ))}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-text-primary leading-none"
          style={{
            fontSize: 48,
            fontWeight: 200,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {remaining}
        </span>
        <span className="mt-1 text-xs text-text-tertiary">remaining</span>
      </div>
    </div>
  );
}
