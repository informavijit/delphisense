import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags redundant comparisons against boolean literals (e.g., `if (IsActive = True) then`
 * or `if (IsValid = False) then`). Recommends idiomatic expressions (`if IsActive then`
 * or `if not IsValid then`).
 */
export const redundantBooleanComparisonRule: Rule = {
  id: 'redundantBooleanComparison',
  description: 'Redundant comparison to boolean literal (e.g., = True or = False).',
  category: 'Code Smell',
  defaultSeverity: 'hint',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    // Pattern to catch boolean literal comparisons: = True, = False, <> True, <> False
    const redundantBoolRegex = /\b([A-Za-z_]\w*|\))\s*(=|<>)\s*(True|False)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comment-only lines
      if (trimmed.startsWith('//') || trimmed.startsWith('{') || trimmed.startsWith('(*')) continue;

      const match = redundantBoolRegex.exec(line);
      if (match) {
        const operator = match[2];
        const boolLiteral = match[3];
        const isTrue = boolLiteral.toLowerCase() === 'true';
        const isEquals = operator === '=';

        let suggestion = 'if Expression then';
        if ((isEquals && !isTrue) || (!isEquals && isTrue)) {
          suggestion = 'if not Expression then';
        }

        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `Redundant boolean comparison '${operator} ${boolLiteral}'. Use idiomatic boolean syntax instead (e.g. '${suggestion}').`,
            unit.filePath,
            i + 1
          )
        );
      }
    }

    return findings;
  },
};
