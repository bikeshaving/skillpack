import * as fs from "node:fs";
import * as path from "node:path";
import { Lexer, type Token, type Tokens } from "marked";

export interface TraceResult {
  files: Set<string>;
  errors: string[];
}

/**
 * Extract file references from markdown content.
 * Handles: markdown links, code block file= annotations, and frontmatter references.
 */
function extractReferences(content: string, basePath: string): string[] {
  const refs: string[] = [];
  const lexer = new Lexer();
  const tokens = lexer.lex(content);

  // Parse frontmatter for references array
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    // Simple YAML parsing for references array
    const refsMatch = yaml.match(/references:\s*\n((?:\s+-\s+.+\n?)*)/);
    if (refsMatch) {
      const lines = refsMatch[1].split("\n");
      for (const line of lines) {
        const match = line.match(/^\s+-\s+(.+)/);
        if (match) {
          refs.push(match[1].trim());
        }
      }
    }
  }

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

  return { files, errors };
}
