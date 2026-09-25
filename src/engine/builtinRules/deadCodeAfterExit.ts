import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags a statement that immediately follows an unconditional `Exit;` /
 * `Exit(...)` / `raise ...;` / `Abort;` within the same begin/end block,
 * since it can never execute. Intentionally conservative: only fires when
 * the next non-blank line is a plain statement, not `end`, not a label,
 * and not another block terminator — to keep false positives low.
 */
export const deadCodeAfterExitRule: Rule = {
  id: 'deadCodeAfterExit',
  description: 'Unreachable statement immediately after Exit/raise/Abort.',
  category: 'Bug',
  defaultSeverity: 'warning',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = stripComment(lines[i]).trim();

      const isTerminator =
        /^(exit)\s*(\(.*\))?\s*;\s*$/i.test(trimmed) ||
        /^raise\b.*;\s*$/i.test(trimmed) ||
        /^abort\s*;\s*$/i.test(trimmed);

      if (!isTerminator) continue;

      // Find next non-blank line.
      let j = i + 1;
      while (j < lines.length && stripComment(lines[j]).trim().length === 0) j++;
      if (j >= lines.length) continue;

      const next = stripComment(lines[j]).trim();
      if (/^(end\b|until\b|else\b|except\b|finally\b)/i.test(next)) continue; // legitimate block close
      if (next.length === 0) continue;

      findings.push(
        makeFinding(
          this,
          this.defaultSeverity,
          `Statement is unreachable — it follows an unconditional Exit/raise/Abort.`,
          unit.filePath,
          j + 1
        )
      );
    }

    return findings;
  },
};

function stripComment(line: string): string {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}
