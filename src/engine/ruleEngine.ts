import * as fs from 'fs';
import { Rule, ParsedUnit, RuleContext, Finding, DelphiSenseConfig } from './model';
import { analyzeStructure } from './structuralAnalyzer';
import { loadCustomRules } from './customRules';

import { unusedUsesRule } from './builtinRules/unusedUses';
import { longMethodRule } from './builtinRules/longMethod';
import { emptyExceptFinallyRule } from './builtinRules/emptyExceptFinally';
import { todoCommentRule } from './builtinRules/todoComment';
import { deepNestingRule } from './builtinRules/deepNesting';
import { deadCodeAfterExitRule } from './builtinRules/deadCodeAfterExit';
import { longLineRule } from './builtinRules/longLine';

export const BUILTIN_RULES: Rule[] = [
  unusedUsesRule,
  longMethodRule,
  emptyExceptFinallyRule,
  todoCommentRule,
  deepNestingRule,
  deadCodeAfterExitRule,
  longLineRule,
];

export interface AnalysisResult {
  findings: Finding[];
  unitsAnalyzed: number;
  filesAnalyzed: string[];
  rulesRun: string[];
  durationMs: number;
  totalLines: number;
}

export interface AnalysisOptions {
  config: DelphiSenseConfig;
  customRulesFilePath?: string; // absolute path, optional
}

/**
 * Runs every enabled rule (built-in + custom) against every file in
 * `filePaths`. Each file is parsed independently and a failure to parse
 * or read one file never aborts the run for the rest — this matters for a
 * "works on any Delphi version, any real codebase" tool.
 */
export function analyzeFiles(filePaths: string[], options: AnalysisOptions): AnalysisResult {
  const start = Date.now();
  const customRules = options.customRulesFilePath ? loadCustomRules(options.customRulesFilePath) : [];
  const allRules = [...BUILTIN_RULES, ...customRules];
  const ctx: RuleContext = { config: options.config };

  const findings: Finding[] = [];
  const analyzedFiles: string[] = [];
  let totalLines = 0;

  for (const filePath of filePaths) {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const unit: ParsedUnit = analyzeStructure(filePath, source);
      analyzedFiles.push(filePath);
      totalLines += unit.lines.length;

      for (const rule of allRules) {
        try {
          const ruleFindings = rule.check(unit, ctx);
          findings.push(...ruleFindings);
        } catch (err) {
          // A single misbehaving rule must never take down the whole run.
          console.warn(`DelphiSense: rule '${rule.id}' threw on ${filePath}: ${err}`);
        }
      }
    } catch (err) {
      console.warn(`DelphiSense: could not read/analyze ${filePath}: ${err}`);
    }
  }

  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

  return {
    findings,
    unitsAnalyzed: analyzedFiles.length,
    filesAnalyzed: analyzedFiles,
    rulesRun: allRules.map((r) => r.id),
    durationMs: Date.now() - start,
    totalLines,
  };
}
