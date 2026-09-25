# DelphiSense

**Free, lightweight code-review and static-analysis extension for Embarcadero Delphi / Object Pascal — works on any Delphi version, no configuration required.**

DelphiSense scans your Delphi source and flags common code-quality and correctness issues — unused units, overly long methods, silently swallowed exceptions, unreachable code, deep nesting, and TODO markers — directly in the editor (Problems panel + squiggles), and generates a polished, shareable HTML report in the style of classic tools like Pascal Analyzer.

It ships as a single, self-contained VS Code extension: no external services, no background processes, no required internet connection.

## Features

- **Analyze at any scope** — a single `.pas` file, a folder, a whole `.dpr`/`.dpk` project, or the entire workspace.
- **Inline diagnostics** — findings show up as squiggles in the editor and in the Problems panel, same as any built-in linter.
- **Professional HTML report** — a self-contained, downloadable report with a quality score, severity/category breakdowns, a per-file summary table, and full findings detail — easy to attach to a PR, email, or code-review ticket.
- **Works on any Delphi version** — the analyzer is a version-agnostic structural scanner, not tied to a specific compiler release. It degrades gracefully on syntax it doesn't fully recognize rather than failing the whole file.
- **Extensible with your own rules** — drop a `.delphisense/rules.json` file in your workspace to add project-specific pattern checks (e.g. "flag hardcoded connection strings") with no coding required.

## Built-in checks (v0.1)

| Rule | What it flags |
|---|---|
| `unusedUses` | A unit listed in `uses` but never referenced in the file |
| `longMethod` | A procedure/function body longer than the configured max (default 60 lines) |
| `emptyExceptFinally` | An empty `except` (silently swallowed exception) or empty `finally` block |
| `deadCodeAfterExit` | A statement that can never execute after `Exit`/`raise`/`Abort` |
| `deepNesting` | Control-flow nesting deeper than the configured max (default 4) |
| `todoComment` | `TODO` / `FIXME` / `HACK` / `XXX` markers in comments |
| `longLine` | Lines longer than the configured max (default 120 chars) |

More checks (cyclomatic complexity, cross-references, memory-leak detection) are planned for a future release once the full grammar parser lands — see Roadmap below.

## Usage

Run any of these from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), or right-click a file/folder in the Explorer:

- **DelphiSense: Analyze Current File**
- **DelphiSense: Analyze Folder...**
- **DelphiSense: Analyze Project (.dpr/.dpk)...**
- **DelphiSense: Analyze Workspace**

Each run opens an HTML report in a panel and offers a **Save Report As…** button to download it anywhere on disk.

## Adding your own rules

Create `.delphisense/rules.json` in your workspace root:

```json
{
  "rules": [
    {
      "id": "noHardcodedConnStr",
      "pattern": "Password\\s*=",
      "message": "Possible hardcoded password in a connection string.",
      "severity": "error"
    },
    {
      "id": "noShowMessageInLoop",
      "pattern": "ShowMessage\\s*\\(",
      "message": "Avoid ShowMessage in production code paths — prefer logging.",
      "severity": "hint"
    }
  ]
}
```

Each rule is a regular expression run line-by-line — no code execution, so it's safe to share and version-control alongside your project.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `delphisense.longMethod.maxLines` | `60` | Max body lines before `longMethod` fires |
| `delphisense.deepNesting.maxDepth` | `4` | Max nesting depth before `deepNesting` fires |
| `delphisense.maxLineLength.max` | `120` | Max line length before `longLine` fires |
| `delphisense.rules.disabled` | `[]` | Rule IDs to turn off, e.g. `["unusedUses"]` |
| `delphisense.customRulesPath` | `.delphisense/rules.json` | Workspace-relative path to your custom rules file |

## How it works

DelphiSense uses a lightweight, single-pass structural scanner rather than a full compiler-grade AST parser. It extracts the structural facts each rule needs — the `uses` clause, routine boundaries, comments — while tolerating unfamiliar syntax gracefully. This is what lets it work uniformly across Delphi 7 through the latest RAD Studio release without version-specific configuration.

## Roadmap

- Full recursive-descent AST parser (cyclomatic complexity, call graphs, cross-references)
- CSV/JSON export alongside HTML
- Standalone CLI sharing the same analysis engine, for CI/pre-commit use
- DFM form-file analysis

## License

MIT — free for personal and commercial use.
