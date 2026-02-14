import { describe, expect, test } from "bun:test";
import { validateFrontmatter } from "../src/lib/pack.js";

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
