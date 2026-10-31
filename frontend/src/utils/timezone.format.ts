/** Readable Vietnamese zone name and the UTC offset at the supplied instant. */
export const formatTimezone = (timeZone: string, instant: Date): string => {
  try {
    const zonePart = (timeZoneName: "longGeneric" | "shortOffset") =>
      new Intl.DateTimeFormat("vi", { timeZone, timeZoneName })
        .formatToParts(instant).find(part => part.type === "timeZoneName")?.value.trim() ?? "";
    const offset = zonePart("shortOffset");
    const generic = zonePart("longGeneric");
    const unreadableCharacters = generic.includes("/") || generic.includes("_") ||
      generic.includes("\ufffd") || [...generic].some(character => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      });
    const readable = generic && generic !== offset && generic !== timeZone &&
      /\p{L}/u.test(generic) && !unreadableCharacters &&
      !/^(?:GMT|UTC)[+-]/i.test(generic) && !/^[A-Z]{2,6}$/.test(generic);
    const city = timeZone.split("/").at(-1)!.replaceAll("_", " ");
    const name = readable
      ? generic[0].toLocaleLowerCase("vi") + generic.slice(1)
      : `giờ ${city}`;
    return `${name} (${offset})`;
  } catch {
    return "múi giờ không xác định";
  }
};

/** Compare zone identities without exposing or persisting ICU's alias spelling. */
export const isSameZone = (a: string | null, b: string | null): boolean => {
  if (!a || !b) return false;
  try {
    const left = new Intl.DateTimeFormat("en", { timeZone: a }).resolvedOptions().timeZone;
    return a === b || left === new Intl.DateTimeFormat("en", { timeZone: b }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
};
