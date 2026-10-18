const http = require("node:http");
const original = http.Server.prototype.emit;
let counts = { I1: 0, I2: 0, responses: {} };
http.Server.prototype.emit = function (event, ...args) {
  if (event === "request") {
    const [req, res] = args;
    const kind =
      req.method === "POST" &&
      /^\/api\/v1\/internal\/courses\/[^/]+\/lock$/.test(req.url)
        ? "I1"
        : req.method === "GET" &&
            /^\/api\/v1\/internal\/courses\/[^/]+\/tree$/.test(req.url)
          ? "I2"
          : null;
    if (kind) {
      counts[kind]++;
      const current = counts;
      res.once("finish", () => {
        const key = `${kind}:${res.statusCode}`;
        current.responses[key] = (current.responses[key] || 0) + 1;
      });
    }
  }
  return original.call(this, event, ...args);
};
http
  .createServer((req, res) => {
    if (req.method === "DELETE") counts = { I1: 0, I2: 0, responses: {} };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(counts));
  })
  .listen(18084, "127.0.0.1");
