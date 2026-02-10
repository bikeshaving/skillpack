# skillpack

**Build [Agent Skills](https://agentskills.io) from your existing docs.**

The Agent Skills spec wants self-contained directories. But your docs, examples, and source already exist in your repo. Skillpack traces markdown references recursively and packages only what's needed into a `.skill` archive.

```bash
npx @b9g/skillpack ./SKILL.md
```

## How It Works

Write a `SKILL.md` that points into your repo:

```yaml
---
name: my-framework
description: My framework for building things.
references:
  - docs/
  - examples/todo-app/
---

# My Framework

See [Getting Started](./docs/getting-started.md) for installation.
See [API Reference](./docs/api.md) for details.
```

Skillpack traces three kinds of references:

1. **Markdown links** — `[API docs](./docs/api.md)`
2. **Code block annotations** — `` ```ts file=src/types.ts ``\`
3. **Frontmatter references** — `references: [docs/, examples/]`

Tracing is recursive. If `api.md` links to `advanced.md`, and `advanced.md` annotates `types.ts`, all three are included. Directory references include everything inside them.

```bash
$ skillpack ./SKILL.md --list
Files to include (6):
  SKILL.md
  docs/getting-started.md
  docs/api.md
  docs/advanced.md
  src/types.ts
  examples/todo-app/index.tsx
```

The output is a `.skill` zip archive with paths preserved relative to the `SKILL.md` location.

## Usage

```bash
# Pack a skill
skillpack ./SKILL.md

# Custom output path
skillpack ./SKILL.md -o dist/my-framework.skill

# Dry run
skillpack ./SKILL.md --list

# Verbose
skillpack ./SKILL.md -v
```

## License

MIT
