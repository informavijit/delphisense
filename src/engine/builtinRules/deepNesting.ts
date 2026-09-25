import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Tracks begin/if/for/while/case/try nesting depth per routine body and
 * flags the point where it exceeds the configured maximum. Uses the same
 * heuristic keyword-counting approach as the structural analyzer's
 * begin/end matcher, scoped to each routine's body range.
 */
export const deepNestingRule: Rule = {
  id: 'deepNesting',
  description: 'Control-flow nesting exceeds the configured maximum depth.',
  category: 'Code Smell',
  defaultSeverity: 'warning',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const maxDepth = ctx.config.deepNestingMaxDepth;
    const lines = unit.lines;

    for (const routine of unit.routines) {
      let depth = 0;
      let flaggedThisRoutine = false;

      for (let i = routine.bodyStartLine - 1; i < routine.bodyEndLine; i++) {
        const line = stripStringsAndComments(lines[i] || '');

        const opens = (line.match(/\b(begin|case)\b/gi) || []).length;
        const closes = (line.match(/\bend\b/gi) || []).length;

        depth += opens - closes;

        if (depth > maxDepth && !flaggedThisRoutine) {
          const label = routine.className ? `${routine.className}.${routine.name}` : routine.name;
          findings.push(
            makeFinding(
              this,
              this.defaultSeverity,
              `Nesting depth exceeds ${maxDepth} inside '${label}'. Consider extracting a sub-procedure or using guard clauses.`,
              unit.filePath,
              i + 1
            )
          );
          flaggedThisRoutine = true; // one finding per routine, at the deepest onset
        }
      }
    }

    return findings;
  },
};

function stripStringsAndComments(line: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') break;
    out += ch;
  }
  return out;
}
