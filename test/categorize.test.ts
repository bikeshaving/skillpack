import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { categorizeFiles } from "../src/lib/trace.js";

describe("categorizeFiles", () => {
  let tmpDir: string;
  let textFile: string;
  let execFile: string;
  let binaryFile: string;
  let skillFile: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillpack-test-"));

    // Plain text file
    textFile = path.join(tmpDir, "readme.md");
    fs.writeFileSync(textFile, "# Hello\n");

    // Executable script
    execFile = path.join(tmpDir, "run.sh");
    fs.writeFileSync(execFile, "#!/bin/bash\necho hi\n");
    fs.chmodSync(execFile, 0o755);

    // Binary file (PNG header)
    binaryFile = path.join(tmpDir, "image.png");
    fs.writeFileSync(binaryFile, Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00,
    ]));

    // SKILL.md (should be excluded)
    skillFile = path.join(tmpDir, "SKILL.md");
    fs.writeFileSync(skillFile, "---\nname: test\n---\n# Skill\n");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("categorizes text files as references", () => {
    const files = new Set([skillFile, textFile]);
    const categories = categorizeFiles(files, skillFile);
    expect(categories.get(textFile)).toBe("references");
  });

  test("categorizes executable files as scripts", () => {
    const files = new Set([skillFile, execFile]);
    const categories = categorizeFiles(files, skillFile);
    expect(categories.get(execFile)).toBe("scripts");
  });

  test("categorizes binary files as assets", () => {
    const files = new Set([skillFile, binaryFile]);
    const categories = categorizeFiles(files, skillFile);
    expect(categories.get(binaryFile)).toBe("assets");
  });

  test("excludes SKILL.md from categories", () => {
    const files = new Set([skillFile, textFile]);
    const categories = categorizeFiles(files, skillFile);
    expect(categories.has(skillFile)).toBe(false);
  });

  test("returns empty map for no files besides SKILL.md", () => {
    const files = new Set([skillFile]);
    const categories = categorizeFiles(files, skillFile);
    expect(categories.size).toBe(0);
  });

  test("executable bit takes priority over text", () => {
    // Create a text file with executable bit
    const execText = path.join(tmpDir, "script.js");
    fs.writeFileSync(execText, "console.log('hi');\n");
    fs.chmodSync(execText, 0o755);

    const files = new Set([skillFile, execText]);
    const categories = categorizeFiles(files, skillFile);
    expect(categories.get(execText)).toBe("scripts");

    fs.unlinkSync(execText);
  });
});
