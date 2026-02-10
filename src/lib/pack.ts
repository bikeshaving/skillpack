import archiver from "archiver";
import * as fs from "node:fs";
import * as path from "node:path";

export interface PackOptions {
  files: Set<string>;
  skillPath: string;
  outputPath: string;
  verbose?: boolean;
}

/**
 * Pack files into a .skill archive (zip with .skill extension)
 */
export async function pack(options: PackOptions): Promise<void> {
  const { files, skillPath, outputPath, verbose } = options;

  const rootDir = path.dirname(path.resolve(skillPath));
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      if (verbose) {
        console.log(`\nPacked ${archive.pointer()} bytes to ${outputPath}`);
      }
      resolve();
    });

    archive.on("error", reject);
    archive.pipe(output);

    // Add each file with its relative path preserved
    for (const file of files) {
      const relativePath = path.relative(rootDir, file);
      if (verbose) {
        console.log(`  packing: ${relativePath}`);
      }
      archive.file(file, { name: relativePath });
    }

    archive.finalize();
  });
}
