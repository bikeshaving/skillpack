import archiver from "archiver";
import * as fs from "node:fs";
import * as path from "node:path";

export interface PackOptions {
  files: Set<string>;
  skillPath: string;
  outputPath: string;
  verbose?: boolean;
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
 * Strip non-standard frontmatter keys from SKILL.md content.
 * Claude.ai only accepts: name, description, license, allowed-tools, compatibility, metadata.
 */
function sanitizeFrontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return content;

  const yaml = match[1];
  const lines = yaml.split("\n");
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    // Top-level key: no leading whitespace, has a colon
    const keyMatch = line.match(/^([a-z][\w-]*):/);
    if (keyMatch) {
      if (STANDARD_FIELDS.has(keyMatch[1])) {
        skipping = false;
        kept.push(line);
      } else {
        skipping = true;
      }
    } else if (!skipping) {
      // Continuation line (indented) of a kept key
      kept.push(line);
    }
  }

  return `---\n${kept.join("\n")}\n---${content.slice(match[0].length)}`;
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

      // Sanitize SKILL.md frontmatter to remove non-standard fields
      if (path.resolve(file) === absoluteSkillPath) {
        const content = fs.readFileSync(file, "utf-8");
        archive.append(sanitizeFrontmatter(content), { name: relativePath });
      } else {
        archive.file(file, { name: relativePath });
      }
    }

    archive.finalize();
  });
}
