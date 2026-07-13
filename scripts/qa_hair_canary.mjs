#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const canary = "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const targetUrl = process.argv[2];
const outputDirectory = process.argv[3] ?? "/tmp/hair-canary-qa";
if (!targetUrl) throw new Error("usage: qa_hair_canary.mjs URL [OUTPUT_DIRECTORY]");

const profile = path.join(outputDirectory, "profile");
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(profile, { recursive: true });

const browser = spawn(
  canary,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--window-size=960,900",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);

const browserSocketUrl = await new Promise((resolve, reject) => {
  let stderr = "";
  const timer = setTimeout(() => reject(new Error(`Canary startup timeout\n${stderr}`)), 10_000);
  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data", (chunk) => {
    stderr += chunk;
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (!match) return;
    clearTimeout(timer);
    resolve(match[1]);
  });
  browser.once("exit", (code) => reject(new Error(`Canary exited before DevTools: ${code}`)));
});

const debugPort = new URL(browserSocketUrl).port;
const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) =>
  response.json()
);
const pageTarget = targets.find((target) => target.type === "page");
if (!pageTarget) throw new Error("Canary did not expose a page target");

const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const exceptions = [];
const consoleErrors = [];
const events = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails.text);
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    consoleErrors.push(message.params.entry.text);
  }
  const waiters = events.get(message.method) ?? [];
  events.delete(message.method);
  for (const waiter of waiters) waiter(message.params);
});

function send(method, params = {}) {
  const id = (commandId += 1);
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function nextEvent(method, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${method} timeout`)), timeoutMs);
    const waiter = (params) => {
      clearTimeout(timer);
      resolve(params);
    };
    events.set(method, [...(events.get(method) ?? []), waiter]);
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails)
    );
  }
  return result.result.value;
}

async function capture(name) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path.join(outputDirectory, `${name}.png`), Buffer.from(result.data, "base64"));
  return evaluate(`(() => {
    const receipt = document.documentElement.dataset.hairRenderReceipt ?? null;
    const parsed = receipt ? JSON.parse(receipt) : null;
    return {
      phase: document.querySelector("#showcase-phase")?.textContent,
      material: document.querySelector("#showcase-material")?.textContent,
      wind: document.querySelector("#showcase-wind")?.textContent,
      physics_digest: parsed?.physics_state_digest ?? null,
      active_composition:
        parsed?.full_groom_hydration?.breadth_lab?.active_composition?.id ?? null,
      receipt
    };
  })()`);
}

const captureSchedule = [
  [1.2, "01-mechanical-rods"],
  [2.8, "02-groom-volume"],
  [4.2, "03-owner-guides"],
  [5.8, "04-clump-children"],
  [7.3, "05-microfiber-fill"],
  [8.8, "06-flyaway-frizz"],
  [10, "07-flat-blueprint"],
  [11.1, "08-fine-transmission"],
  [12.1, "09-natural-full"],
  [13.1, "10-coarse-matte"],
  [14.1, "11-ebony-near-field"],
  [15.1, "12-copper-artist-dual"],
  [16.1, "13-blonde-backlight"],
  [17.1, "14-silver-glint"],
  [18.1, "15-soft-wave"],
  [19.1, "16-tight-coil"],
  [20.1, "17-flyaway-layer"],
  [21.1, "18-wet-locks"],
  [23.3, "19-strong-wind"],
  [29.3, "20-moderate-wind"],
];

try {
  await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable")]);
  const loaded = nextEvent("Page.loadEventFired");
  await send("Page.navigate", { url: targetUrl });
  await loaded;
  const readyDeadline = Date.now() + 30_000;
  while (
    !(await evaluate(
      "Boolean(window.hairMaterialReplay?.renderReceipt().native_box3d_clip.metadata)"
    ))
  ) {
    if (Date.now() >= readyDeadline) throw new Error("native Box3D clip readiness timeout");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const captures = [];
  for (const [seconds, name] of captureSchedule) {
    await evaluate(`window.hairMaterialReplay.seekPresentation(${JSON.stringify(seconds)})`);
    captures.push({ seconds, name, ...(await capture(name)) });
  }
  const receipt = captures.findLast((captureItem) => captureItem.receipt)?.receipt ?? null;
  await writeFile(
    path.join(outputDirectory, "qa.json"),
    `${JSON.stringify(
      {
        url: targetUrl,
        browser: "Google Chrome Canary",
        captures: captures.map(({ receipt: ignored, ...captureItem }) => captureItem),
        exceptions,
        console_errors: consoleErrors,
        final_render_receipt: receipt ? JSON.parse(receipt) : null,
      },
      null,
      2
    )}\n`
  );
  console.log(path.join(outputDirectory, "qa.json"));
} finally {
  socket.close();
  browser.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => browser.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (browser.exitCode === null) browser.kill("SIGKILL");
  await rm(profile, { recursive: true, force: true });
}
