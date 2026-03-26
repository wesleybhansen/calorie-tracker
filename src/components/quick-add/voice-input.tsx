"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { FoodResultCard, type FoodResult } from "./food-result-card";

// ─── Types for Web Speech API ──────────────────────────────────────
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface VoiceInputProps {
  mealType: string;
  dateStr: string;
  onAddFood: (food: FoodResult, servings: number) => void;
  onClose: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  mealType,
  dateStr,
  onAddFood,
  onClose,
}: VoiceInputProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [aiResults, setAiResults] = useState<FoodResult[]>([]);
  const [hasResults, setHasResults] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseText = trpc.ai.parseText.useMutation({
    onSuccess: (data) => {
      const results: FoodResult[] = data.items.map((item, i) => ({
        id: `voice-${i}-${Date.now()}`,
        name: item.name,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        source: "ai",
      }));
      setAiResults(results);
      setHasResults(true);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to parse food description");
    },
  });

  // Check browser support
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setIsSupported(false);
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Auto-stop after 5 seconds of silence
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }, 5000);
  }, [clearSilenceTimer]);

  const stopRecording = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, [clearSilenceTimer]);

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript("");
      setInterimTranscript("");
      setAiResults([]);
      setHasResults(false);
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      setTranscript(finalText);
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
      clearSilenceTimer();
    };

    recognition.onend = () => {
      setIsRecording(false);
      clearSilenceTimer();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [resetSilenceTimer, clearSilenceTimer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [clearSilenceTimer]);

  // Auto-send to AI when recording stops and we have text
  const fullTranscript = (transcript + " " + interimTranscript).trim();
  const prevIsRecordingRef = useRef(isRecording);

  useEffect(() => {
    if (prevIsRecordingRef.current && !isRecording && fullTranscript) {
      parseText.mutate({ text: fullTranscript, mealType });
    }
    prevIsRecordingRef.current = isRecording;
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendManually = useCallback(() => {
    if (fullTranscript) {
      parseText.mutate({ text: fullTranscript, mealType });
    }
  }, [fullTranscript, mealType, parseText]);

  const handleAddAll = useCallback(() => {
    for (const food of aiResults) {
      onAddFood(food, 1);
    }
    toast.success(`Added ${aiResults.length} items to ${mealType}`);
    onClose();
  }, [aiResults, mealType, onAddFood, onClose]);

  // ─── Not supported ──────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(248,113,113,0.1)" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F87171"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.36 2.18" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            Voice input not supported
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            Try Chrome, Safari, or Edge for voice input
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium text-text-secondary"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Mic button + transcript area */}
      {!hasResults && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex flex-col items-center gap-4"
        >
          {/* Mic button */}
          <div className="relative">
            {/* Pulsing rings when recording */}
            <AnimatePresence>
              {isRecording && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: "rgba(239,68,68,0.15)" }}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: "rgba(239,68,68,0.15)" }}
                    initial={{ scale: 1, opacity: 0.4 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: 0.4,
                    }}
                  />
                </>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isRecording ? stopRecording : startRecording}
              className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full transition-colors"
              style={{
                backgroundColor: isRecording
                  ? "rgba(239,68,68,0.9)"
                  : "#6366F1",
              }}
            >
              {isRecording ? (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </motion.button>
          </div>

          <p className="text-xs text-text-tertiary">
            {isRecording
              ? "Listening... tap to stop"
              : "Tap the mic and describe your food"}
          </p>

          {/* Live transcript */}
          {(fullTranscript || isRecording) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full rounded-xl border p-4"
              style={{
                backgroundColor: "#141418",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-disabled">
                Transcript
              </p>
              <p className="min-h-[2rem] text-sm text-text-primary">
                {transcript}
                {interimTranscript && (
                  <span className="text-text-tertiary">
                    {interimTranscript}
                  </span>
                )}
                {isRecording && !fullTranscript && (
                  <span className="text-text-disabled">Listening...</span>
                )}
              </p>
            </motion.div>
          )}

          {/* Manual send button (visible when not recording and have transcript) */}
          {!isRecording && fullTranscript && !parseText.isPending && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendManually}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Analyze with AI
            </motion.button>
          )}

          {/* Loading state */}
          {parseText.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-2"
            >
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-text-secondary">
                Analyzing your food...
              </span>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* AI Results */}
      <AnimatePresence>
        {hasResults && aiResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Detected Foods
              </p>
              <button
                onClick={() => {
                  setHasResults(false);
                  setAiResults([]);
                  setTranscript("");
                  setInterimTranscript("");
                }}
                className="text-xs font-medium text-primary"
              >
                Try Again
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {aiResults.map((food) => (
                <FoodResultCard key={food.id} food={food} onAdd={onAddFood} />
              ))}
            </div>

            {/* Add All button */}
            {aiResults.length > 1 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAddAll}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add All ({aiResults.length} items)
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results message */}
      {hasResults && aiResults.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-6"
        >
          <p className="text-sm text-text-secondary">
            Could not identify any foods. Try again?
          </p>
          <button
            onClick={() => {
              setHasResults(false);
              setAiResults([]);
              setTranscript("");
              setInterimTranscript("");
            }}
            className="text-sm font-medium text-primary"
          >
            Try Again
          </button>
        </motion.div>
      )}

      {/* Back button */}
      <button
        onClick={onClose}
        className="mt-1 text-xs font-medium text-text-tertiary"
      >
        Back to search
      </button>
    </div>
  );
}
