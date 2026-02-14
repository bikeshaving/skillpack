#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { traceReferences } from "./lib/trace.js";
import { pack, packFlat, packPreserve } from "./lib/pack.js";

function usage() {
  console.log(`
skillpack - Pack Claude skills from markdown references

Usage:
  skillpack <SKILL.md> [options]

Options:
  -o, --output <path>   Output path (default: <name>.skill)
  -f, --format <type>   Output format: skill (zip, default), flat, or preserve
  -l, --list            List files that would be included (dry run)
  -v, --verbose         Verbose output
  -h, --help            Show this help

Formats:
  skill      .skill zip archive (default)
  flat       Flat layout with scripts/ references/ assets/ subdirs
  preserve   Directory with original paths preserved

Examples:
  skillpack ./SKILL.md
  skillpack ./SKILL.md -o dist/my-framework.skill
  skillpack ./SKILL.md --format flat -o dist/my-skill/
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
  let format: "skill" | "flat" | "preserve" = "skill";
  let listOnly = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputPath = args[++i];
    } else if (arg === "-f" || arg === "--format") {
      const val = args[++i];
      if (val !== "skill" && val !== "flat" && val !== "preserve" && val !== "dir") {
        console.error(
          `Error: Invalid format "${val}". Use "skill", "flat", or "preserve".`
        );
        process.exit(1);
      }
      format = val === "dir" ? "preserve" : val;
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
    if (format === "skill") {
      outputPath = `${name}.skill`;
    } else {
      outputPath = `${name}/`;
    }
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

  const packOptions = {
    files: result.files,
    skillPath,
    outputPath,
    verbose,
    categories: result.categories,
  };

  if (format === "flat") {
    await packFlat(packOptions);
  } else if (format === "preserve") {
    await packPreserve(packOptions);
  } else {
    await pack(packOptions);
  }

  console.log(`\nDone! Created ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
