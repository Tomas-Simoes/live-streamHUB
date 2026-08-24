import { env } from "src/env/env";

export function getBackendApiUrl() {
  return getHostAlignedUrl(env.apiUrl);
}

export function getHostAlignedUrl(url: string) {
  const parsedUrl = new URL(url);
  const browserHostname = window.location.hostname;

  if (
    isLoopbackHostname(parsedUrl.hostname) &&
    !isLoopbackHostname(browserHostname)
  ) {
    parsedUrl.hostname = browserHostname;
  }

  return parsedUrl.toString().replace(/\/$/, "");
}

export function isLoopbackHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname);
}
