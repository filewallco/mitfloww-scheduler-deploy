import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cachedHtml: string | null = null;

export function renderAdminHtml(): string {
  if (cachedHtml) {
    return cachedHtml;
  }

  const candidatePaths: string[] = [
    path.resolve(process.cwd(), "public", "index.html"),
    path.resolve(process.cwd(), "scheduler", "public", "index.html"),
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(
      path.resolve(currentDir, "..", "..", "public", "index.html"),
      path.resolve(currentDir, "..", "public", "index.html")
    );
  } catch {
    // import.meta.url fallback
  }

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        cachedHtml = fs.readFileSync(candidate, "utf-8");
        return cachedHtml;
      }
    } catch {
      // Try next path
    }
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>MitFloww Operations</title></head><body><h1>MitFloww Operations Console</h1><p>Admin UI template initialized.</p></body></html>`;
}
