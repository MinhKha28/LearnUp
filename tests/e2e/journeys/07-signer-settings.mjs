import { GATEWAY } from "../lib/config.mjs";
import { assert, expectStatus } from "../lib/harness.mjs";
import { data, request } from "../lib/http.mjs";

const URL_ = `${GATEWAY}/api/v1/certificates/signer-settings`;

export default {
  id: "J7",
  title: "Organizer certificate signer settings: read with ETag, save with If-Match, conflicts rejected",
  services: ["api-gateway", "achievement-reporting"],
  async run({ step, shared }) {
    const a = shared.organizers.a;
    const signerName = `Nguyễn Thị Lan ${shared.runId}`;
    const current = await step("GET returns settings with a quoted version ETag", async () => {
      const res = expectStatus(await request("GET", URL_, { token: a.token }), 200);
      assert.equal(res.headers.get("etag"), `"${data(res).version}"`);
      return data(res);
    });
    const form = { signerName, signerTitle: "Giám đốc đào tạo", signatureAction: "keep" };
    await step("PUT without If-Match is rejected with 428", async () => {
      expectStatus(await request("PUT", URL_, { token: a.token, form, label: "/api/v1/certificates/signer-settings (no If-Match)" }), 428);
    });
    const saved = await step("PUT with current If-Match saves name/title (no signature upload)", async () => {
      const res = expectStatus(await request("PUT", URL_, { token: a.token, form, headers: { "if-match": `"${current.version}"` } }), 200);
      assert.equal(data(res).version, current.version + 1);
      assert.equal(res.headers.get("etag"), `"${current.version + 1}"`);
      return data(res);
    });
    await step("GET reads the saved values back", async () => {
      const res = expectStatus(await request("GET", URL_, { token: a.token }), 200);
      assert.equal(data(res).configured, true);
      assert.equal(data(res).signerName, signerName);
      assert.equal(data(res).signerTitle, "Giám đốc đào tạo");
      assert.equal(data(res).version, saved.version);
    });
    await step("PUT with a stale If-Match is rejected with 412 and changes nothing", async () => {
      const res = await request("PUT", URL_, {
        token: a.token,
        form: { ...form, signerName: "Stale writer" },
        headers: { "if-match": `"${current.version}"` },
        label: "/api/v1/certificates/signer-settings (stale)",
      });
      expectStatus(res, 412);
      const after = expectStatus(await request("GET", URL_, { token: a.token }), 200);
      assert.equal(data(after).signerName, signerName);
    });
    shared.signerNameA = signerName;
    if (shared.learner) {
      await step("learner cannot read signer settings (403)", async () => {
        expectStatus(await request("GET", URL_, { token: shared.learner.token, label: "/api/v1/certificates/signer-settings (learner)" }), 403);
      });
    }
  },
};
