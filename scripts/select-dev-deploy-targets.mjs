#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ORDER = ["firestore", "storage", "database", "functions", "hosting"];
const ALL = new Set(ORDER);

function normalize(path) {
  return path.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export function selectDevDeployTargets(paths) {
  const targets = new Set();

  for (const rawPath of paths) {
    const path = normalize(rawPath);
    if (!path) continue;

    if (path === "firebase.json" || path === ".firebaserc") {
      for (const target of ALL) targets.add(target);
      continue;
    }
    if (path === "firestore.rules" || path === "firestore.indexes.json") {
      targets.add("firestore");
      continue;
    }
    if (path === "storage.rules") {
      targets.add("storage");
      continue;
    }
    if (path === "database.rules.json") {
      targets.add("database");
      continue;
    }
    if (path.startsWith("functions/")) {
      targets.add("functions");
      continue;
    }

    const noDeploy =
      path.startsWith(".agents/") ||
      path.startsWith(".codex/") ||
      path.startsWith(".github/") ||
      path.startsWith("docs/") ||
      path.startsWith("governance/") ||
      path.startsWith("test/") ||
      path.startsWith("scripts/") ||
      path.endsWith(".md") ||
      path === ".gitignore" ||
      path === "skills-lock.json";

    if (!noDeploy) targets.add("hosting");
  }

  return ORDER.filter((target) => targets.has(target));
}

function resolveManualTarget(target) {
  if (target === "all") return ORDER;
  if (!ORDER.includes(target)) throw new Error(`Unknown deploy target: ${target}`);
  return [target];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, value] = process.argv.slice(2);
  let targets;
  if (mode === "--target") {
    targets = resolveManualTarget(value);
  } else if (mode === "--stdin") {
    targets = selectDevDeployTargets(readFileSync(0, "utf8").split(/\r?\n/));
  } else {
    throw new Error("Use --target <all|service> or --stdin.");
  }
  process.stdout.write(targets.join(","));
}
