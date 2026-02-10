# skillpack

Pack Claude skills from markdown files that reference your existing codebase.

## The Problem

The [Agent Skills spec](https://agentskills.io) assumes skills are self-contained directories. You copy docs into `references/`, scripts into `scripts/`, and ship the folder.

But for framework authors, that's backwards. The docs already exist. The examples already exist. You don't want to maintain a duplicate copy that drifts.

## The Solution

`skillpack` lets you write a `SKILL.md` that *points into* your existing repo structure. It traces markdown references recursively and packages only what's needed.

```
my-framework/
├── SKILL.md              # References docs and examples
├── docs/
│   ├── getting-started.md
│   ├── api.md            # References src/types.ts
│   └── advanced.md
├── src/
│   └── types.ts
└── examples/
    └── todo-app/
        └── index.tsx
```

Run `skillpack` and get a `.skill` file containing just the referenced files, with paths preserved.

## Installation

```bash
npm install -g skillpack
```

Or use directly:

```bash
npx skillpack ./SKILL.md
```

## Usage

```bash
# Pack a skill (outputs <dirname>.skill)
skillpack ./SKILL.md

# Custom output path
skillpack ./SKILL.md -o dist/my-framework.skill

# List files that would be included (dry run)
skillpack ./SKILL.md --list

# Verbose output
skillpack ./SKILL.md -v
```

## How References Work

`skillpack` traces three types of references in markdown:

### 1. Markdown links

```markdown
See [the API docs](./docs/api.md) for details.
```

### 2. Code block file annotations

~~~markdown
```typescript file=src/types.ts
```
~~~

### 3. Frontmatter references

```yaml
---
references:
  - docs/getting-started.md
  - examples/todo-app/
---
```

References are traced recursively. If `api.md` links to `advanced.md`, and `advanced.md` has a `file=` annotation pointing to `types.ts`, all three are included.

Directory references include everything inside them.

## Output Format

The output is a `.skill` file (a zip archive) compatible with the Agent Skills spec:

```
my-framework.skill
├── SKILL.md
├── docs/
│   ├── getting-started.md
│   ├── api.md
│   └── advanced.md
├── src/
│   └── types.ts
└── examples/
    └── todo-app/
        └── index.tsx
```

Paths are preserved relative to the SKILL.md location.

## Example: Packaging Crank.js

```bash
# In the crank repo root
cat > SKILL.md << 'EOF'
---
name: crankjs
description: Crank.js - The Just JavaScript Framework
references:
  - docs/
  - src/crank.ts
  - examples/todo-mvc/
---

# Crank.js

Crank is a JavaScript framework for building reactive components using
generators and promises.

See [Getting Started](./docs/getting-started.md) for installation.
EOF

skillpack ./SKILL.md -o crank.skill
```

## Programmatic API

```typescript
import { traceReferences, pack } from "skillpack";

const result = traceReferences("./SKILL.md", true);
console.log("Files:", result.files);
console.log("Errors:", result.errors);

await pack({
  files: result.files,
  skillPath: "./SKILL.md",
  outputPath: "output.skill",
});
```

## License

MIT
