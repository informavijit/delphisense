import * as vscode from 'vscode';
import { Finding, Severity } from './engine/model';

let diagnosticCollection: vscode.DiagnosticCollection | undefined;

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  if (!diagnosticCollection) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('delphisense');
  }
  return diagnosticCollection;
}

export function publishDiagnostics(findings: Finding[]) {
  const collection = getDiagnosticCollection();
  collection.clear();

  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(f);
  }

  for (const [file, fileFindings] of byFile) {
    const uri = vscode.Uri.file(file);
    const diagnostics = fileFindings.map((f) => toDiagnostic(f));
    collection.set(uri, diagnostics);
  }
}

function toDiagnostic(finding: Finding): vscode.Diagnostic {
  const startLine = Math.max(0, finding.line - 1);
  const startCol = Math.max(0, finding.column - 1);
  const endLine = finding.endLine ? Math.max(0, finding.endLine - 1) : startLine;
  const endCol = finding.endColumn ? Math.max(0, finding.endColumn - 1) : startCol + 1;

  const range = new vscode.Range(startLine, startCol, endLine, endCol);
  const diagnostic = new vscode.Diagnostic(range, finding.message, toVscodeSeverity(finding.severity));
  diagnostic.source = 'DelphiSense';
  diagnostic.code = finding.ruleId;
  return diagnostic;
}

function toVscodeSeverity(severity: Severity): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'hint':
      return vscode.DiagnosticSeverity.Hint;
  }
}
