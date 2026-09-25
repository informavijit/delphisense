import * as fs from 'fs';
import { Rule, ParsedUnit, RuleContext, Finding, makeFinding, Severity } from './model';

interface CustomRuleJson {
  id: string;
  pattern: string;
  message: string;
  severity?: Severity;
  flags?: string; // regex flags, default 'gi'
}

interface CustomRulesFile {
  rules: CustomRuleJson[];
}

/**
 * Loads workspace-defined pattern rules from a JSON file (default
 * `.delphisense/rules.json`) and returns them as Rule instances that
 * plug into the same rule engine as the built-ins. Purely declarative —
 * a regex pattern and a message — so there is no code execution involved
 * and no sandboxing concern.
 */
export function loadCustomRules(rulesFilePath: string): Rule[] {
  if (!fs.existsSync(rulesFilePath)) return [];

  let parsed: CustomRulesFile;
  try {
    const content = fs.readFileSync(rulesFilePath, 'utf8');
    parsed = JSON.parse(content);
  } catch (err) {
    console.warn(`DelphiSense: failed to parse custom rules file at ${rulesFilePath}: ${err}`);
    return [];
  }

  if (!Array.isArray(parsed.rules)) return [];

  const rules: Rule[] = [];

  for (const def of parsed.rules) {
    if (!def.id || !def.pattern || !def.message) continue;

    let regex: RegExp;
    try {
      regex = new RegExp(def.pattern, def.flags ?? 'gi');
    } catch (err) {
      console.warn(`DelphiSense: invalid regex in custom rule '${def.id}': ${err}`);
      continue;
    }

    const severity: Severity = def.severity ?? 'warning';

    rules.push({
      id: def.id,
      description: `Custom rule: ${def.message}`,
      category: 'Custom',
      defaultSeverity: severity,
      check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
        if (ctx.config.disabledRules.includes(this.id)) return [];
        const findings: Finding[] = [];

        unit.lines.forEach((line, idx) => {
          // Reset lastIndex for global regexes reused across lines.
          regex.lastIndex = 0;
          const match = regex.exec(line);
          if (match) {
            findings.push(
              makeFinding(this, severity, def.message, unit.filePath, idx + 1, match.index + 1)
            );
          }
        });

        return findings;
      },
    });
  }

  return rules;
}

/** Reference example written to a new workspace on first run, if requested. */
export const EXAMPLE_CUSTOM_RULES_FILE = `{
  "rules": [
    {
      "id": "noHardcodedConnStr",
      "pattern": "Password\\\\s*=",
      "message": "Possible hardcoded password in a connection string.",
      "severity": "error"
    },
    {
      "id": "noShowMessageInLoop",
      "pattern": "ShowMessage\\\\s*\\\\(",
      "message": "Avoid ShowMessage in production code paths — prefer logging.",
      "severity": "hint"
    }
  ]
}
`;
