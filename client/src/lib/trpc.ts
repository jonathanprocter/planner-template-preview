import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

/**
 * tRPC React client instance
 * Provides type-safe API calls to the backend
 */
export const trpc = createTRPCReact<AppRouter>();
