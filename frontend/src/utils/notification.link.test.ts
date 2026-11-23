// @vitest-environment jsdom-native
import { expect, it } from "vitest";
import { getSafeNotificationLink } from "./notification.link";
it.each(["/learner/courses", "/learner/courses?q=1#result"])("accepts %s", (link) => {
 expect(getSafeNotificationLink(link)).toBe(link);
});
it.each([null, undefined, "", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)", "relative/path"])("rejects %s", (link) => {
 expect(getSafeNotificationLink(link)).toBeNull();
});
