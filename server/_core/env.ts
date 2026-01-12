/**
 * Environment configuration
 * Centralizes all environment variables with fallback defaults
 * All values are read from process.env at module load time
 */
export const ENV = {
  /** Secret key for signing JWT session tokens */
  jwtSecret: process.env.JWT_SECRET ?? "",
  /** PostgreSQL database connection string */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Production environment flag */
  isProduction: process.env.NODE_ENV === "production",
} as const;
