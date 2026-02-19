import { describe, expect, test } from "bun:test";
import { rewriteSkillContent } from "../src/lib/rewrite.js";

describe("rewriteSkillContent", () => {
  test("rewrites markdown links", () => {
    const pathMap = new Map([["docs/api.md", "references/api.md"]]);
    const input = "See [the API](docs/api.md) for details.";
    const result = rewriteSkillContent(input, pathMap);
    expect(result).toBe("See [the API](references/api.md) for details.");
  });

  test("rewrites links with ./ prefix", () => {
    const pathMap = new Map([["docs/api.md", "references/api.md"]]);
    const input = "See [the API](./docs/api.md) for details.";
    const result = rewriteSkillContent(input, pathMap);
    expect(result).toBe("See [the API](references/api.md) for details.");
  });

  test("preserves URL fragments", () => {
    const pathMap = new Map([["docs/api.md", "references/api.md"]]);
    const input = "See [section](docs/api.md#auth) for details.";
    const result = rewriteSkillContent(input, pathMap);
    expect(result).toBe("See [section](references/api.md#auth) for details.");
  });

  test("leaves external URLs unchanged", () => {
    const pathMap = new Map([["docs/api.md", "references/api.md"]]);
    const input = "Visit [site](https://example.com) and [docs](http://docs.com).";
    const result = rewriteSkillContent(input, pathMap);
    expect(result).toBe("Visit [site](https://example.com) and [docs](http://docs.com).");
  });

  test("leaves anchor-only links unchanged", () => {
    const pathMap = new Map([["docs/api.md", "references/api.md"]]);
    const input = "See [above](#introduction).";
    const result = rewriteSkillContent(input, pathMap);
    expect(result).toBe("See [above](#introduction).");
  });

  test("leaves unmatched paths unchanged", () => {
    const pathMap = new Map([["docs/api.md", "references/api.md"]]);
    const input = "See [other](unknown/file.md).";
    const result = rewriteSkillContent(input, pathMap);
    expect(result).toBe("See [other](unknown/file.md).");
  });

  test("handles multiple rewrites in one document", () => {
    const pathMap = new Map([
      ["docs/api.md", "references/api.md"],
      ["src/main.ts", "references/main.ts"],
    ]);
    const input = [
      "# My Skill",
      "",
      "See [API docs](docs/api.md) and [source](src/main.ts).",
    ].join("\n");

    const result = rewriteSkillContent(input, pathMap);

    expect(result).toContain("[API docs](references/api.md)");
    expect(result).toContain("[source](references/main.ts)");
  });
});
