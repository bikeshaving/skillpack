# Changelog

## 0.1.4

- Remove code block `file=` annotation tracing and rewriting (terrible AI-driven feature that duplicated what markdown links already do)
- Fix incorrect README documentation

## 0.1.3

- Add `--format flat` output: files categorized into `scripts/`, `references/`, `assets/` with automatic detection (executable bit, binary, text)
- Rename `--format dir` to `--format preserve` (`dir` kept as alias)
- Validate SKILL.md frontmatter instead of silently stripping non-standard fields
- Remove frontmatter `references:` parsing from tracer (not part of Agent Skills spec)
- Rewrite markdown links and code block `file=` annotations for flat format
- Detect and error on filename collisions in flat format
- Add unit and end-to-end tests

## 0.1.2

- Strip non-standard frontmatter fields from packed SKILL.md

## 0.1.1

- Add `skillpack` CLI binary
- Switch to libuild

## 0.1.0

- Initial release
- Trace file references from SKILL.md (markdown links, code block `file=` annotations)
- Pack into `.skill` zip archive or directory
