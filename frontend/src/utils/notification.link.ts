/** Follow only destinations that the browser resolves within this app's origin. */
export const getSafeNotificationLink = (link: string | null | undefined): string | null => {
  if (typeof link !== "string" || !link.startsWith("/")) return null;
  try {
    const url = new URL(link, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
};
