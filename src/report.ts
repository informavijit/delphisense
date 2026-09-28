import { AnalysisResult } from './engine/ruleEngine';
import { Finding, Severity, FindingCategory } from './engine/model';
import { AnalysisTarget } from './target';
import * as path from 'path';

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'hint'];

const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; icon: string }> = {
  error: { label: 'Error', color: '#8a1c1c', bg: '#fdeaea', icon: '&#9888;' },
  warning: { label: 'Warning', color: '#8a5a00', bg: '#fff6e0', icon: '&#9888;' },
  hint: { label: 'Hint', color: '#1c5a8a', bg: '#e8f2fb', icon: '&#9432;' },
};

const CATEGORY_COLORS: Record<FindingCategory, string> = {
  Bug: '#c0392b',
  'Code Smell': '#b8860b',
  Security: '#8e1e8e',
  Documentation: '#2a6fb0',
  Custom: '#555555',
};

export interface ReportMeta {
  generatedAt: Date;
  target: AnalysisTarget;
  toolVersion: string;
}

export function generateHtmlReport(result: AnalysisResult, meta: ReportMeta): string {
  const counts = countBySeverity(result.findings);
  const categoryStats = countByCategoryDetails(result.findings);
  const ruleStats = countByRuleDetails(result.findings);
  const byFile = groupByFile(result.findings);
  const qualityScore = computeQualityScore(result, counts);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>DelphiSense Report — ${escapeHtml(meta.target.label)}</title>
<style>
${CSS}
</style>
</head>
<body>
  <div class="ds-container">
    ${renderHeader(meta, result)}
    ${renderSummaryCards(counts, result, qualityScore)}
    ${renderCategoryBreakdown(categoryStats, result.findings.length, result.totalLines)}
    ${renderRuleSummaryTable(ruleStats, result.findings.length)}
    ${renderFileSummaryTable(result, byFile)}
    ${renderFindingsSections(byFile)}
    ${renderFooter(meta)}
  </div>
  <script>${JS}</script>
</body>
</html>`;
}

function renderHeader(meta: ReportMeta, result: AnalysisResult): string {
  return `
  <header class="ds-header">
    <div class="ds-header-left">
      <div class="ds-logo">DS</div>
      <div>
        <h1>DelphiSense Code Review Report</h1>
        <div class="ds-subtitle">${escapeHtml(meta.target.label)}</div>
      </div>
    </div>
    <div class="ds-header-right">
      <div class="ds-meta-row"><span>Generated</span><strong>${formatDate(meta.generatedAt)}</strong></div>
      <div class="ds-meta-row"><span>Target type</span><strong>${capitalize(meta.target.kind)}</strong></div>
      <div class="ds-meta-row"><span>Files analyzed</span><strong>${result.unitsAnalyzed}</strong></div>
      <div class="ds-meta-row"><span>Total LOC</span><strong>${result.totalLines.toLocaleString()} lines</strong></div>
      <div class="ds-meta-row"><span>Duration</span><strong>${result.durationMs} ms</strong></div>
      <div class="ds-meta-row"><span>DelphiSense</span><strong>v${escapeHtml(meta.toolVersion)}</strong></div>
    </div>
  </header>`;
}

function renderSummaryCards(
  counts: Record<Severity, number>,
  result: AnalysisResult,
  qualityScore: number
): string {
  const total = result.findings.length;
  return `
  <section class="ds-summary">
    <div class="ds-score-card">
      <div class="ds-score-ring" style="--score: ${qualityScore}">
        <span>${qualityScore}</span>
      </div>
      <div class="ds-score-label">Quality Score</div>
    </div>
    <div class="ds-stat-card ds-stat-total">
      <div class="ds-stat-value">${total}</div>
      <div class="ds-stat-label">Total Findings</div>
    </div>
    ${SEVERITY_ORDER.map(
      (sev) => `
    <div class="ds-stat-card" style="border-top-color:${SEVERITY_META[sev].color}">
      <div class="ds-stat-value" style="color:${SEVERITY_META[sev].color}">${counts[sev]}</div>
      <div class="ds-stat-label">${SEVERITY_META[sev].label}s</div>
    </div>`
    ).join('')}
    <div class="ds-stat-card">
      <div class="ds-stat-value">${result.totalLines.toLocaleString()}</div>
      <div class="ds-stat-label">Total LOC</div>
    </div>
    <div class="ds-stat-card">
      <div class="ds-stat-value">${result.unitsAnalyzed}</div>
      <div class="ds-stat-label">Files Scanned</div>
    </div>
  </section>`;
}

interface CategoryDetail {
  category: FindingCategory;
  total: number;
  error: number;
  warning: number;
  hint: number;
}

function renderCategoryBreakdown(categories: CategoryDetail[], totalFindings: number, totalLoc: number): string {
  if (categories.length === 0) return '';

  return `
  <section class="ds-section">
    <h2>Summary: Findings by Rule Category</h2>
    <div class="ds-category-grid">
      ${categories
        .map((c) => {
          const color = CATEGORY_COLORS[c.category] ?? '#555';
          const pct = totalFindings > 0 ? Math.round((c.total / totalFindings) * 100) : 0;
          const density = totalLoc > 0 ? ((c.total / totalLoc) * 100).toFixed(1) : '0';
          return `
      <div class="ds-cat-card" style="border-left-color: ${color}">
        <div class="ds-cat-header">
          <span class="ds-cat-title" style="color:${color}">${escapeHtml(c.category)}</span>
          <span class="ds-cat-count">${c.total} (${pct}% &middot; ${density}/100 LOC)</span>
        </div>
        <div class="ds-bar-track" style="margin: 8px 0 10px;">
          <div class="ds-bar-fill" style="width:${Math.max(5, pct)}%;background:${color}"></div>
        </div>
        <div class="ds-cat-badges">
          ${c.error > 0 ? `<span class="ds-mini-badge ds-sev-error">${c.error} error${c.error > 1 ? 's' : ''}</span>` : ''}
          ${c.warning > 0 ? `<span class="ds-mini-badge ds-sev-warning">${c.warning} warning${c.warning > 1 ? 's' : ''}</span>` : ''}
          ${c.hint > 0 ? `<span class="ds-mini-badge ds-sev-hint">${c.hint} hint${c.hint > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

interface RuleDetail {
  ruleId: string;
  category: FindingCategory;
  total: number;
  error: number;
  warning: number;
  hint: number;
}

function renderRuleSummaryTable(rules: RuleDetail[], totalFindings: number): string {
  if (rules.length === 0) return '';

  const rows = rules
    .sort((a, b) => b.total - a.total || a.ruleId.localeCompare(b.ruleId))
    .map((r) => {
      const pct = totalFindings > 0 ? Math.round((r.total / totalFindings) * 100) : 0;
      const catColor = CATEGORY_COLORS[r.category] ?? '#555';
      return `
      <tr>
        <td class="ds-rule-id"><strong>${escapeHtml(r.ruleId)}</strong></td>
        <td><span class="ds-category-chip" style="border-color:${catColor};color:${catColor}">${escapeHtml(r.category)}</span></td>
        <td class="ds-num ds-sev-error">${r.error || '-'}</td>
        <td class="ds-num ds-sev-warning">${r.warning || '-'}</td>
        <td class="ds-num ds-sev-hint">${r.hint || '-'}</td>
        <td class="ds-num ds-total-col">${r.total} (${pct}%)</td>
      </tr>`;
    })
    .join('');

  return `
  <section class="ds-section">
    <h2>Summary: Rule-wise Findings Count</h2>
    <table class="ds-table">
      <thead>
        <tr>
          <th>Rule ID</th>
          <th>Category</th>
          <th>Errors</th>
          <th>Warnings</th>
          <th>Hints</th>
          <th>Total Count</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderFileSummaryTable(result: AnalysisResult, byFile: Map<string, Finding[]>): string {
  const filesList = result.filesAnalyzed.length > 0 ? result.filesAnalyzed : Array.from(byFile.keys());
  if (filesList.length === 0) {
    return `
  <section class="ds-section">
    <h2>File Summary</h2>
    <p class="ds-empty-state">No findings — nice and clean workspace.</p>
  </section>`;
  }

  const rows = filesList
    .map((file) => {
      const findings = byFile.get(file) || [];
      const counts = countBySeverity(findings);
      const loc = result.fileDetails?.[file]?.lineCount ?? 0;
      return { file, findings, counts, loc };
    })
    .sort((a, b) => b.findings.length - a.findings.length || b.loc - a.loc)
    .map(({ file, findings, counts, loc }) => `
      <tr>
        <td class="ds-file-cell" title="${escapeHtml(file)}">${escapeHtml(shortenPath(file))}</td>
        <td class="ds-num">${loc > 0 ? loc.toLocaleString() : '-'}</td>
        <td class="ds-num ds-sev-error">${counts.error || '-'}</td>
        <td class="ds-num ds-sev-warning">${counts.warning || '-'}</td>
        <td class="ds-num ds-sev-hint">${counts.hint || '-'}</td>
        <td class="ds-num ds-total-col">${findings.length > 0 ? findings.length : '<span style="color:#2a9d4f;font-weight:600">Clean</span>'}</td>
        <td>${findings.length > 0 ? `<a href="#file-${slugify(file)}">Jump to detail &rarr;</a>` : ''}</td>
      </tr>`)
    .join('');

  return `
  <section class="ds-section">
    <h2>File Summary (LOC & Findings)</h2>
    <table class="ds-table">
      <thead>
        <tr><th>File</th><th>LOC</th><th>Errors</th><th>Warnings</th><th>Hints</th><th>Total</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderFindingsSections(byFile: Map<string, Finding[]>): string {
  if (byFile.size === 0) return '';

  const sections = Array.from(byFile.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([file, findings]) => {
      const sorted = [...findings].sort((a, b) => a.line - b.line);
      const rows = sorted
        .map(
          (f) => `
      <tr>
        <td class="ds-num">${f.line}${f.column ? `:${f.column}` : ''}</td>
        <td><span class="ds-badge" style="color:${SEVERITY_META[f.severity].color};background:${SEVERITY_META[f.severity].bg}">${SEVERITY_META[f.severity].icon} ${SEVERITY_META[f.severity].label}</span></td>
        <td><span class="ds-category-chip" style="border-color:${CATEGORY_COLORS[f.category]};color:${CATEGORY_COLORS[f.category]}">${escapeHtml(f.category)}</span></td>
        <td class="ds-rule-id">${escapeHtml(f.ruleId)}</td>
        <td>${escapeHtml(f.message)}</td>
      </tr>`
        )
        .join('');

      return `
    <div class="ds-file-block" id="file-${slugify(file)}">
      <h3>${escapeHtml(shortenPath(file))} <span class="ds-file-fullpath">${escapeHtml(file)}</span></h3>
      <table class="ds-table ds-findings-table">
        <thead><tr><th>Line</th><th>Severity</th><th>Category</th><th>Rule</th><th>Message</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
    })
    .join('');

  return `
  <section class="ds-section">
    <h2>Detailed Findings</h2>
    ${sections}
  </section>`;
}

function renderFooter(meta: ReportMeta): string {
  return `
  <footer class="ds-footer">
    Generated by <strong>DelphiSense</strong> v${escapeHtml(meta.toolVersion)} — free, open Delphi code review for VS Code.
  </footer>`;
}

// ---------- helpers ----------

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, hint: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function countByCategoryDetails(findings: Finding[]): CategoryDetail[] {
  const map = new Map<FindingCategory, CategoryDetail>();
  for (const f of findings) {
    if (!map.has(f.category)) {
      map.set(f.category, { category: f.category, total: 0, error: 0, warning: 0, hint: 0 });
    }
    const entry = map.get(f.category)!;
    entry.total++;
    entry[f.severity]++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function countByRuleDetails(findings: Finding[]): RuleDetail[] {
  const map = new Map<string, RuleDetail>();
  for (const f of findings) {
    if (!map.has(f.ruleId)) {
      map.set(f.ruleId, { ruleId: f.ruleId, category: f.category, total: 0, error: 0, warning: 0, hint: 0 });
    }
    const entry = map.get(f.ruleId)!;
    entry.total++;
    entry[f.severity]++;
  }
  return Array.from(map.values());
}

function groupByFile(findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!map.has(f.file)) map.set(f.file, []);
    map.get(f.file)!.push(f);
  }
  return map;
}

/**
 * 0-100. Starts at 100 and subtracts a weighted penalty per severity,
 * normalized per 100 lines of code scanned (not per file) so small files
 * with a couple of hints aren't scored as harshly as a genuinely
 * problem-dense file of the same finding count.
 */
function computeQualityScore(result: AnalysisResult, counts: Record<Severity, number>): number {
  const linesPerHundred = Math.max(1, result.totalLines / 100);
  const weighted = counts.error * 5 + counts.warning * 2 + counts.hint * 0.5;
  const penalty = Math.min(100, weighted / linesPerHundred);
  return Math.max(0, Math.round(100 - penalty));
}

function shortenPath(file: string): string {
  const parts = file.split(/[\\/]/);
  return parts.slice(-2).join(path.sep);
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------- inline styles & script (kept self-contained — no CDN, offline-safe) ----------

const CSS = `
:root {
  --ds-bg: #f5f6f8;
  --ds-panel: #ffffff;
  --ds-border: #e2e5ea;
  --ds-text: #22262b;
  --ds-muted: #6b7280;
  --ds-accent: #2a6fb0;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  background: var(--ds-bg);
  color: var(--ds-text);
  line-height: 1.5;
}
.ds-container { max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }

.ds-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: var(--ds-panel);
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  padding: 24px 28px;
  margin-bottom: 24px;
}
.ds-header-left { display: flex; align-items: center; gap: 16px; }
.ds-logo {
  width: 48px; height: 48px; border-radius: 10px;
  background: linear-gradient(135deg, #2a6fb0, #1c4f80);
  color: white; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px; letter-spacing: 0.5px;
}
.ds-header h1 { margin: 0; font-size: 20px; }
.ds-subtitle { color: var(--ds-muted); font-size: 14px; margin-top: 2px; }
.ds-header-right { text-align: right; font-size: 13px; }
.ds-meta-row { display: flex; justify-content: space-between; gap: 16px; color: var(--ds-muted); }
.ds-meta-row strong { color: var(--ds-text); }

.ds-summary {
  display: grid;
  grid-template-columns: 140px repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}
.ds-score-card {
  background: var(--ds-panel);
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 12px;
}
.ds-score-ring {
  --score: 100;
  width: 72px; height: 72px; border-radius: 50%;
  background: conic-gradient(#2a9d4f calc(var(--score) * 1%), #e6e8eb 0);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px;
}
.ds-score-ring span {
  background: var(--ds-panel); width: 54px; height: 54px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.ds-score-label { font-size: 12px; color: var(--ds-muted); margin-top: 8px; }
.ds-stat-card {
  background: var(--ds-panel);
  border: 1px solid var(--ds-border);
  border-top: 3px solid var(--ds-accent);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.ds-stat-total { border-top-color: #333; }
.ds-stat-value { font-size: 26px; font-weight: 700; }
.ds-stat-label { font-size: 12px; color: var(--ds-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }

.ds-section {
  background: var(--ds-panel);
  border: 1px solid var(--ds-border);
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 20px;
}
.ds-section h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ds-muted); margin: 0 0 16px; }

.ds-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.ds-cat-card {
  background: #fafafa;
  border: 1px solid var(--ds-border);
  border-left: 4px solid var(--ds-accent);
  border-radius: 8px;
  padding: 12px 14px;
}
.ds-cat-header { display: flex; justify-content: space-between; align-items: center; }
.ds-cat-title { font-weight: 700; font-size: 14px; }
.ds-cat-count { font-weight: 600; font-size: 12.5px; color: var(--ds-muted); }
.ds-cat-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.ds-mini-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: #eef0f3; }

.ds-bars { display: flex; flex-direction: column; gap: 10px; }
.ds-bar-row { display: grid; grid-template-columns: 140px 1fr 40px; align-items: center; gap: 10px; font-size: 13px; }
.ds-bar-track { background: #eef0f3; border-radius: 6px; height: 10px; overflow: hidden; }
.ds-bar-fill { height: 100%; border-radius: 6px; }
.ds-bar-count { text-align: right; font-weight: 600; }

.ds-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ds-table th {
  text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
  color: var(--ds-muted); border-bottom: 2px solid var(--ds-border); padding: 8px 10px;
}
.ds-table td { padding: 9px 10px; border-bottom: 1px solid var(--ds-border); vertical-align: top; }
.ds-table tr:hover td { background: #fafbfc; }
.ds-num { font-variant-numeric: tabular-nums; }
.ds-file-cell { font-family: 'SF Mono', Consolas, monospace; font-size: 12.5px; }
.ds-total-col { font-weight: 700; }
.ds-sev-error { color: ${SEVERITY_META.error.color}; font-weight: 600; }
.ds-sev-warning { color: ${SEVERITY_META.warning.color}; font-weight: 600; }
.ds-sev-hint { color: ${SEVERITY_META.hint.color}; font-weight: 600; }

.ds-badge {
  display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap;
}
.ds-category-chip {
  display: inline-block; padding: 1px 8px; border: 1px solid; border-radius: 5px; font-size: 11px; font-weight: 600;
}
.ds-rule-id { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; color: var(--ds-muted); }

.ds-file-block { margin-top: 22px; }
.ds-file-block h3 { font-size: 14px; margin: 0 0 8px; font-family: 'SF Mono', Consolas, monospace; }
.ds-file-fullpath { font-family: -apple-system, Segoe UI, sans-serif; font-weight: 400; font-size: 11px; color: var(--ds-muted); margin-left: 8px; }
.ds-findings-table { margin-bottom: 4px; }

.ds-empty-state { color: var(--ds-muted); font-style: italic; }

.ds-footer { text-align: center; color: var(--ds-muted); font-size: 12px; margin-top: 32px; }

@media print {
  body { background: white; }
  .ds-section, .ds-header, .ds-stat-card, .ds-score-card { border: 1px solid #ccc; }
}
`;

const JS = ``; // no client-side scripting needed — report is fully static and print-friendly
