#!/usr/bin/env node
// Shared task board for agent teammates (tasks.json in the main checkout).
// Every write takes an exclusive lockfile, re-reads the board, then replaces it
// via temp file + rename, so concurrent claims can't both succeed.
//
// Usage: node scripts/tasks.mjs <command> [args] [--agent <name>]
//   list [--status pending|in_progress|completed] [--role <role>]
//   show <id>
//   add --title <t> [--desc <d>] [--role <role>] [--deps T1,T2]
//   claim <id>                      claim a specific unblocked task
//   next [--role <role>]            claim the first unblocked pending task
//   release <id>                    give a claimed task back
//   complete <id>
//   contract <id> --with <agent> --text <t>   record a contract agreed over SendMessage
//   note <id> --text <t>
// --agent defaults to $TEAM_AGENT_NAME. Exit codes: 0 ok, 1 usage/error, 2 conflict.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 15_000;

function repoRoot() {
  // Resolve the main checkout even from a linked worktree, so every teammate
  // shares one tasks.json instead of a per-branch copy.
  try {
    const commonDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return path.dirname(commonDir);
  } catch {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  }
}

const FILE = process.env.TASKS_FILE ?? path.join(repoRoot(), "tasks.json");
const LOCK = `${FILE}.lock`;

class TaskError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Throw rather than exit, so mutate()'s finally always releases the lock.
function fail(message, code = 1) {
  throw new TaskError(message, code);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(agent) {
  const start = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(LOCK, "wx");
      fs.writeSync(fd, JSON.stringify({ agent, pid: process.pid, at: new Date().toISOString() }));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
    // A lock older than any real operation means its holder crashed.
    try {
      if (Date.now() - fs.statSync(LOCK).mtimeMs > LOCK_STALE_MS) {
        fs.rmSync(LOCK, { force: true });
        continue;
      }
    } catch {
      continue;
    }
    if (Date.now() - start > LOCK_TIMEOUT_MS) fail(`timed out waiting for ${LOCK}`);
    sleep(25 + Math.random() * 75);
  }
}

function releaseLock() {
  fs.rmSync(LOCK, { force: true });
}

function readBoard() {
  if (!fs.existsSync(FILE)) fail(`${FILE} not found`);
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeBoard(board) {
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(board, null, 2)}\n`);
  // Windows can briefly refuse the rename while another process is reading.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, FILE);
      return;
    } catch (err) {
      if (attempt >= 20 || !["EPERM", "EBUSY", "EACCES"].includes(err.code)) {
        fs.rmSync(tmp, { force: true });
        throw err;
      }
      sleep(50);
    }
  }
}

function mutate(agent, fn) {
  acquireLock(agent);
  try {
    const board = readBoard();
    const result = fn(board);
    board.updatedAt = new Date().toISOString();
    writeBoard(board);
    return result;
  } finally {
    releaseLock();
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`--${key} needs a value`);
      flags[key] = value;
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  return { positional, flags };
}

function findTask(board, id) {
  const task = board.tasks.find((t) => t.id === id);
  if (!task) fail(`no task ${id}`);
  return task;
}

function isUnblocked(board, task) {
  return task.dependsOn.every((dep) => board.tasks.find((t) => t.id === dep)?.status === "completed");
}

function claimTask(board, task, agent) {
  if (task.status !== "pending" || task.claimedBy) {
    fail(`${task.id} is ${task.status}${task.claimedBy ? ` (claimed by ${task.claimedBy})` : ""}`, 2);
  }
  if (!isUnblocked(board, task)) fail(`${task.id} is blocked by ${task.dependsOn.join(", ")}`, 2);
  task.status = "in_progress";
  task.claimedBy = agent;
  task.updatedAt = new Date().toISOString();
  return task;
}

function requireOwner(task, agent) {
  if (task.claimedBy !== agent) fail(`${task.id} is claimed by ${task.claimedBy ?? "nobody"}, not ${agent}`, 2);
}

function addNote(task, agent, text) {
  task.notes.push({ by: agent, text, at: new Date().toISOString() });
  task.updatedAt = new Date().toISOString();
}

function run(argv) {
  const { positional, flags } = parseArgs(argv);
  const [command, id] = positional;
  const agent = flags.agent ?? process.env.TEAM_AGENT_NAME;
  const needsAgent = ["add", "claim", "next", "release", "complete", "contract", "note"];
  if (needsAgent.includes(command) && !agent) fail("--agent <name> (or TEAM_AGENT_NAME) is required");
  const needsId = ["show", "claim", "release", "complete", "contract", "note"];
  if (needsId.includes(command) && !id) fail(`${command} needs a task id`);

  let output;
  switch (command) {
    case "list": {
      output = readBoard().tasks.filter(
        (t) => (!flags.status || t.status === flags.status) && (!flags.role || t.role === flags.role),
      );
      break;
    }
    case "show":
      output = findTask(readBoard(), id);
      break;
    case "add": {
      if (!flags.title) fail("add needs --title");
      output = mutate(agent, (board) => {
        const next = Math.max(0, ...board.tasks.map((t) => Number(t.id.slice(1)) || 0)) + 1;
        const now = new Date().toISOString();
        const task = {
          id: `T${next}`,
          title: flags.title,
          description: flags.desc ?? "",
          role: flags.role ?? null,
          status: "pending",
          claimedBy: null,
          dependsOn: flags.deps ? flags.deps.split(",").map((d) => d.trim()).filter(Boolean) : [],
          contract: null,
          notes: [],
          createdBy: agent,
          createdAt: now,
          updatedAt: now,
        };
        board.tasks.push(task);
        return task;
      });
      break;
    }
    case "claim":
      output = mutate(agent, (board) => claimTask(board, findTask(board, id), agent));
      break;
    case "next":
      output = mutate(agent, (board) => {
        const task = board.tasks.find(
          (t) =>
            t.status === "pending" &&
            !t.claimedBy &&
            (!flags.role || !t.role || t.role === flags.role) &&
            isUnblocked(board, t),
        );
        if (!task) fail("no unblocked pending tasks", 2);
        return claimTask(board, task, agent);
      });
      break;
    case "release":
      output = mutate(agent, (board) => {
        const task = findTask(board, id);
        requireOwner(task, agent);
        task.status = "pending";
        task.claimedBy = null;
        task.updatedAt = new Date().toISOString();
        return task;
      });
      break;
    case "complete":
      output = mutate(agent, (board) => {
        const task = findTask(board, id);
        requireOwner(task, agent);
        task.status = "completed";
        task.updatedAt = new Date().toISOString();
        return task;
      });
      break;
    case "contract": {
      if (!flags.with || !flags.text) fail("contract needs --with <agent> and --text <contract>");
      output = mutate(agent, (board) => {
        const task = findTask(board, id);
        task.contract = { text: flags.text, agreedBy: [agent, flags.with], at: new Date().toISOString() };
        addNote(task, agent, `contract agreed with ${flags.with}`);
        return task;
      });
      break;
    }
    case "note": {
      if (!flags.text) fail("note needs --text");
      output = mutate(agent, (board) => {
        const task = findTask(board, id);
        addNote(task, agent, flags.text);
        return task;
      });
      break;
    }
    default:
      fail("usage: node scripts/tasks.mjs <list|show|add|claim|next|release|complete|contract|note> ... (see header)");
  }
  return output;
}

try {
  console.log(JSON.stringify(run(process.argv.slice(2)), null, 2));
} catch (err) {
  if (!(err instanceof TaskError)) throw err;
  console.error(`tasks: ${err.message}`);
  process.exitCode = err.code;
}
