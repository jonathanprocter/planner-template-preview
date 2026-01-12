import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Default user for single-user mode (no authentication)
const DEFAULT_USER_OPEN_ID = "default-user";
const DEFAULT_USER_NAME = "User";
const DEFAULT_USER_EMAIL = "user@example.com";

/**
 * Gets or creates the default user for single-user mode
 */
async function getOrCreateDefaultUser(): Promise<User | null> {
  try {
    // Try to get existing default user
    let user = await db.getUserByOpenId(DEFAULT_USER_OPEN_ID);

    if (!user) {
      // Create default user if doesn't exist
      await db.upsertUser({
        openId: DEFAULT_USER_OPEN_ID,
        name: DEFAULT_USER_NAME,
        email: DEFAULT_USER_EMAIL,
        loginMethod: "default",
        lastSignedIn: new Date(),
      });
      user = await db.getUserByOpenId(DEFAULT_USER_OPEN_ID);
    }

    return user ?? null;
  } catch (error) {
    console.error("Failed to get or create default user:", error);
    return null;
  }
}

/**
 * Creates tRPC context for each request
 * Uses a default user for all requests (single-user mode)
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await getOrCreateDefaultUser();

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
