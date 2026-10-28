const root = require("node:path").resolve(
  __dirname,
  "../../services/achievement-reporting-service",
);
const { PrismaService } = require(
  root + "/dist/src/infrastructure/prisma/prisma.service",
);
const { services, httpApp } = require(
  root + "/test/certificate-read.helpers.cjs",
);
const { png } = require(root + "/test/signer.helpers.cjs");
async function main() {
  const db = new PrismaService({ getOrThrow: () => process.env.DATABASE_URL });
  await db.$connect();
  const { service } = services({ db }, { read: async () => png() });
  const { app, base } = await httpApp(service);
  let previous = process.cpuUsage(),
    previousTime = performance.now(),
    rss = process.memoryUsage().rss;
  const timer = setInterval(() => {
    rss = Math.max(rss, process.memoryUsage().rss);
  }, 25);
  process.on("message", async (message) => {
    if (message === "sample") {
      const now = performance.now(),
        usage = process.cpuUsage(),
        elapsed = now - previousTime;
      process.send({
        type: "sample",
        rssBytes: rss,
        cpuPercent:
          (100 *
            (usage.user - previous.user + (usage.system - previous.system))) /
          (elapsed * 1000),
      });
      previous = usage;
      previousTime = now;
      rss = process.memoryUsage().rss;
    }
    if (message === "stop") {
      clearInterval(timer);
      await app.close();
      await db.$disconnect();
      process.exit(0);
    }
  });
  process.send({ type: "ready", base });
}
main().catch(() => {
  process.send?.({ type: "failed" });
  process.exit(1);
});
