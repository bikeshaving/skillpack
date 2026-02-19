# skillpack

**Build [Agent Skills](https://agentskills.io) from your existing docs.**

The Agent Skills spec wants self-contained directories. But your docs, examples, and source already exist in your repo. Skillpack traces markdown references recursively and packages only what's needed into a `.skill` archive.

```bash
npx @b9g/skillpack ./SKILL.md
```

## How It Works

Write a `SKILL.md` that points into your repo:

```markdown
---
name: my-framework
description: My framework for building things.
---

# My Framework

See [Getting Started](./docs/getting-started.md) for installation.
See [API Reference](./docs/api.md) for details.
```

Skillpack traces **markdown links** — `[API docs](./docs/api.md)` — recursively. If `api.md` links to `advanced.md`, both are included. Directory links include everything inside them.

```bash
$ skillpack ./SKILL.md --list
Files to include (3):
  SKILL.md
  docs/getting-started.md
  docs/api.md
```

The default output is a `.skill` zip archive with paths preserved relative to the `SKILL.md` location.

## Usage

```bash
# Pack a skill (default: .skill zip archive)
skillpack ./SKILL.md

# Custom output path
skillpack ./SKILL.md -o dist/my-framework.skill

# Flat layout (scripts/ references/ assets/ subdirs)
skillpack ./SKILL.md --format flat -o dist/my-skill/

# Preserve original directory structure
skillpack ./SKILL.md --format preserve -o dist/my-skill/

# Dry run
skillpack ./SKILL.md --list

# Verbose
skillpack ./SKILL.md -v
```

## License

MIT
