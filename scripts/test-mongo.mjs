#!/usr/bin/env node
/**
 * Start or stop a local MongoDB for the integration tests.
 *
 * If something already answers on the port — a dev server, an existing
 * container — it is reused rather than fought with, since the tests confine
 * themselves to `nolidz_test_*` databases and never touch anything else.
 */
import { execFileSync } from "node:child_process";
import net from "node:net";

const CONTAINER = "nolidz-test-mongo";
const IMAGE = "mongo:7";
const PORT = Number(process.env.TEST_MONGODB_PORT || 27017);

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net
      .connect({ port, host: "127.0.0.1" })
      .setTimeout(1000)
      .on("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .on("error", () => resolve(false))
      .on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
  });
}

function docker(args, { quiet = false } = {}) {
  return execFileSync("docker", args, {
    stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
}

function containerExists() {
  try {
    const out = docker(
      ["ps", "-a", "--filter", `name=^/${CONTAINER}$`, "--format", "{{.Names}}"],
      { quiet: true }
    );
    return out.trim() === CONTAINER;
  } catch {
    return false;
  }
}

async function start() {
  if (await portInUse(PORT)) {
    console.log(
      `MongoDB already listening on ${PORT} — reusing it. ` +
        `Tests use nolidz_test_* databases only.`
    );
    return;
  }

  if (containerExists()) {
    docker(["start", CONTAINER]);
  } else {
    docker(["run", "-d", "--name", CONTAINER, "-p", `${PORT}:27017`, IMAGE]);
  }

  // The server needs a moment before it accepts connections.
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await portInUse(PORT)) {
      console.log(`MongoDB ready on ${PORT}.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.error(`MongoDB did not become ready on ${PORT}.`);
  process.exit(1);
}

function stop() {
  if (!containerExists()) {
    console.log(`No ${CONTAINER} container to stop.`);
    return;
  }
  docker(["stop", CONTAINER]);
}

const command = process.argv[2];
if (command === "start") {
  await start();
} else if (command === "stop") {
  stop();
} else {
  console.error("Usage: node scripts/test-mongo.mjs <start|stop>");
  process.exit(1);
}
