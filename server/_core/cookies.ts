import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function isLocalhost(req: Request): boolean {
  const host = req.hostname || req.get("host") || "";
  return LOCAL_HOSTS.has(host.split(":")[0]) || host.startsWith("localhost:");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isLocal = isLocalhost(req);
  const isSecure = isSecureRequest(req);
  const isIp = isIpAddress(req.hostname || req.get("host") || "");

  // For localhost or IP address over HTTP: use 'lax' for better compatibility
  // For production with HTTPS: use 'none' for cross-site requests
  const sameSite = (isLocal || (isIp && !isSecure)) ? "lax" : "none";

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure: isSecure, // only set secure=true when actually using HTTPS
  };
}
