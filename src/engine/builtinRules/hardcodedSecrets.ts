import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags hardcoded credentials, secret keys, passwords, and API tokens in Delphi source files.
 */
export const hardcodedSecretsRule: Rule = {
  id: 'hardcodedSecrets',
  description: 'Possible hardcoded secret, API key, or password in source code.',
  category: 'Security',
  defaultSeverity: 'error',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comment-only lines
      if (trimmed.startsWith('//') || trimmed.startsWith('{') || trimmed.startsWith('(*')) continue;

      // Check for hardcoded secret assignments
      // Matches variable names containing Password, Secret, ApiKey, Token, etc. assigned to string literals
      const assignmentMatch = /\b\w*(Password|Secret|ApiKey|AuthToken|PrivateKey|AccessKey)\w*\s*:=\s*['"]([^'"]{3,})['"]/i.exec(line);

      // Connection string parameters e.g., Password=admin123 inside strings
      const connStrMatch = /\bPassword\s*=\s*([^;'"]{3,})/i.exec(line);

      if (assignmentMatch || connStrMatch) {
        findings.push(
          makeFinding(
            this,
            this.defaultSeverity,
            `Hardcoded secret detected: Avoid storing hardcoded credentials or keys in source code. Use environment variables or secure configuration.`,
            unit.filePath,
            i + 1
          )
        );
      }
    }

    return findings;
  },
};
