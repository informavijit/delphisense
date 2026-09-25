import { ParsedUnit, RoutineInfo, UsesEntry, CommentInfo } from './model';

/**
 * Builds a lightweight structural model of a Pascal/Delphi source file.
 *
 * This is intentionally NOT a full recursive-descent AST parser. It is a
 * single-pass, line-oriented scanner that is resilient to any Delphi
 * version and any construct it doesn't fully understand (generics,
 * anonymous methods, attributes, etc.) because it never tries to build a
 * complete grammar tree — it only extracts the handful of structural facts
 * the rule engine needs: uses-clause entries, routine boundaries, and
 * comments. Unrecognized syntax is simply left alone rather than causing a
 * parse failure, which matters for a tool meant to work across any Delphi
 * version and any real-world (imperfect) codebase.
 */
export function analyzeStructure(filePath: string, source: string): ParsedUnit {
  const rawLines = source.split(/\r\n|\r|\n/);
  const lines = stripStringLiteralsAndComments(rawLines);

  const unit: ParsedUnit = {
    filePath,
    lines: rawLines,
    unitName: extractUnitName(rawLines),
    usesClauseUnits: extractUsesClauses(lines),
    routines: extractRoutines(lines, rawLines),
    comments: extractComments(rawLines),
  };

  return unit;
}

function extractUnitName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 5)) {
    const m = line.match(/^\s*(unit|program|package|library)\s+([A-Za-z_][\w.]*)\s*;/i);
    if (m) return m[2];
  }
  return undefined;
}

/**
 * Returns a copy of the lines with string literals and comment bodies
 * blanked out (replaced with spaces of the same length) so downstream
 * regex scans never misfire on text that merely *looks* like code inside
 * a string or a comment. Line length and column positions are preserved.
 */
function stripStringLiteralsAndComments(rawLines: string[]): string[] {
  const result: string[] = [];
  let inBlockComment = false;
  let blockCommentChar: '{' | '(*' | null = null;

  for (let raw of rawLines) {
    let out = '';
    let i = 0;
    let inString = false;

    while (i < raw.length) {
      const ch = raw[i];
      const two = raw.substr(i, 2);

      if (inBlockComment) {
        if (blockCommentChar === '{' && ch === '}') {
          inBlockComment = false;
          blockCommentChar = null;
          out += ' ';
          i += 1;
          continue;
        }
        if (blockCommentChar === '(*' && two === '*)') {
          inBlockComment = false;
          blockCommentChar = null;
          out += '  ';
          i += 2;
          continue;
        }
        out += ' ';
        i += 1;
        continue;
      }

      if (inString) {
        out += ' ';
        if (ch === "'") inString = false;
        i += 1;
        continue;
      }

      if (ch === "'") {
        inString = true;
        out += ' ';
        i += 1;
        continue;
      }

      if (ch === '{') {
        inBlockComment = true;
        blockCommentChar = '{';
        out += ' ';
        i += 1;
        continue;
      }

      if (two === '(*') {
        inBlockComment = true;
        blockCommentChar = '(*';
        out += '  ';
        i += 2;
        continue;
      }

      if (two === '//') {
        out += ' '.repeat(raw.length - i);
        i = raw.length;
        continue;
      }

      out += ch;
      i += 1;
    }

    result.push(out);
  }

  return result;
}

function extractUsesClauses(cleanLines: string[]): UsesEntry[] {
  const entries: UsesEntry[] = [];
  let section: 'interface' | 'implementation' | 'program' = 'program';
  let collecting = false;
  let buffer = '';
  let startLine = 0;

  for (let idx = 0; idx < cleanLines.length; idx++) {
    const line = cleanLines[idx];
    const trimmed = line.trim();

    if (/^\s*interface\s*$/i.test(trimmed)) section = 'interface';
    else if (/^\s*implementation\s*$/i.test(trimmed)) section = 'implementation';

    if (!collecting) {
      const startMatch = line.match(/^\s*uses\b/i);
      if (startMatch) {
        collecting = true;
        buffer = line.slice(line.toLowerCase().indexOf('uses') + 4);
        startLine = idx + 1;
        if (buffer.includes(';')) {
          collecting = false;
          buffer = buffer.slice(0, buffer.indexOf(';'));
          pushUsesEntries(entries, buffer, startLine, section);
        }
      }
      continue;
    }

    if (collecting) {
      if (line.includes(';')) {
        buffer += ' ' + line.slice(0, line.indexOf(';'));
        collecting = false;
        pushUsesEntries(entries, buffer, startLine, section);
      } else {
        buffer += ' ' + line;
      }
    }
  }

  return entries;
}

