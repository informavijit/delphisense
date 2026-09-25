import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { analyzeFiles } from './engine/ruleEngine';
import { DelphiSenseConfig } from './engine/model';
import { AnalysisTarget, resolveTargetFiles } from './target';
import { generateHtmlReport } from './report';
import { publishDiagnostics, getDiagnosticCollection } from './diagnostics';
import { EXAMPLE_CUSTOM_RULES_FILE } from './engine/customRules';

const EXTENSION_VERSION = '1.0.0';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(getDiagnosticCollection());

  context.subscriptions.push(
    vscode.commands.registerCommand('delphisense.analyzeFile', (uri?: vscode.Uri) =>
      handleAnalyzeFile(uri)
    ),
    vscode.commands.registerCommand('delphisense.analyzeFolder', (uri?: vscode.Uri) =>
      handleAnalyzeFolder(uri)
    ),
    vscode.commands.registerCommand('delphisense.analyzeDpr', (uri?: vscode.Uri) =>
      handleAnalyzeDpr(uri)
    ),
    vscode.commands.registerCommand('delphisense.analyzeWorkspace', () => handleAnalyzeWorkspace())
  );
}

export function deactivate() {
  // no background resources held — nothing to tear down
}

// ---------- command handlers ----------

async function handleAnalyzeFile(uri?: vscode.Uri) {
  const filePath = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!filePath) {
    vscode.window.showWarningMessage('DelphiSense: open or select a .pas file first.');
    return;
  }
  if (!filePath.toLowerCase().endsWith('.pas')) {
    vscode.window.showWarningMessage('DelphiSense: the active/selected file is not a .pas file.');
    return;
  }

  const target: AnalysisTarget = {
    kind: 'file',
    label: path.basename(filePath),
    rootPath: filePath,
  };
  await runAnalysisWithProgress(target);
}

async function handleAnalyzeFolder(uri?: vscode.Uri) {
  let folderPath = uri?.fsPath;

  if (!folderPath) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Analyze Folder',
    });
    folderPath = picked?.[0]?.fsPath;
  }

  if (!folderPath) return;

  const target: AnalysisTarget = {
    kind: 'folder',
    label: path.basename(folderPath) || folderPath,
    rootPath: folderPath,
  };
  await runAnalysisWithProgress(target);
}

async function handleAnalyzeDpr(uri?: vscode.Uri) {
  let dprPath = uri?.fsPath;

  if (!dprPath) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'Delphi Project': ['dpr', 'dpk'] },
      openLabel: 'Analyze Project',
    });
    dprPath = picked?.[0]?.fsPath;
  }

  if (!dprPath) return;

  const target: AnalysisTarget = {
    kind: 'dpr',
    label: path.basename(dprPath),
    rootPath: dprPath,
  };
  await runAnalysisWithProgress(target);
}

async function handleAnalyzeWorkspace() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('DelphiSense: no folder is open in this workspace.');
    return;
  }

  // MVP: analyze the first workspace folder. Multi-root aggregation is a
  // reasonable fast-follow once the single-root path is proven out.
  const root = folders[0].uri.fsPath;
  const target: AnalysisTarget = {
    kind: 'workspace',
    label: folders.length > 1 ? `${path.basename(root)} (workspace)` : path.basename(root),
    rootPath: root,
  };
  await runAnalysisWithProgress(target);
}

// ---------- shared analysis + report pipeline ----------

async function runAnalysisWithProgress(target: AnalysisTarget) {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DelphiSense: analyzing ${target.label}`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Resolving files…' });
      const files = resolveTargetFiles(target);

      if (files.length === 0) {
        vscode.window.showInformationMessage(`DelphiSense: no .pas files found for ${target.label}.`);
        return;
      }

      progress.report({ message: `Scanning ${files.length} file(s)…` });

      const config = readConfig();
      const customRulesFilePath = resolveCustomRulesPath();

      const result = analyzeFiles(files, { config, customRulesFilePath });

      progress.report({ message: 'Publishing diagnostics…' });
      publishDiagnostics(result.findings);

      progress.report({ message: 'Generating report…' });
      const html = generateHtmlReport(result, {
        generatedAt: new Date(),
        target,
        toolVersion: EXTENSION_VERSION,
      });

      const reportPath = writeReportToTemp(html, target);
      await showReportPanel(html, reportPath, target);

      const summary = summarizeCounts(result);
      vscode.window
        .showInformationMessage(`DelphiSense: ${summary} in ${result.unitsAnalyzed} file(s).`, 'Save Report As…')
        .then((choice) => {
          if (choice === 'Save Report As…') saveReportAs(reportPath);
        });
    }
  );
}

function readConfig(): DelphiSenseConfig {
  const cfg = vscode.workspace.getConfiguration('delphisense');
  return {
    longMethodMaxLines: cfg.get<number>('longMethod.maxLines', 60),
    deepNestingMaxDepth: cfg.get<number>('deepNesting.maxDepth', 4),
    maxLineLength: cfg.get<number>('maxLineLength.max', 120),
    disabledRules: cfg.get<string[]>('rules.disabled', []),
  };
}

function resolveCustomRulesPath(): string | undefined {
  const cfg = vscode.workspace.getConfiguration('delphisense');
  const relPath = cfg.get<string>('customRulesPath', '.delphisense/rules.json');
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;

  const candidate = path.join(folders[0].uri.fsPath, relPath);
  return fs.existsSync(candidate) ? candidate : undefined;
}

function summarizeCounts(result: { findings: { severity: string }[] }): string {
  const errors = result.findings.filter((f) => f.severity === 'error').length;
  const warnings = result.findings.filter((f) => f.severity === 'warning').length;
  const hints = result.findings.filter((f) => f.severity === 'hint').length;
  return `${errors} error(s), ${warnings} warning(s), ${hints} hint(s)`;
}

function writeReportToTemp(html: string, target: AnalysisTarget): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delphisense-'));
  const safeName = target.label.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(dir, `DelphiSense-Report-${safeName}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
}

async function showReportPanel(html: string, reportPath: string, target: AnalysisTarget) {
  const panel = vscode.window.createWebviewPanel(
    'delphisenseReport',
    `DelphiSense Report — ${target.label}`,
    vscode.ViewColumn.Active,
    { enableScripts: false, retainContextWhenHidden: true }
  );
  panel.webview.html = html;

  // Offer a save-as affordance any time the panel regains focus is
  // overkill; the primary save path is the information-message button
  // in runAnalysisWithProgress. Nothing further needed here.
  void reportPath;
}

async function saveReportAs(sourcePath: string) {
  const defaultName = path.basename(sourcePath);
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(os.homedir(), defaultName)),
    filters: { 'HTML Report': ['html'] },
    saveLabel: 'Save DelphiSense Report',
  });
  if (!target) return;

  fs.copyFileSync(sourcePath, target.fsPath);
  const openChoice = await vscode.window.showInformationMessage(
    `DelphiSense: report saved to ${target.fsPath}`,
    'Open in Browser'
  );
  if (openChoice === 'Open in Browser') {
    vscode.env.openExternal(target);
  }
}

// Exported for potential reuse by a future CLI wrapper around the same engine.
export { EXAMPLE_CUSTOM_RULES_FILE };
