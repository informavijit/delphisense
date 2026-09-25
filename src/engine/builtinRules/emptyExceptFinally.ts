import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags `except ... end` blocks that contain no statements (silently
 * swallowed exceptions) and `finally` blocks that are similarly empty
 * (dead code — the finally serves no purpose).
 */
export const emptyExceptFinallyRule: Rule = {
  id: 'emptyExceptFinally',
  description: 'Empty except or finally block — exceptions may be silently swallowed.',
  category: 'Bug',
  defaultSeverity: 'warning',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = stripComment(lines[i]).trim();
      const keywordMatch = trimmed.match(/^(except|finally)\b/i);
      if (!keywordMatch) continue;

      const keyword = keywordMatch[1].toLowerCase();
      // Look ahead until the matching `end;` and see whether any
      // non-blank, non-comment line appears before it.
      let j = i + 1;
      let hasContent = false;
      // Content on the same line after the keyword (rare but possible).
      const rest = trimmed.slice(keyword.length).trim();
      if (rest.length > 0 && !/^end\b/i.test(rest)) hasContent = true;

      while (j < lines.length) {
        const l = stripComment(lines[j]).trim();
        if (/^end\b/i.test(l)) break;
        if (l.length > 0) {
          hasContent = true;
          break;
        }
        j++;
        if (j - i > 200) break; // safety guard
      }

      if (!hasContent) {
        const label = keyword === 'except' ? 'except' : 'finally';
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            keyword === 'except'
              ? `Empty 'except' block — exception is silently swallowed. Consider logging or re-raising.`
              : `Empty 'finally' block — has no effect and can likely be removed.`,
            unit.filePath,
            i + 1
          )
        );
      }
    }

    return findings;
  },
};

function stripComment(line: string): string {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}
