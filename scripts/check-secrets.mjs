/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * check-secrets.mjs
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Performs a lightweight repository check for common accidental secret material.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Reject private-key material
 * • Reject common high-confidence credential prefixes
 * • Reject committed environment files
 * • Avoid scanning generated or dependency directories
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Repository Safety Script
 *
 * Consumes:
 *   • Repository files
 *
 * Produces:
 *   • Non-zero process status when suspicious material is found
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * This is defense in depth, not a substitute for a dedicated secret scanner or
 * repository security controls.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • Node.js standard library
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Integrate a dedicated secret scanner in CI when the repository is published
 *
 * =============================================================================
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { cwd, exitCode } from "node:process";

const ROOT = cwd();
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", ".test-build"]);
const BLOCKED_FILENAMES = [/^\.env(?:\..+)?$/, /^id_rsa$/, /^id_ed25519$/];
const IGNORED_FILES = new Set(["scripts/check-secrets.mjs"]);
const PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...(await walk(path)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const findings = [];
const files = await walk(ROOT);

for (const path of files) {
  const name = basename(path);
  const displayPath = relative(ROOT, path);

  if (IGNORED_FILES.has(displayPath)) {
    continue;
  }

  if (BLOCKED_FILENAMES.some((pattern) => pattern.test(name))) {
    findings.push(`${displayPath}: blocked secret-bearing filename`);
    continue;
  }

  const content = await readFile(path, "utf8").catch(() => null);
  if (content === null) {
    continue;
  }

  for (const pattern of PATTERNS) {
    if (pattern.test(content)) {
      findings.push(`${displayPath}: suspicious credential material`);
      break;
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secret material detected:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log("Secret hygiene check passed.");
}
