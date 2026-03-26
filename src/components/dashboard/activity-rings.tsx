"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

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
  label: string;
}

/* ─── Confetti Particle ─── */

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  velocityX: number;
  velocityY: number;
}

function ConfettiBurst({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (trigger && !hasTriggered.current) {
      hasTriggered.current = true;
      const colors = ["#34D399", "#6CB4EE", "#FFB347", "#B19CD9", "#E8E8E8", "#6366F1"];
      const newParticles: Particle[] = Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        return {
          id: i,
          x: 140,
          y: 140,
          color: colors[i % colors.length],
          rotation: Math.random() * 360,
          scale: 0.5 + Math.random() * 0.8,
          velocityX: Math.cos(angle) * speed * (30 + Math.random() * 40),
          velocityY: Math.sin(angle) * speed * (30 + Math.random() * 40),
        };
      });
      setParticles(newParticles);

      // Clean up after animation
      const timer = setTimeout(() => setParticles([]), 1200);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            width: 6,
            height: 6,
            borderRadius: p.id % 3 === 0 ? "50%" : "1px",
            backgroundColor: p.color,
          }}
          initial={{
            x: 0,
            y: 0,
            scale: 0,
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            x: p.velocityX,
            y: p.velocityY,
            scale: p.scale,
            opacity: 0,
            rotate: p.rotation + 180,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.9,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      ))}
    </AnimatePresence>
  );
}

/* ─── Checkmark at completion point ─── */

function CompletionCheckmark({ radius, color }: { radius: number; color: string }) {
  // Position at the top of the ring (completion point for 100%)
  // The ring starts at -90deg (top), so 100% completion is back at the top
  const cx = 140;
  const cy = 140 - radius;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 15,
        delay: 0.6,
      }}
    >
      <circle cx={cx} cy={cy} r="8" fill={color} opacity="0.9" />
      <motion.path
        d={`M${cx - 3} ${cy} L${cx - 0.5} ${cy + 2.5} L${cx + 3.5} ${cy - 2}`}
        fill="none"
        stroke="#0A0A0C"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.8 }}
      />
    </motion.g>
  );
}

/* ─── Ring ─── */

function Ring({
  consumed,
  target,
  color,
  trackColor,
  radius,
  strokeWidth,
  delay,
}: RingConfig) {
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? consumed / target : 0;
  const isComplete = progress >= 1;
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

      {/* Green glow filter for completed rings */}
      {isComplete && (
        <defs>
          <filter id={`glow-${radius}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

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
        animate={{
          strokeDashoffset: offset,
          ...(isComplete
            ? { filter: `url(#glow-${radius})` }
            : {}),
        }}
        transition={{
          type: "spring",
          stiffness: 60,
          damping: 20,
          delay: delay / 1000,
        }}
        transform="rotate(-90 140 140)"
      />

      {/* Pulse animation on completion */}
      {isComplete && (
        <motion.circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 140 140)"
          initial={{ opacity: 0.6, strokeWidth: strokeWidth }}
          animate={{
            opacity: [0.6, 0],
            strokeWidth: [strokeWidth, strokeWidth + 6],
          }}
          transition={{
            duration: 0.8,
            delay: (delay / 1000) + 0.5,
            ease: "easeOut",
          }}
        />
      )}

      {/* Checkmark at completion point */}
      {isComplete && <CompletionCheckmark radius={radius} color={color} />}
    </>
  );
}

/* ─── Main ─── */

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
  const calorieComplete = caloriesTarget > 0 && caloriesConsumed >= caloriesTarget;

  const allComplete =
    caloriesTarget > 0 &&
    caloriesConsumed >= caloriesTarget &&
    proteinTarget > 0 &&
    proteinConsumed >= proteinTarget &&
    carbsTarget > 0 &&
    carbsConsumed >= carbsTarget &&
    fatTarget > 0 &&
    fatConsumed >= fatTarget;

  const rings: RingConfig[] = [
    {
      consumed: caloriesConsumed,
      target: caloriesTarget,
      color: "#E8E8E8",
      trackColor: "#E8E8E8",
      radius: 128,
      strokeWidth: 12,
      delay: 0,
      label: "calories",
    },
    {
      consumed: proteinConsumed,
      target: proteinTarget,
      color: "#6CB4EE",
      trackColor: "#6CB4EE",
      radius: 112,
      strokeWidth: 10,
      delay: 100,
      label: "protein",
    },
    {
      consumed: carbsConsumed,
      target: carbsTarget,
      color: "#FFB347",
      trackColor: "#FFB347",
      radius: 97,
      strokeWidth: 10,
      delay: 200,
      label: "carbs",
    },
    {
      consumed: fatConsumed,
      target: fatTarget,
      color: "#B19CD9",
      trackColor: "#B19CD9",
      radius: 82,
      strokeWidth: 10,
      delay: 300,
      label: "fat",
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
        {calorieComplete ? (
          <motion.div
            className="flex flex-col items-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.5 }}
          >
            {/* Checkmark icon */}
            <motion.svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.6 }}
            >
              <circle cx="12" cy="12" r="10" fill="#34D399" opacity="0.15" />
              <motion.path
                d="M8 12.5l2.5 2.5 5-5"
                stroke="#34D399"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.8 }}
              />
            </motion.svg>
            <span
              className="mt-1 text-xs font-medium"
              style={{ color: "#34D399" }}
            >
              Goal reached!
            </span>
          </motion.div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Confetti burst when all macros are complete */}
      <ConfettiBurst trigger={allComplete} />

      {/* Subtle green glow behind rings when calorie goal is reached */}
      {calorieComplete && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          style={{
            background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}
