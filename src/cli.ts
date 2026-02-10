#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { traceReferences } from "./lib/trace.js";
import { pack } from "./lib/pack.js";

function usage() {
  console.log(`
skillpack - Pack Claude skills from markdown references

Usage:
  skillpack <SKILL.md> [options]

Options:
  -o, --output <path>   Output path (default: <name>.skill)
  -l, --list            List files that would be included (dry run)
  -v, --verbose         Verbose output
  -h, --help            Show this help

Examples:
  skillpack ./SKILL.md
  skillpack ./SKILL.md -o dist/my-framework.skill
  skillpack ./SKILL.md --list
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    usage();
    process.exit(0);
  }

  let skillPath: string | undefined;
  let outputPath: string | undefined;
  let listOnly = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputPath = args[++i];
    } else if (arg === "-l" || arg === "--list") {
      listOnly = true;
    } else if (arg === "-v" || arg === "--verbose") {
      verbose = true;
    } else if (!arg.startsWith("-")) {
      skillPath = arg;
    }
  }

  if (!skillPath) {
    console.error("Error: No SKILL.md path provided");
    usage();
    process.exit(1);
  }

  if (!fs.existsSync(skillPath)) {
    console.error(`Error: File not found: ${skillPath}`);
    process.exit(1);
  }

  // Derive output path from skill location if not specified
  if (!outputPath) {
    const dir = path.dirname(path.resolve(skillPath));
    const name = path.basename(dir) || "skill";
    outputPath = `${name}.skill`;
  }

  console.log(`Tracing references from ${skillPath}...`);

  const result = traceReferences(skillPath, verbose);

  if (result.errors.length > 0) {
    console.error("\nWarnings:");
    for (const error of result.errors) {
      console.error(`  ! ${error}`);
    }
  }

  const rootDir = path.dirname(path.resolve(skillPath));
  const relativePaths = [...result.files].map((f) =>
    path.relative(rootDir, f)
  );

  if (listOnly) {
    console.log(`\nFiles to include (${result.files.size}):`);
    for (const rel of relativePaths.sort()) {
      console.log(`  ${rel}`);
    }
    return;
  }

  console.log(`\nPacking ${result.files.size} files...`);

  await pack({
    files: result.files,
    skillPath,
    outputPath,
    verbose,
  });

  console.log(`\nDone! Created ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
