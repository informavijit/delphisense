import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

export const longMethodRule: Rule = {
  id: 'longMethod',
  description: 'Procedure/function body exceeds the configured maximum line count.',
  category: 'Code Smell',
  defaultSeverity: 'warning',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const max = ctx.config.longMethodMaxLines;

    for (const routine of unit.routines) {
      if (routine.bodyLineCount > max) {
        const label = routine.className ? `${routine.className}.${routine.name}` : routine.name;
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `${capitalize(routine.kind)} '${label}' body is ${routine.bodyLineCount} lines (max recommended: ${max}). Consider extracting sub-procedures.`,
            unit.filePath,
            routine.startLine
          )
        );
      }
    }

    return findings;
  },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
