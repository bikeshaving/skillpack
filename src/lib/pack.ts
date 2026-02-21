import archiver from "archiver";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Category } from "./trace.js";
import { rewriteSkillContent } from "./rewrite.js";

export interface PackOptions {
  files: Set<string>;
  skillPath: string;
  outputPath: string;
  verbose?: boolean;
  categories?: Map<string, Category>;
}

const STANDARD_FIELDS = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "compatibility",
  "metadata",
]);

/**
 * Validate that SKILL.md frontmatter contains only standard fields.
 * Throws if non-standard keys are found.
 */
export function validateFrontmatter(content: string): void {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return;

  const yaml = match[1];
  const lines = yaml.split("\n");
  const invalid: string[] = [];

  for (const line of lines) {
    const keyMatch = line.match(/^([a-z][\w-]*):/);
    if (keyMatch && !STANDARD_FIELDS.has(keyMatch[1])) {
      invalid.push(keyMatch[1]);
    }
  }

  if (invalid.length > 0) {
    throw new Error(
      `SKILL.md contains non-standard frontmatter fields: ${invalid.join(", ")}\n` +
        `Valid fields: ${[...STANDARD_FIELDS].join(", ")}`
    );
  }
}

/**
 * Extract the name field from SKILL.md frontmatter.
 * Throws if frontmatter or name field is missing.
 */
export function extractName(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error("SKILL.md is missing frontmatter");
  }

  for (const line of match[1].split("\n")) {
    const m = line.match(/^name:\s*(.+)/);
    if (m) return m[1].trim();
  }

  throw new Error("SKILL.md frontmatter is missing required 'name' field");
}

/**
 * Pack files into a .skill archive (zip with .skill extension)
 */
export async function pack(options: PackOptions): Promise<void> {
  const { files, skillPath, outputPath, verbose } = options;

  const rootDir = path.dirname(path.resolve(skillPath));
  const absoluteSkillPath = path.resolve(skillPath);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      if (verbose) {
        console.log(`\nPacked ${archive.pointer()} bytes to ${outputPath}`);
      }
      resolve();
    });

    archive.on("error", reject);
    archive.pipe(output);

    for (const file of files) {
      const relativePath = path.relative(rootDir, file);
      if (verbose) {
        console.log(`  packing: ${relativePath}`);
      }

      if (path.resolve(file) === absoluteSkillPath) {
        const content = fs.readFileSync(file, "utf-8");
        validateFrontmatter(content);
        archive.append(content, { name: relativePath });
      } else {
        archive.file(file, { name: relativePath });
      }
    }

    archive.finalize();
  });
}

/**
 * Pack files into a directory, preserving relative paths
 */
export async function packPreserve(options: PackOptions): Promise<void> {
  const { files, skillPath, outputPath, verbose } = options;

  const rootDir = path.dirname(path.resolve(skillPath));
  const absoluteSkillPath = path.resolve(skillPath);

  fs.mkdirSync(outputPath, { recursive: true });

  let count = 0;
  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    const destPath = path.join(outputPath, relativePath);

    if (verbose) {
      console.log(`  copying: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    if (path.resolve(file) === absoluteSkillPath) {
      const content = fs.readFileSync(file, "utf-8");
      validateFrontmatter(content);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(file, destPath);
    }
    count++;
  }

  if (verbose) {
    console.log(`\nCopied ${count} files to ${outputPath}`);
  }
}

/**
 * Pack files into a flat directory with scripts/references/assets subdirs
 */
export async function packFlat(options: PackOptions): Promise<void> {
  const { files, skillPath, outputPath, verbose, categories } = options;

  if (!categories) {
    throw new Error("categories required for flat format");
  }

  const rootDir = path.dirname(path.resolve(skillPath));
  const absoluteSkillPath = path.resolve(skillPath);

  // Build path map: original relative path → flat path (e.g., "docs/api.md" → "references/api.md")
  const pathMap = new Map<string, string>();
  const destinations = new Map<string, string[]>(); // dest → [source paths] for collision detection

  for (const file of files) {
    if (file === absoluteSkillPath) continue;

    const relPath = path.relative(rootDir, file);
    const category = categories.get(file);
    if (!category) continue;

    const basename = path.basename(file);
    const dest = `${category}/${basename}`;

    const existing = destinations.get(dest);
    if (existing) {
      existing.push(relPath);
    } else {
      destinations.set(dest, [relPath]);
    }

    pathMap.set(relPath, dest);
  }

  // Check for collisions
  const collisions: string[] = [];
  for (const [dest, sources] of destinations) {
    if (sources.length > 1) {
      collisions.push(`  ${dest} ← ${sources.join(", ")}`);
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `Flat format collision — multiple files map to the same destination:\n${collisions.join("\n")}`
    );
  }

  // Create output directory
  fs.mkdirSync(outputPath, { recursive: true });

  // Write SKILL.md with rewritten paths
  const skillContent = fs.readFileSync(absoluteSkillPath, "utf-8");
  validateFrontmatter(skillContent);
  const rewritten = rewriteSkillContent(skillContent, pathMap);
  fs.writeFileSync(path.join(outputPath, "SKILL.md"), rewritten);
  if (verbose) {
    console.log("  copying: SKILL.md");
  }

  // Copy files to flat layout
  let count = 1; // count SKILL.md
  for (const file of files) {
    if (file === absoluteSkillPath) continue;

    const relPath = path.relative(rootDir, file);
    const dest = pathMap.get(relPath);
    if (!dest) continue;

    const destPath = path.join(outputPath, dest);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(file, destPath);
    count++;

    if (verbose) {
      console.log(`  copying: ${relPath} → ${dest}`);
    }
  }

  if (verbose) {
    console.log(`\nCopied ${count} files to ${outputPath}`);
  }
}

/**
 * Pack files into both a .skill archive and a flat directory.
 * Output dir gets <name>.skill and <name>/ based on frontmatter name.
 */
export async function packDist(options: PackOptions): Promise<void> {
  const { files, skillPath, outputPath, verbose, categories } = options;

  const absoluteSkillPath = path.resolve(skillPath);
  const content = fs.readFileSync(absoluteSkillPath, "utf-8");
  const name = extractName(content);

  const flatDir = path.join(outputPath, name);

  // Clean stale flat directory
  if (fs.existsSync(flatDir)) {
    fs.rmSync(flatDir, { recursive: true });
  }

  fs.mkdirSync(outputPath, { recursive: true });

  const skillOutput = path.join(outputPath, `${name}.skill`);

  await pack({ files, skillPath, outputPath: skillOutput, verbose });
  await packFlat({ files, skillPath, outputPath: flatDir, verbose, categories });
}
