import { describe, expect, it } from "vitest";
import {
  exceededLimitLines,
  renewalErrorMessage,
  renewalTermNote,
} from "./renewal.view";

describe("UC10.1 renewal view", () => {
  it("BR-4: lists each limit below current usage, storage in GB", () => {
    expect(
      exceededLimitLines([
        { limit: "learners", used: 120, newLimit: 100 },
        {
          limit: "storageBytes",
          used: 60 * 1024 ** 3,
          newLimit: 50 * 1024 ** 3,
        },
      ]),
    ).toEqual([
      "Learners: using 120, new limit 100",
      "Storage: using 60 GB, new limit 50 GB",
    ]);
    expect(exceededLimitLines([])).toEqual([]);
  });

  it("explains when the new term starts for each status", () => {
    expect(renewalTermNote("Active")).toContain("starts when it expires");
    expect(renewalTermNote("Grace")).toContain("old expiry date");
    expect(renewalTermNote("Suspended")).toContain("payment date");
  });

  it("maps backend errors without raw codes", () => {
    expect(renewalErrorMessage("RENEWAL_ALREADY_SCHEDULED")).toContain(
      "already paid",
    );
    expect(renewalErrorMessage("SOMETHING_NEW")).not.toContain("SOMETHING_NEW");
    expect(renewalErrorMessage(undefined)).toContain("try again later");
  });
});
