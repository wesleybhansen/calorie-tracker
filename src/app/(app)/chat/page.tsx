"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface FoodItem {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface ParsedMessage {
  text: string;
  foodItems: FoodItem[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Utils ──────────────────────────────────────────────────────────

function parseFoodItems(content: string): ParsedMessage {
  const foodItemsRegex = /\[FOOD_ITEMS\]\s*([\s\S]*?)\s*\[\/FOOD_ITEMS\]/g;
  let text = content;
  const allItems: FoodItem[] = [];

  let match;
  while ((match = foodItemsRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as { items: FoodItem[] };
      if (parsed.items && Array.isArray(parsed.items)) {
        allItems.push(...parsed.items);
      }
    } catch {
      // ignore parse errors
    }
    text = text.replace(match[0], "");
  }

  return { text: text.trim(), foodItems: allItems };
}

function getMealTypeFromHour(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 20) return "Dinner";
  return "Snack";
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ─── Quick Prompts ──────────────────────────────────────────────────

const QUICK_PROMPTS = [
  {
    label: "Log my meal",
    prompt: "I want to log a meal. What did you have?",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    label: "What should I eat?",
    prompt: "Based on my remaining macros for today, what should I eat for my next meal?",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  {
    label: "Low-cal dinner ideas",
    prompt: "Can you suggest some low-calorie dinner ideas that fit my remaining macros?",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    ),
  },
  {
    label: "Nutrition analysis",
    prompt: "How is my nutrition looking today? Give me an analysis of what I've eaten so far.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-6 4 2 5-8" />
      </svg>
    ),
  },
];

// ─── Typing Indicator ───────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--text-tertiary)" }}
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Meal Type Selector ─────────────────────────────────────────────

function MealTypeSelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (type: string) => void;
}) {
  const types = ["Breakfast", "Lunch", "Dinner", "Snack"];
  return (
    <div className="flex gap-1.5">
      {types.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            selected === type
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2 text-text-secondary hover:bg-surface-3"
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}

// ─── Food Card ──────────────────────────────────────────────────────

function FoodCard({
  item,
  onAdd,
  isAdding,
  isAdded,
}: {
  item: FoodItem;
  onAdd: (item: FoodItem, mealType: string) => void;
  isAdding: boolean;
  isAdded: boolean;
}) {
  const [mealType, setMealType] = useState(getMealTypeFromHour);
  const [showMealSelector, setShowMealSelector] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl p-3"
      style={{ backgroundColor: "var(--surface-2)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {item.name}
          </p>
          <p className="mt-0.5 text-lg font-bold" style={{ color: "var(--calories)" }}>
            {item.calories}{" "}
            <span className="text-xs font-normal text-text-tertiary">cal</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {isAdded ? (
            <div className="flex h-8 items-center gap-1 rounded-lg bg-success/20 px-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "var(--success)" }}>Added</span>
            </div>
          ) : (
            <button
              onClick={() => {
                if (showMealSelector) {
                  onAdd(item, mealType);
                } else {
                  setShowMealSelector(true);
                }
              }}
              disabled={isAdding}
              className="flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {isAdding ? (
                <motion.div
                  className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Macro row */}
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span style={{ color: "var(--protein)" }}>
          <span className="font-semibold">{item.proteinG}g</span>{" "}
          <span className="opacity-70">P</span>
        </span>
        <span style={{ color: "var(--carbs)" }}>
          <span className="font-semibold">{item.carbsG}g</span>{" "}
          <span className="opacity-70">C</span>
        </span>
        <span style={{ color: "var(--fat)" }}>
          <span className="font-semibold">{item.fatG}g</span>{" "}
          <span className="opacity-70">F</span>
        </span>
      </div>

      {/* Meal type selector */}
      <AnimatePresence>
        {showMealSelector && !isAdded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--surface-3)" }}>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Add to
              </p>
              <div className="flex items-center gap-2">
                <MealTypeSelector selected={mealType} onSelect={setMealType} />
                <button
                  onClick={() => onAdd(item, mealType)}
                  disabled={isAdding}
                  className="ml-auto flex h-7 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Add All Button ─────────────────────────────────────────────────

function AddAllButton({
  items,
  onAddAll,
  addedItems,
}: {
  items: FoodItem[];
  onAddAll: (mealType: string) => void;
  addedItems: Set<string>;
}) {
  const [mealType, setMealType] = useState(getMealTypeFromHour);
  const [showSelector, setShowSelector] = useState(false);
  const remaining = items.filter((i) => !addedItems.has(i.name));

  if (remaining.length <= 1) return null;

  const totalCalories = remaining.reduce((s, i) => s + i.calories, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-3"
      style={{ backgroundColor: "var(--surface-2)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary">
            {remaining.length} items &middot; {totalCalories} cal total
          </p>
        </div>
        <button
          onClick={() => {
            if (showSelector) {
              onAddAll(mealType);
            } else {
              setShowSelector(true);
            }
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add All to {mealType}
        </button>
      </div>
      <AnimatePresence>
        {showSelector && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--surface-3)" }}>
              <MealTypeSelector selected={mealType} onSelect={setMealType} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────

function MessageBubble({
  message,
  onAddFood,
  addingItems,
  addedItems,
  onAddAll,
}: {
  message: ChatMessage;
  onAddFood: (item: FoodItem, mealType: string) => void;
  addingItems: Set<string>;
  addedItems: Set<string>;
  onAddAll: (items: FoodItem[], mealType: string) => void;
}) {
  const isUser = message.role === "user";
  const parsed = isUser
    ? { text: message.content, foodItems: [] }
    : parseFoodItems(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] ${isUser ? "" : "w-full max-w-[85%]"}`}
      >
        {/* Text bubble */}
        {parsed.text && (
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isUser
                ? "bg-primary text-primary-foreground"
                : ""
            }`}
            style={
              isUser
                ? {}
                : { backgroundColor: "var(--surface-1)" }
            }
          >
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
              isUser ? "" : "text-text-primary"
            }`}>
              {parsed.text}
            </p>
          </div>
        )}

        {/* Food cards */}
        {parsed.foodItems.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {parsed.foodItems.map((item, i) => (
              <FoodCard
                key={`${message.id}-food-${i}`}
                item={item}
                onAdd={onAddFood}
                isAdding={addingItems.has(item.name)}
                isAdded={addedItems.has(item.name)}
              />
            ))}
            <AddAllButton
              items={parsed.foodItems}
              addedItems={addedItems}
              onAddAll={(mealType) => onAddAll(parsed.foodItems, mealType)}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Chat Page ──────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const utils = trpc.useUtils();
  const today = format(new Date(), "yyyy-MM-dd");

  const logEntry = trpc.meals.logEntry.useMutation({
    onSuccess: () => {
      utils.daily.get.invalidate({ date: today });
      utils.meals.getByDate.invalidate({ date: today });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    },
    [],
  );

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsStreaming(true);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      const assistantId = generateId();

      try {
        abortRef.current = new AbortController();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error ?? `Request failed (${response.status})`,
          );
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        // Add empty assistant message
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m,
            ),
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // User cancelled
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : "Something went wrong";
        toast.error(errorMessage);

        // Add error message
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId),
          {
            id: assistantId,
            role: "assistant",
            content:
              "Sorry, I encountered an error. Please check your API key in Profile settings and try again.",
          },
        ]);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  // Add food item
  const handleAddFood = useCallback(
    async (item: FoodItem, mealType: string) => {
      setAddingItems((prev) => new Set(prev).add(item.name));
      try {
        await logEntry.mutateAsync({
          date: today,
          mealType,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        });
        setAddedItems((prev) => new Set(prev).add(item.name));
        toast.success(`${item.name} added to ${mealType}`);
      } catch {
        toast.error(`Failed to add ${item.name}`);
      } finally {
        setAddingItems((prev) => {
          const next = new Set(prev);
          next.delete(item.name);
          return next;
        });
      }
    },
    [logEntry, today],
  );

  // Add all food items
  const handleAddAll = useCallback(
    async (items: FoodItem[], mealType: string) => {
      const remaining = items.filter((i) => !addedItems.has(i.name));
      for (const item of remaining) {
        await handleAddFood(item, mealType);
      }
    },
    [handleAddFood, addedItems],
  );

  // Quick prompt
  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col -mx-4 -mt-4">
      {/* Header */}
      <div
        className="glass flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-1 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--primary)", opacity: 0.9 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6V2H8" />
              <path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
              <path d="M2 12h2" />
              <path d="M9 11v2" />
              <path d="M15 11v2" />
              <path d="M20 12h2" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text-primary">NutriBot</h1>
            <p className="text-[10px] text-text-tertiary">AI Nutrition Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages ? (
          /* Empty state with quick prompts */
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "rgba(99, 102, 241, 0.15)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6V2H8" />
                  <path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
                  <path d="M2 12h2" />
                  <path d="M9 11v2" />
                  <path d="M15 11v2" />
                  <path d="M20 12h2" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Hey! I&apos;m NutriBot
                </h2>
                <p className="mt-1 text-sm text-text-secondary max-w-[260px]">
                  Tell me what you ate and I&apos;ll log it. Or ask me anything about nutrition.
                </p>
              </div>
            </motion.div>

            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((qp, i) => (
                <motion.button
                  key={qp.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  style={{ backgroundColor: "var(--surface-1)" }}
                >
                  <span className="text-primary">{qp.icon}</span>
                  <span className="text-xs font-medium text-text-secondary">
                    {qp.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAddFood={handleAddFood}
                addingItems={addingItems}
                addedItems={addedItems}
                onAddAll={handleAddAll}
              />
            ))}
            {isStreaming &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl"
                    style={{ backgroundColor: "var(--surface-1)" }}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        className="glass border-t px-4 py-3"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div
            className="flex flex-1 items-end rounded-2xl px-4 py-2"
            style={{ backgroundColor: "var(--surface-1)" }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you ate..."
              rows={1}
              className="max-h-[120px] w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none"
              style={{ lineHeight: "1.5" }}
            />
          </div>
          <motion.button
            type="submit"
            disabled={!input.trim() || isStreaming}
            whileTap={{ scale: 0.9 }}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            {isStreaming ? (
              <motion.div
                className="h-4 w-4 rounded-sm bg-primary-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  abortRef.current?.abort();
                }}
              />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
