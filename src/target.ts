import * as fs from 'fs';
import * as path from 'path';

export type TargetKind = 'file' | 'folder' | 'dpr' | 'workspace';

export interface AnalysisTarget {
  kind: TargetKind;
  label: string;      // human-readable name for report title
  rootPath: string;    // file, folder, or dpr path
}

const PASCAL_EXTENSIONS = new Set(['.pas', '.pp', '.inc']);
const IGNORED_DIRS = new Set(['.git', '.svn', 'node_modules', '__history', '__recovery', 'out', 'dist', 'bin', 'obj']);

/** Resolves a target into the concrete list of .pas files to analyze. */
export function resolveTargetFiles(target: AnalysisTarget): string[] {
  switch (target.kind) {
    case 'file':
      return [target.rootPath];
    case 'folder':
      return walkFolder(target.rootPath);
    case 'dpr':
      return resolveDprFiles(target.rootPath);
    case 'workspace':
      return walkFolder(target.rootPath);
  }
}

function walkFolder(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.delphisense') continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (PASCAL_EXTENSIONS.has(ext)) results.push(fullPath);
      }
    }
  }

  walk(root);
  return results;
}

/**
 * Resolves a .dpr/.dpk project file's `uses` clause into sibling .pas
 * files on disk by matching unit short names to files of the same name
 * in the project directory (and its subdirectories). This is a heuristic
 * — it does not honor the full Delphi library/search-path resolution —
 * but covers the common case where units live under the project tree,
 * which is the majority of real-world layouts.
 */
function resolveDprFiles(dprPath: string): string[] {
  const projectDir = path.dirname(dprPath);
  const allPasFiles = walkFolder(projectDir);
  const byBaseName = new Map<string, string>();
  for (const f of allPasFiles) {
    byBaseName.set(path.basename(f, path.extname(f)).toLowerCase(), f);
  }

  let source: string;
  try {
    source = fs.readFileSync(dprPath, 'utf8');
  } catch {
    return [dprPath];
  }

  const unitNames = extractDprUsesNames(source);
  const resolved = new Set<string>();

  for (const name of unitNames) {
    const short = name.split('.').pop()!.toLowerCase();
    const match = byBaseName.get(short);
    if (match) resolved.add(match);
  }

  // Always include everything found under the project tree too, so units
  // reachable only indirectly (via other units' uses clauses) aren't lost.
  // This keeps the .dpr command practically equivalent to "analyze the
  // project folder" while still being framed and reported as a project
  // analysis with the .dpr as its declared root.
  for (const f of allPasFiles) resolved.add(f);

  return Array.from(resolved);
}

function extractDprUsesNames(source: string): string[] {
  const names: string[] = [];
  const usesMatch = source.match(/\buses\b([\s\S]*?);/i);
  if (!usesMatch) return names;

  const body = usesMatch[1];
  const parts = body.split(',');
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    const nameOnly = part.split(/\bin\b/i)[0].trim();
    if (/^[A-Za-z_][\w.]*$/.test(nameOnly)) names.push(nameOnly);
  }
  return names;
}

export function labelForTarget(target: AnalysisTarget): string {
  return target.label;
}
