import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { traceReferences } from "../src/lib/trace.js";
import { pack, packFlat, packPreserve } from "../src/lib/pack.js";

const FIXTURE = path.join(import.meta.dir, "fixture");
const SKILL_PATH = path.join(FIXTURE, "SKILL.md");

describe("e2e", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillpack-e2e-"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  describe("traceReferences", () => {
    test("discovers all linked files", () => {
      const result = traceReferences(SKILL_PATH);
      const relPaths = [...result.files]
        .map((f) => path.relative(FIXTURE, f))
        .sort();

      expect(relPaths).toEqual([
        "SKILL.md",
        "docs/api.md",
        "img/logo.png",
        "src/build.sh",
        "src/helper.ts",
        "src/utils.ts",
      ]);
    });

    test("follows transitive references", () => {
      // docs/api.md links to ../src/utils.ts — trace should pick it up
      const result = traceReferences(SKILL_PATH);
      const relPaths = [...result.files].map((f) => path.relative(FIXTURE, f));
      expect(relPaths).toContain("src/utils.ts");
    });

    test("categorizes files correctly", () => {
      const result = traceReferences(SKILL_PATH);
      const cats = new Map(
        [...result.categories].map(([f, c]) => [path.relative(FIXTURE, f), c])
      );

      expect(cats.get("src/build.sh")).toBe("scripts");
      expect(cats.get("img/logo.png")).toBe("assets");
      expect(cats.get("docs/api.md")).toBe("references");
      expect(cats.get("src/helper.ts")).toBe("references");
      expect(cats.get("src/utils.ts")).toBe("references");
      expect(cats.has("SKILL.md")).toBe(false);
    });

    test("reports no errors for valid fixture", () => {
      const result = traceReferences(SKILL_PATH);
      expect(result.errors).toEqual([]);
    });
  });

  describe("pack (skill/zip)", () => {
    test("creates a .skill archive", async () => {
      const result = traceReferences(SKILL_PATH);
      const out = path.join(tmpDir, "test.skill");

      await pack({
        files: result.files,
        skillPath: SKILL_PATH,
        outputPath: out,
        categories: result.categories,
      });

      expect(fs.existsSync(out)).toBe(true);
      expect(fs.statSync(out).size).toBeGreaterThan(0);
    });
  });

  describe("packPreserve", () => {
    test("preserves directory structure", async () => {
      const result = traceReferences(SKILL_PATH);
      const out = path.join(tmpDir, "preserve");

      await packPreserve({
        files: result.files,
        skillPath: SKILL_PATH,
        outputPath: out,
        categories: result.categories,
      });

      expect(fs.existsSync(path.join(out, "SKILL.md"))).toBe(true);
      expect(fs.existsSync(path.join(out, "docs/api.md"))).toBe(true);
      expect(fs.existsSync(path.join(out, "src/helper.ts"))).toBe(true);
      expect(fs.existsSync(path.join(out, "src/build.sh"))).toBe(true);
      expect(fs.existsSync(path.join(out, "img/logo.png"))).toBe(true);
    });

    test("SKILL.md content is unchanged", async () => {
      const result = traceReferences(SKILL_PATH);
      const out = path.join(tmpDir, "preserve-content");

      await packPreserve({
        files: result.files,
        skillPath: SKILL_PATH,
        outputPath: out,
        categories: result.categories,
      });

      const original = fs.readFileSync(SKILL_PATH, "utf-8");
      const copied = fs.readFileSync(path.join(out, "SKILL.md"), "utf-8");
      expect(copied).toBe(original);
    });
  });

  describe("packFlat", () => {
    let out: string;
    let result: ReturnType<typeof traceReferences>;

    beforeAll(async () => {
      result = traceReferences(SKILL_PATH);
      out = path.join(tmpDir, "flat");

      await packFlat({
        files: result.files,
        skillPath: SKILL_PATH,
        outputPath: out,
        categories: result.categories,
      });
    });

    test("puts SKILL.md at root", () => {
      expect(fs.existsSync(path.join(out, "SKILL.md"))).toBe(true);
    });

    test("puts executable in scripts/", () => {
      expect(fs.existsSync(path.join(out, "scripts/build.sh"))).toBe(true);
    });

    test("puts binary in assets/", () => {
      expect(fs.existsSync(path.join(out, "assets/logo.png"))).toBe(true);
    });

    test("puts text files in references/", () => {
      expect(fs.existsSync(path.join(out, "references/api.md"))).toBe(true);
      expect(fs.existsSync(path.join(out, "references/helper.ts"))).toBe(true);
      expect(fs.existsSync(path.join(out, "references/utils.ts"))).toBe(true);
    });

    test("no original subdirectories remain", () => {
      expect(fs.existsSync(path.join(out, "docs"))).toBe(false);
      expect(fs.existsSync(path.join(out, "src"))).toBe(false);
      expect(fs.existsSync(path.join(out, "img"))).toBe(false);
    });

    test("rewrites markdown links in SKILL.md", () => {
      const content = fs.readFileSync(path.join(out, "SKILL.md"), "utf-8");

      expect(content).toContain("[API reference](references/api.md)");
      expect(content).toContain("[helper source](references/helper.ts)");
      expect(content).toContain("[build script](scripts/build.sh)");
      expect(content).toContain("[logo](assets/logo.png)");
      expect(content).not.toContain("docs/api.md");
      expect(content).not.toContain("src/helper.ts");
      expect(content).not.toContain("src/build.sh");
      expect(content).not.toContain("img/logo.png");
    });

    test("preserves frontmatter", () => {
      const content = fs.readFileSync(path.join(out, "SKILL.md"), "utf-8");
      expect(content).toContain("name: test-skill");
      expect(content).toContain("description: A fixture for end-to-end testing");
    });
  });

  describe("frontmatter validation", () => {
    test("rejects non-standard frontmatter fields", async () => {
      // Create a temp SKILL.md with a bad field
      const badDir = path.join(tmpDir, "bad-frontmatter");
      fs.mkdirSync(badDir, { recursive: true });
      const badSkill = path.join(badDir, "SKILL.md");
      fs.writeFileSync(
        badSkill,
        "---\nname: bad\nreferences:\n  - foo.md\n---\n# Bad\n"
      );

      const result = traceReferences(badSkill);
      const out = path.join(tmpDir, "bad-out");

      await expect(
        pack({
          files: result.files,
          skillPath: badSkill,
          outputPath: out + ".skill",
          categories: result.categories,
        })
      ).rejects.toThrow("non-standard frontmatter fields: references");
    });
  });

  describe("flat collision detection", () => {
    test("errors when two files flatten to the same destination", async () => {
      // Create a fixture with collision: docs/README.md and examples/README.md
      const collisionDir = path.join(tmpDir, "collision-fixture");
      fs.mkdirSync(path.join(collisionDir, "docs"), { recursive: true });
      fs.mkdirSync(path.join(collisionDir, "examples"), { recursive: true });

      const skillPath = path.join(collisionDir, "SKILL.md");
      fs.writeFileSync(
        skillPath,
        "---\nname: collide\n---\n# Collide\n\n[a](docs/README.md) and [b](examples/README.md)\n"
      );
      fs.writeFileSync(path.join(collisionDir, "docs/README.md"), "# Docs\n");
      fs.writeFileSync(path.join(collisionDir, "examples/README.md"), "# Examples\n");

      const result = traceReferences(skillPath);
      const out = path.join(tmpDir, "collision-out");

      await expect(
        packFlat({
          files: result.files,
          skillPath,
          outputPath: out,
          categories: result.categories,
        })
      ).rejects.toThrow("collision");
    });
  });
});
