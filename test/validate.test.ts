import { describe, expect, test } from "bun:test";
import { validateFrontmatter, extractName } from "../src/lib/pack.js";

describe("validateFrontmatter", () => {
  test("accepts content with no frontmatter", () => {
    expect(() => validateFrontmatter("# Hello\n\nSome content.")).not.toThrow();
  });

  test("accepts all standard fields", () => {
    const content = [
      "---",
      "name: my-skill",
      "description: A test skill",
      "license: MIT",
      "allowed-tools: tool1, tool2",
      "compatibility: claude-4",
      "metadata:",
      "  key: value",
      "---",
      "# Content",
    ].join("\n");
    expect(() => validateFrontmatter(content)).not.toThrow();
  });

  test("throws on non-standard field", () => {
    const content = [
      "---",
      "name: my-skill",
      "references:",
      "  - file1.md",
      "---",
      "# Content",
    ].join("\n");
    expect(() => validateFrontmatter(content)).toThrow("non-standard frontmatter fields: references");
  });

  test("throws listing multiple invalid fields", () => {
    const content = [
      "---",
      "name: my-skill",
      "references:",
      "  - file1.md",
      "tags: foo",
      "---",
      "# Content",
    ].join("\n");
    expect(() => validateFrontmatter(content)).toThrow("references, tags");
  });

  test("error message includes valid fields", () => {
    const content = "---\nbadfield: value\n---\n# Content";
    expect(() => validateFrontmatter(content)).toThrow("Valid fields:");
  });

  test("accepts empty frontmatter", () => {
    const content = "---\n---\n# Content";
    expect(() => validateFrontmatter(content)).not.toThrow();
  });
});

describe("extractName", () => {
  test("extracts name from frontmatter", () => {
    const content = "---\nname: my-skill\ndescription: test\n---\n# Content";
    expect(extractName(content)).toBe("my-skill");
  });

  test("throws if no frontmatter", () => {
    expect(() => extractName("# No frontmatter")).toThrow("missing frontmatter");
  });

  test("throws if name field is missing", () => {
    const content = "---\ndescription: test\n---\n# Content";
    expect(() => extractName(content)).toThrow("missing required 'name' field");
  });
});
