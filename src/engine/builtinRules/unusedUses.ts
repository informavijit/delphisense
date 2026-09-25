import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags units listed in a `uses` clause that are never referenced as an
 * identifier anywhere else in the file. This is a heuristic (it cannot see
 * cross-unit initialization side effects), so it stays a Hint, not a Warning.
 */
export const unusedUsesRule: Rule = {
  id: 'unusedUses',
  description: 'Unit listed in uses clause but never referenced in the file.',
  category: 'Code Smell',
  defaultSeverity: 'hint',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const fullText = unit.lines.join('\n');

    for (const entry of unit.usesClauseUnits) {
      // Only check the short unit name (last segment after a dot, e.g.
      // System.SysUtils -> SysUtils) since that's how code typically
      // refers to symbols from it, and how the unit itself is renamed
      // once mapped through 'in' redirection.
      const shortName = entry.name.split('.').pop() as string;
      const pattern = new RegExp(`\\b${escapeRegExp(shortName)}\\b`, 'g');
      const occurrences = fullText.match(pattern) || [];

      // One occurrence = only the uses-clause mention itself.
      if (occurrences.length <= 1) {
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `Unit '${entry.name}' is listed in uses but does not appear to be used.`,
            unit.filePath,
            entry.line
          )
        );
      }
    }

    return findings;
  },
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
