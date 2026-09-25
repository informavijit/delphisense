import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

const MARKER = /\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/i;

export const todoCommentRule: Rule = {
  id: 'todoComment',
  description: 'TODO / FIXME / HACK marker found in a comment.',
  category: 'Documentation',
  defaultSeverity: 'hint',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];

    for (const comment of unit.comments) {
      const m = comment.text.match(MARKER);
      if (m) {
        const marker = m[1].toUpperCase();
        const detail = m[2].trim();
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            detail ? `${marker}: ${detail}` : `${marker} comment found.`,
            unit.filePath,
            comment.line,
            comment.column
          )
        );
      }
    }

    return findings;
  },
};
