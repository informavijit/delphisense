import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags procedure or function headers that declare too many parameters (default > 5),
 * violating the KISS (Keep It Simple, Stupid) principle.
 */
export const tooManyParametersRule: Rule = {
  id: 'tooManyParameters',
  description: 'Procedure or function header has too many parameters, violating KISS.',
  category: 'Code Smell',
  defaultSeverity: 'warning',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const maxParams = 5;

    const routineHeaderRegex = /^\s*(procedure|function|constructor|destructor)\s+[A-Za-z_][\w.]*\s*\(([^)]+)\)/i;

    unit.lines.forEach((line, idx) => {
      const match = routineHeaderRegex.exec(line);
      if (!match) return;

      const paramListStr = match[2];
      // Count individual parameter declarations separated by ';' or ','
      // e.g. (A, B, C: Integer; D: String; E, F: Boolean)
      const paramGroups = paramListStr.split(';');
      let paramCount = 0;

      for (const group of paramGroups) {
        const parts = group.split(':');
        if (parts.length > 0) {
          const names = parts[0].split(',').filter((s) => s.trim().length > 0);
          paramCount += names.length;
        }
      }

      if (paramCount > maxParams) {
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `Routine header has ${paramCount} parameters (recommended max: ${maxParams}). Consider grouping parameters into a record or class to adhere to KISS.`,
            unit.filePath,
            idx + 1
          )
        );
      }
    });

    return findings;
  },
};
