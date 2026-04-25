// File: src/modules/graph/ast-analysis.ts
/**
 * AST Analysis — extracts CODE_ENTITY nodes from TypeScript source files.
 *
 * Uses the TypeScript compiler API (already a devDependency) to walk the AST
 * of every .ts/.tsx file in src/ and emit CODE_ENTITY nodes to the graph store.
 *
 * Best-effort: the entire analysis is wrapped in a try/catch so that any
 * failure (missing tsconfig, syntax error, DB unavailable) only emits a
 * warning and lets the application start normally. (Why: FR-017b)
 *
 * This module is NOT imported by the runtime hot path — it is called once
 * during startup via initAstAnalysis() and should complete in < 500ms for
 * a typical Next.js project.
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../shared/db';
import { logger } from '../shared/logger';
import type { CodeEntity } from './types';

/** Entry point called once on application startup (best-effort). */
export async function initAstAnalysis(): Promise<void> {
  try {
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) {
      logger.warn('[AstAnalysis] src/ directory not found — skipping');
      return;
    }

    const files = collectTsFiles(srcDir);
    if (files.length === 0) {
      logger.warn('[AstAnalysis] No .ts/.tsx files found in src/ — skipping');
      return;
    }

    const program = ts.createProgram(files, {
      allowJs: false,
      noEmit: true,
      skipLibCheck: true,
    });

    const entities: CodeEntity[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      // Only analyse files within src/ — skip node_modules and .d.ts files
      if (
        sourceFile.isDeclarationFile ||
        sourceFile.fileName.includes('node_modules')
      ) {
        continue;
      }
      extractEntities(sourceFile, entities);
    }

    if (entities.length === 0) {
      logger.warn('[AstAnalysis] No CODE_ENTITY nodes extracted from src/');
      return;
    }

    // Upsert all extracted entities into graph_nodes
    const now = Date.now();
    for (const entity of entities) {
      db.insert(schema.graphNodes)
        .values({
          id: uuidv4(),
          conversationId: null, // CODE_ENTITY nodes are not conversation-scoped
          sessionId: 'ast-analysis',
          type: 'CODE_ENTITY',
          label: entity.name,
          properties: JSON.stringify({
            kind: entity.kind,
            filePath: entity.filePath,
            lineStart: entity.lineStart,
            lineEnd: entity.lineEnd,
          }),
          createdAt: now,
        })
        .run();
    }

    logger.warn(`[AstAnalysis] Wrote ${entities.length} CODE_ENTITY nodes`);
  } catch (err) {
    // Best-effort: warn and continue — never block startup
    logger.warn('[AstAnalysis] AST analysis failed (degraded)', { err: String(err) });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect all .ts and .tsx files under a directory. */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.(tsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/** Walk an AST and push function/class/interface/import declarations to entities[]. */
function extractEntities(sourceFile: ts.SourceFile, entities: CodeEntity[]): void {
  const relPath = path.relative(process.cwd(), sourceFile.fileName).replace(/\\/g, '/');

  function visit(node: ts.Node): void {
    let entity: CodeEntity | null = null;

    if (ts.isFunctionDeclaration(node) && node.name) {
      entity = makeEntity(node.name.text, 'function', relPath, sourceFile, node);
    } else if (ts.isArrowFunction(node)) {
      // Arrow function assigned to a variable: `const foo = () => {}`
      const parent = node.parent;
      if (
        ts.isVariableDeclaration(parent) &&
        ts.isIdentifier(parent.name)
      ) {
        entity = makeEntity(parent.name.text, 'function', relPath, sourceFile, node);
      }
    } else if (ts.isClassDeclaration(node) && node.name) {
      entity = makeEntity(node.name.text, 'class', relPath, sourceFile, node);
    } else if (ts.isInterfaceDeclaration(node)) {
      entity = makeEntity(node.name.text, 'interface', relPath, sourceFile, node);
    } else if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        entity = makeEntity(specifier.text, 'import', relPath, sourceFile, node);
      }
    }

    if (entity) entities.push(entity);
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
}

function makeEntity(
  name: string,
  kind: CodeEntity['kind'],
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.Node
): CodeEntity {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    name,
    kind,
    filePath,
    lineStart: start.line + 1,
    lineEnd: end.line + 1,
  };
}
