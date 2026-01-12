import { z } from "zod";
import { publicProcedure, router } from "./trpc";

/**
 * System router for health checks
 */
export const systemRouter = router({
  /**
   * Health check endpoint
   * Returns ok status with timestamp validation
   */
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),
});
