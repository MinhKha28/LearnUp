#!/usr/bin/env node
/**
 * Local SMTP sink for the disposable E2E cluster. Accepts every message on loopback and
 * writes it as <MAILBOX_DIR>/<timestamp>-<n>.eml so the suite can read OTP codes and
 * invitation links. Nothing leaves the machine and nothing is ever deleted.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const port = Number(process.env.SMTP_SINK_PORT ?? 2525);
const dir = process.env.MAILBOX_DIR ?? "/tmp/learnup-e2e/mailbox";
fs.mkdirSync(dir, { recursive: true });
let seq = 0;

net
  .createServer((socket) => {
    let buffer = "";
    let inData = false;
    let data = [];
    let rcpt = [];
    const reply = (line) => socket.write(`${line}\r\n`);
    reply("220 learnup-e2e-sink ESMTP");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let idx;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            const file = path.join(dir, `${Date.now()}-${process.pid}-${seq++}.eml`);
            fs.writeFileSync(file, `X-Sink-Rcpt: ${rcpt.join(",")}\r\n${data.join("\r\n")}\r\n`);
            data = [];
            rcpt = [];
            reply("250 OK queued");
          } else data.push(line.startsWith("..") ? line.slice(1) : line);
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") {
          socket.write("250-learnup-e2e-sink\r\n250 8BITMIME\r\n");
        } else if (cmd === "HELO") reply("250 learnup-e2e-sink");
        else if (cmd === "RCPT") {
          rcpt.push(line.replace(/^RCPT TO:\s*/i, "").replace(/[<>]/g, "").trim());
          reply("250 OK");
        } else if (cmd === "DATA") {
          inData = true;
          reply("354 End data with <CR><LF>.<CR><LF>");
        } else if (cmd === "QUIT") {
          reply("221 Bye");
          socket.end();
        } else reply("250 OK");
      }
    });
    socket.on("error", () => {});
  })
  .listen(port, "127.0.0.1", () => console.log(`smtp-sink listening on 127.0.0.1:${port}, mailbox ${dir}`));
