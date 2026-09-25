/**
 * Core data model shared by every rule, the analyzer, and the report generator.
 * This file has zero dependency on the `vscode` API — it is plain TypeScript so
 * the whole engine can be reused outside the extension host later (CLI, tests).
 */

export type Severity = 'error' | 'warning' | 'hint';

export interface Finding {
  ruleId: string;
  message: string;
  severity: Severity;
  file: string;        // absolute path
  line: number;         // 1-based
  column: number;       // 1-based
  endLine?: number;
  endColumn?: number;
  category: FindingCategory;
}

export type FindingCategory =
  | 'Bug'
  | 'Code Smell'
  | 'Security'
  | 'Documentation'
  | 'Custom';

/** A procedure/function body extracted from the source, with its line range. */
export interface RoutineInfo {
  name: string;
  kind: 'procedure' | 'function' | 'constructor' | 'destructor';
  startLine: number;    // line of the header
  bodyStartLine: number; // line of the opening `begin`
  bodyEndLine: number;   // line of the matching `end;`
  bodyLineCount: number;
  className?: string;    // for TFoo.Bar implementations
}

/** Lightweight structural model of one .pas/.dpr/.dpk file — not a full AST. */
export interface ParsedUnit {
  filePath: string;
  lines: string[];             // raw source lines, 1:1 with line numbers - 1
  unitName?: string;
  usesClauseUnits: UsesEntry[];
  routines: RoutineInfo[];
  comments: CommentInfo[];
}

export interface UsesEntry {
  name: string;
  line: number;
  section: 'interface' | 'implementation' | 'program';
}

export interface CommentInfo {
  text: string;
  line: number;
  column: number;
}

export interface RuleContext {
  config: DelphiSenseConfig;
}

export interface DelphiSenseConfig {
  longMethodMaxLines: number;
  deepNestingMaxDepth: number;
  maxLineLength: number;
  disabledRules: string[];
}

/** The contract every rule — built-in or user-supplied — must implement. */
export interface Rule {
  id: string;
  description: string;
  category: FindingCategory;
  defaultSeverity: Severity;
  check(unit: ParsedUnit, context: RuleContext): Finding[];
}

export function makeFinding(
  rule: Pick<Rule, 'id' | 'category'>,
  severity: Severity,
  message: string,
  file: string,
  line: number,
  column: number = 1,
  endLine?: number,
  endColumn?: number
): Finding {
  return {
    ruleId: rule.id,
    category: rule.category,
    severity,
    message,
    file,
    line,
    column,
    endLine,
    endColumn,
  };
}
