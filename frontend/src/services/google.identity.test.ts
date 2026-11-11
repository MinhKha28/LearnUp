import { afterEach, describe, expect, it } from "vitest";
import {
  GOOGLE_IDENTITY_SCRIPT,
  loadGoogleIdentity,
  resetGoogleIdentityLoader,
  type GoogleAccountsId,
} from "@/services/google.identity";

type FakeScript = {
  src?: string;
  async?: boolean;
  defer?: boolean;
  onload?: () => void;
  onerror?: () => void;
};

function fakeDom() {
  const appended: FakeScript[] = [];
  const doc = {
    createElement: () => ({}) as FakeScript,
    head: { appendChild: (node: FakeScript) => appended.push(node) },
  } as unknown as Document;
  const win: { google?: { accounts?: { id?: GoogleAccountsId } } } = {};
  return { doc, win, appended };
}

const api = { initialize() {}, renderButton() {} } as GoogleAccountsId;

describe("UC05.1 Google Identity Services loader", () => {
  afterEach(() => resetGoogleIdentityLoader());

  it("uses an already loaded GIS client without injecting another script", async () => {
    const { doc, win, appended } = fakeDom();
    win.google = { accounts: { id: api } };
    await expect(loadGoogleIdentity(doc, win)).resolves.toBe(api);
    expect(appended).toHaveLength(0);
  });

  it("injects the official GIS script once for concurrent callers", async () => {
    const { doc, win, appended } = fakeDom();
    const first = loadGoogleIdentity(doc, win);
    const second = loadGoogleIdentity(doc, win);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ src: GOOGLE_IDENTITY_SCRIPT, async: true, defer: true });
    expect(GOOGLE_IDENTITY_SCRIPT).toBe("https://accounts.google.com/gsi/client");
    win.google = { accounts: { id: api } };
    appended[0].onload?.();
    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
  });

  it("rejects when the script fails and allows a later retry", async () => {
    const { doc, win, appended } = fakeDom();
    const failed = loadGoogleIdentity(doc, win);
    appended[0].onerror?.();
    await expect(failed).rejects.toThrow();
    const retry = loadGoogleIdentity(doc, win);
    expect(appended).toHaveLength(2);
    win.google = { accounts: { id: api } };
    appended[1].onload?.();
    await expect(retry).resolves.toBe(api);
  });

  it("rejects when the script loads but does not expose the ID API", async () => {
    const { doc, win, appended } = fakeDom();
    const pending = loadGoogleIdentity(doc, win);
    appended[0].onload?.();
    await expect(pending).rejects.toThrow();
  });
});
