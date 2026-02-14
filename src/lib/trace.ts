import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { Lexer, type Token, type Tokens } from "marked";

export type Category = "scripts" | "references" | "assets";

export interface TraceResult {
  files: Set<string>;
  errors: string[];
  categories: Map<string, Category>;
}

/**
 * Extract file references from markdown content.
 * Handles: markdown links and code block file= annotations.
 */
function extractReferences(content: string, basePath: string): string[] {
  const refs: string[] = [];
  const lexer = new Lexer();
  const tokens = lexer.lex(content);

  // Walk tokens for links and code blocks
  function walkTokens(tokens: Token[]) {
    for (const token of tokens) {
      if (token.type === "link") {
        const link = token as Tokens.Link;
        // Only local file references
        if (
          link.href &&
          !link.href.startsWith("http") &&
          !link.href.startsWith("#")
        ) {
          refs.push(link.href.split("#")[0]); // Remove anchor
        }
      }

      if (token.type === "code") {
        const code = token as Tokens.Code;
        // Check for file= in lang string: ```ts file=src/foo.ts
        const fileMatch = code.lang?.match(/file=([^\s]+)/);
        if (fileMatch) {
          refs.push(fileMatch[1]);
        }
      }

      // Recurse into nested tokens
      if ("tokens" in token && Array.isArray(token.tokens)) {
        walkTokens(token.tokens);
      }
      if ("items" in token && Array.isArray(token.items)) {
        for (const item of token.items) {
          if ("tokens" in item && Array.isArray(item.tokens)) {
            walkTokens(item.tokens);
          }
        }
      }
    }
  }

  walkTokens(tokens);

  // Resolve paths relative to the file's directory
  return refs
    .map((ref) => path.resolve(basePath, ref))
    .filter((ref) => ref.length > 0);
}

/**
 * Recursively trace all file references starting from a SKILL.md
 */
export function traceReferences(
  skillPath: string,
  verbose = false
): TraceResult {
  const files = new Set<string>();
  const errors: string[] = [];
  const visited = new Set<string>();

  const absoluteSkillPath = path.resolve(skillPath);
  const rootDir = path.dirname(absoluteSkillPath);

  function trace(filePath: string) {
    const absolute = path.resolve(filePath);

    if (visited.has(absolute)) return;
    visited.add(absolute);

    // Check if path exists
    if (!fs.existsSync(absolute)) {
      errors.push(`Reference not found: ${filePath}`);
      return;
    }

    const stat = fs.statSync(absolute);

    if (stat.isDirectory()) {
      // Add all files in directory recursively
      const entries = fs.readdirSync(absolute, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(absolute, entry.name);
        if (entry.isDirectory()) {
          trace(entryPath);
        } else {
          files.add(entryPath);
          if (verbose)
            console.log(`  + ${path.relative(rootDir, entryPath)}`);
          // Trace markdown files for more references
          if (entry.name.endsWith(".md")) {
            const content = fs.readFileSync(entryPath, "utf-8");
            const refs = extractReferences(content, path.dirname(entryPath));
            for (const ref of refs) {
              trace(ref);
            }
          }
        }
      }
    } else {
      files.add(absolute);
      if (verbose) console.log(`  + ${path.relative(rootDir, absolute)}`);

      // Trace markdown files for more references
      if (absolute.endsWith(".md")) {
        const content = fs.readFileSync(absolute, "utf-8");
        const refs = extractReferences(content, path.dirname(absolute));
        for (const ref of refs) {
          trace(ref);
        }
      }
    }
  }

  // Start from the skill file itself
  trace(absoluteSkillPath);

  // Categorize all files except SKILL.md
  const categories = categorizeFiles(files, absoluteSkillPath);

  return { files, errors, categories };
}

/**
 * Categorize traced files into scripts/references/assets.
 * Priority: executable → scripts, binary → assets, text → references.
 */
function categorizeFiles(
  files: Set<string>,
  skillPath: string
): Map<string, Category> {
  const categories = new Map<string, Category>();
  const toCheck = [...files].filter((f) => f !== skillPath);

  if (toCheck.length === 0) return categories;

  // Batch binary detection
  const mimeOutput = execFileSync(
    "file",
    ["--mime-encoding", "-b", ...toCheck],
    { encoding: "utf-8" }
  );
  const mimeLines = mimeOutput.trimEnd().split("\n");

  for (let i = 0; i < toCheck.length; i++) {
    const file = toCheck[i];
    const stat = fs.statSync(file);

    if (stat.mode & 0o111) {
      categories.set(file, "scripts");
    } else if (mimeLines[i] === "binary") {
      categories.set(file, "assets");
    } else {
      categories.set(file, "references");
    }
  }

  return categories;
}