function pushUsesEntries(
  entries: UsesEntry[],
  buffer: string,
  line: number,
  section: 'interface' | 'implementation' | 'program'
) {
  const names = buffer
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // drop the `in 'File.pas'` suffix some uses entries carry
    .map((s) => s.split(/\bin\b/i)[0].trim());

  for (const name of names) {
    if (/^[A-Za-z_][\w.]*$/.test(name)) {
      entries.push({ name, line, section });
    }
  }
}

const ROUTINE_HEADER = /^\s*(procedure|function|constructor|destructor)\s+([A-Za-z_][\w.]*(?:<[^>]*>)?)\s*(\([^)]*\))?\s*(:\s*[A-Za-z_][\w<>,.\[\]]*)?\s*;/i;

function extractRoutines(cleanLines: string[], rawLines: string[]): RoutineInfo[] {
  const routines: RoutineInfo[] = [];

  for (let idx = 0; idx < cleanLines.length; idx++) {
    const header = cleanLines[idx].match(ROUTINE_HEADER);
    if (!header) continue;

    const kind = header[1].toLowerCase() as RoutineInfo['kind'];
    const fullName = header[2];
    let className: string | undefined;
    let name = fullName;
    if (fullName.includes('.')) {
      const parts = fullName.split('.');
      className = parts[0];
      name = parts.slice(1).join('.');
    }

    // Find the `begin` that opens the body, skipping forward-declarations
    // (headers followed immediately by `;` with no body — e.g. interface
    // section declarations, `forward;`, or `external;`).
    let searchIdx = idx + 1;
    // Skip past directive-only lines (virtual; override; inline; etc.)
    // and local var/const/type declaration lines until we hit `begin`,
    // another routine header, or run out of file.
    let bodyStart = -1;
    let sawOnlyDirectivesOrDecls = true;
    while (searchIdx < cleanLines.length) {
      const l = cleanLines[searchIdx].trim();
      if (/^begin\b/i.test(l)) {
        bodyStart = searchIdx;
        break;
      }
      if (ROUTINE_HEADER.test(cleanLines[searchIdx])) break; // next routine, no body found
      if (/^(forward|external.*)\s*;\s*$/i.test(l)) { sawOnlyDirectivesOrDecls = false; break; }
      searchIdx++;
      if (searchIdx - idx > 400) break; // safety guard
    }

    if (bodyStart === -1) continue; // forward decl / interface decl — no body to measure

    const bodyEnd = findMatchingEnd(cleanLines, bodyStart);
    if (bodyEnd === -1) continue;

    routines.push({
      name,
      kind,
      className,
      startLine: idx + 1,
      bodyStartLine: bodyStart + 1,
      bodyEndLine: bodyEnd + 1,
      bodyLineCount: bodyEnd - bodyStart + 1,
    });
  }

  return routines;
}

/**
 * Given the index of a line containing an opening `begin`, finds the index
 * of the line containing its matching `end` by tracking a simple
 * begin/end (and case/end, try/end, record/end) nesting depth. This is a
 * heuristic, not a real parser, but is reliable for well-formed Delphi
 * source across all language versions since begin/end nesting rules
 * haven't changed.
 */
function findMatchingEnd(cleanLines: string[], startIdx: number): number {
  let depth = 0;
  const opens = /\b(begin|case|try|record)\b/gi;
  const closes = /\bend\b/gi;

  for (let i = startIdx; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    let openCount = (line.match(opens) || []).length;
    // `record ... end` where record has no separate `case` — still balances.
    let closeCount = (line.match(closes) || []).length;

    depth += openCount;
    depth -= closeCount;

    if (depth <= 0 && i >= startIdx) {
      return i;
    }
    if (i - startIdx > 5000) break; // safety guard
  }
  return -1;
}

function extractComments(rawLines: string[]): CommentInfo[] {
  const comments: CommentInfo[] = [];
  let inBlock = false;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];

    const lineCommentIdx = findLineCommentStart(line);
    if (lineCommentIdx !== -1) {
      comments.push({
        text: line.slice(lineCommentIdx + 2).trim(),
        line: idx + 1,
        column: lineCommentIdx + 1,
      });
    }

    const braceIdx = line.indexOf('{');
    if (braceIdx !== -1 && !inBlock) {
      const closeIdx = line.indexOf('}', braceIdx);
      const text = closeIdx !== -1 ? line.slice(braceIdx + 1, closeIdx) : line.slice(braceIdx + 1);
      comments.push({ text: text.trim(), line: idx + 1, column: braceIdx + 1 });
      if (closeIdx === -1) inBlock = true;
    } else if (inBlock) {
      const closeIdx = line.indexOf('}');
      if (closeIdx !== -1) inBlock = false;
    }
  }

  return comments;
}

function findLineCommentStart(line: string): number {
  let inString = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === "'") inString = !inString;
    if (!inString && line[i] === '/' && line[i + 1] === '/') return i;
  }
  return -1;
}
