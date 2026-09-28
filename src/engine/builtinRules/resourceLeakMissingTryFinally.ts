import { Rule, ParsedUnit, RuleContext, Finding, makeFinding } from '../model';

/**
 * Flags creation of disposable Delphi objects (e.g., `VarName := TStringList.Create`)
 * inside routines where no `try ... finally ... Free` protection block is present.
 * Memory leaks from missing `try ... finally` blocks are a common Delphi bug.
 */
export const resourceLeakMissingTryFinallyRule: Rule = {
  id: 'resourceLeakMissingTryFinally',
  description: 'Creation of disposable object without try...finally protection block.',
  category: 'Bug',
  defaultSeverity: 'warning',

  check(unit: ParsedUnit, ctx: RuleContext): Finding[] {
    if (ctx.config.disabledRules.includes(this.id)) return [];
    const findings: Finding[] = [];
    const lines = unit.lines;

    for (const routine of unit.routines) {
      const startIdx = routine.bodyStartLine - 1;
      const endIdx = routine.bodyEndLine - 1;

      for (let i = startIdx; i <= endIdx; i++) {
        const line = lines[i];
        // Match `VarName := TClassName.Create...`
        const createMatch = line.match(/\b([A-Za-z_]\w*)\s*:=\s*T[A-Z]\w*\.Create\b/i);
        if (!createMatch) continue;

        const varName = createMatch[1];
        // Skip common singletons or factory methods that shouldn't be freed immediately
        if (/^(Application|Screen|Printer|Self)$/i.test(varName)) continue;

        // Scan ahead within the routine to check if `try` appears shortly after
        let protectedByTry = false;
        let freedByFinally = false;

        for (let j = i + 1; j <= Math.min(i + 25, endIdx); j++) {
          const aheadLine = lines[j].trim();
          if (/^\btry\b/i.test(aheadLine)) {
            protectedByTry = true;
          }
          if (protectedByTry && (aheadLine.includes(`${varName}.Free`) || aheadLine.includes(`FreeAndNil(${varName})`))) {
            freedByFinally = true;
            break;
          }
          // If another routine boundary or end is reached
          if (/^\bend\b/i.test(aheadLine) && !protectedByTry) {
            break;
          }
        }

        if (!protectedByTry || !freedByFinally) {
          findings.push(
            makeFinding(
              this,
              this.defaultSeverity,
              `Object '${varName}' created via '.Create' on line ${i + 1} appears to lack a 'try ... finally ${varName}.Free; end' protection block.`,
              unit.filePath,
              i + 1
            )
          );
        }
      }
    }

    return findings;
  },
};
