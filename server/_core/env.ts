/**
 * Environment configuration
 * Centralizes all environment variables with fallback defaults
 * All values are read from process.env at module load time
 */
export const ENV = {
  /** Application ID from Manus platform */
  appId: process.env.VITE_APP_ID ?? "",
  /** Secret key for signing JWT session tokens */
  cookieSecret: process.env.JWT_SECRET ?? "",
  /** MySQL database connection string */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** OAuth server URL for authentication */
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  /** OpenID of the project owner for admin access */
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /** Production environment flag */
  isProduction: process.env.NODE_ENV === "production",
  /** Manus Forge API base URL */
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  /** Manus Forge API authentication key */
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
} as const;
