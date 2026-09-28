import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags blocks of commented-out Pascal code (e.g. `// procedure ...`, `// begin`, `// if ... then`),
 * encouraging clean code removal and reliance on Git version control (YAGNI).
 */
export const commentedOutCodeRule: Rule = {
  id: 'commentedOutCode',
  description: 'Commented-out Pascal code block detected (YAGNI).',
  category: 'Code Smell',
  defaultSeverity: 'hint',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    // Match single line comments `//` that contain Pascal executable syntax
    const commentedCodeRegex = /^\s*\/\/\s*(procedure|function|if\b.*then\b|while\b.*do\b|for\b.*:=|begin\b|try\b|except\b|finally\b|[A-Za-z_]\w*\s*:=\s*.*[;])/i;

    let consecutiveCommentedCodeLines = 0;
    let startLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (commentedCodeRegex.test(line)) {
        if (consecutiveCommentedCodeLines === 0) startLine = i + 1;
        consecutiveCommentedCodeLines++;
      } else {
        if (consecutiveCommentedCodeLines >= 2) {
          findings.push(
            makeFinding(
              this,
              this.defaultSeverity,
              `Commented-out code detected (${consecutiveCommentedCodeLines} line block starting at line ${startLine}). Remove dead code and rely on Git version history (YAGNI).`,
              unit.filePath,
              startLine
            )
          );
        }
        consecutiveCommentedCodeLines = 0;
        startLine = -1;
      }
    }

    if (consecutiveCommentedCodeLines >= 2) {
      findings.push(
        makeFinding(
          this,
          this.defaultSeverity,
          `Commented-out code detected (${consecutiveCommentedCodeLines} line block starting at line ${startLine}). Remove dead code and rely on Git version history (YAGNI).`,
          unit.filePath,
          startLine
        )
      );
    }

    return findings;
  },
};
