/**
 * Rewrite paths in SKILL.md content for flat format output.
 *
 * @param content - The raw SKILL.md content
 * @param pathMap - Original relative path → new flat path (e.g., "docs/api.md" → "references/api.md")
 * @returns Content with rewritten paths
 */
export function rewriteSkillContent(
  content: string,
  pathMap: Map<string, string>
): string {
  function lookup(raw: string): string | undefined {
    const normalized = raw.replace(/^\.\//, "");
    return pathMap.get(normalized);
  }

  // Rewrite markdown links: [text](path) and [text](path#fragment)
  content = content.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, text, href) => {
      // Skip external URLs
      if (/^https?:\/\//.test(href) || href.startsWith("#")) {
        return `[${text}](${href})`;
      }

      const [pathPart, ...fragmentParts] = href.split("#");
      const fragment = fragmentParts.length ? "#" + fragmentParts.join("#") : "";
      const newPath = lookup(pathPart);
      if (newPath) {
        return `[${text}](${newPath}${fragment})`;
      }
      return `[${text}](${href})`;
    }
  );

  // Rewrite code block file= annotations: ```lang file=path
  content = content.replace(
    /^(```\S*)\s+file=(\S+)/gm,
    (_match, lang, filePath) => {
      const newPath = lookup(filePath);
      if (newPath) {
        return `${lang} file=${newPath}`;
      }
      return `${lang} file=${filePath}`;
    }
  );

  return content;
}
