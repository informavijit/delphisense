import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags SQL query strings constructed via direct string concatenation (+) with variables/inputs,
 * which introduces SQL Injection vulnerability risks.
 */
export const sqlInjectionRule: Rule = {
  id: 'sqlInjection',
  description: 'Potential SQL Injection vulnerability via string concatenation in SQL query.',
  category: 'Security',
  defaultSeverity: 'error',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match assignments or calls to .SQL.Text, .SQL.Add, or Query.SQL
      const isSqlAssignment = /\b(SQL\.Text|SQL\.Add|CommandText|QueryText)\b/i.test(line);
      if (!isSqlAssignment) continue;

      // Check for string concatenation with non-literal variables using '+'
      // e.g. SQL.Text := 'SELECT * FROM Users WHERE Name = ' + Edit1.Text;
      const hasConcatWithVariable = /['"]\s*\+\s*[A-Za-z_]\w*/i.test(line) || /[A-Za-z_]\w*\s*\+\s*['"]/i.test(line);

      if (hasConcatWithVariable) {
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `Potential SQL Injection: SQL query uses string concatenation '+'. Use parameterized queries (e.g. ParamByName) instead.`,
            unit.filePath,
            i + 1
          )
        );
      }
    }

    return findings;
  },
};
