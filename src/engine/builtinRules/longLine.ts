import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

export const longLineRule: Rule = {
  id: 'longLine',
  description: 'Source line exceeds the configured maximum length.',
  category: 'Code Smell',
  defaultSeverity: 'hint',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const max = ctx.config.maxLineLength;

    unit.lines.forEach((line, idx) => {
      if (line.length > max) {
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `Line is ${line.length} characters long (max recommended: ${max}).`,
            unit.filePath,
            idx + 1,
            max + 1
          )
        );
      }
    });

    return findings;
  },
};
