import { createTRPCRouter, publicProcedure } from "../init";
import { foodRouter } from "./food";
import { mealsRouter } from "./meals";
import { dailyRouter } from "./daily";
import { userRouter } from "./user";
import { aiRouter } from "./ai";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return { status: "ok" as const };
  }),
  food: foodRouter,
  meals: mealsRouter,
  daily: dailyRouter,
  user: userRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
