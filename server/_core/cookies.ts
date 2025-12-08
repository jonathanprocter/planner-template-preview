import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Checks if a hostname is an IP address (IPv4 or IPv6)
 */
function isIpAddress(host: string): boolean {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

/**
 * Determines if the request is over HTTPS by checking protocol and proxy headers
 */
function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Returns secure cookie options for session management
 * Uses SameSite=None for cross-origin requests (required for OAuth flows)
 * Automatically detects HTTPS from request headers
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // Domain setting is commented out to allow cookies to work across subdomains
  // Uncomment and adjust if you need specific domain restrictions
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  const isSecure = isSecureRequest(req);
  
  return {
    httpOnly: true, // Prevents XSS attacks by making cookie inaccessible to JavaScript
    path: "/",
    // Use "lax" in development (non-HTTPS), "none" in production (HTTPS)
    // This prevents the SameSite=None without Secure error
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure, // Only send over HTTPS in production
  };
}
