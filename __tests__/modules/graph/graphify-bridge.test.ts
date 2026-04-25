// File: __tests__/modules/graph/graphify-bridge.test.ts
/**
 * Graphify Bridge tests — verify the on-disk → in-memory loader degrades gracefully
 * for the three failure modes (missing file, malformed JSON, empty/null query) and
 * returns useful matches when a real graph.json fixture is present.
 *
 * (Why these specific cases: FR-038 mandates graceful degradation, and the bridge
 *  is the only thing standing between a missing/corrupt graph.json and a chat-service
 *  500 — every error path needs explicit coverage.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  loadGraphifyIndex,
  queryGraphifyEntities,
  resetGraphifyCache,
} from '@/modules/graph/graphify-bridge';

// Build a tmp dir per test so concurrent runs don't collide
function makeFixtureDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-bridge-test-'));
  return dir;
}

function writeGraph(dir: string, json: unknown): void {
  fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(json), 'utf-8');
}

const sampleGraph = {
  directed: false,
  multigraph: false,
  graph: {},
  nodes: [
    {
      label: 'handleChatMessage()',
      file_type: 'code',
      source_file: path.join(process.cwd(), 'src', 'modules', 'chat', 'chat-service.ts'),
      source_location: 'L25',
      id: 'chat_service_handle',
      community: 1,
      norm_label: 'handlechatmessage()',
    },
    {
      label: 'route.ts',
      file_type: 'code',
      source_file: path.join(process.cwd(), 'src', 'app', 'api', 'chat', 'route.ts'),
      source_location: 'L1',
      id: 'route_chat',
      community: 1,
      norm_label: 'route.ts',
    },
    {
      // non-code node — should be filtered out of query results
      label: 'README.md',
      file_type: 'doc',
      source_file: path.join(process.cwd(), 'README.md'),
      source_location: 'L1',
      id: 'readme',
      community: 2,
      norm_label: 'readme.md',
    },
  ],
};

describe('graphify-bridge', () => {
  let tmpDir: string;
  const originalEnv = process.env.GRAPHIFY_OUT_DIR;

  beforeEach(() => {
    tmpDir = makeFixtureDir();
    process.env.GRAPHIFY_OUT_DIR = tmpDir;
    resetGraphifyCache();
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.GRAPHIFY_OUT_DIR;
    else process.env.GRAPHIFY_OUT_DIR = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns null when graph.json is missing (file-not-found degradation)', () => {
    expect(loadGraphifyIndex()).toBeNull();
  });

  it('returns [] from queryGraphifyEntities when graph.json is missing', () => {
    expect(queryGraphifyEntities('anything')).toEqual([]);
  });

  it('returns null when graph.json contains malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'graph.json'), '{not json{', 'utf-8');
    expect(loadGraphifyIndex()).toBeNull();
  });

  it('returns null when graph.json is missing the nodes[] array', () => {
    writeGraph(tmpDir, { directed: false, nodes: 'oops' });
    expect(loadGraphifyIndex()).toBeNull();
  });

  it('returns null when graph.json parses to null', () => {
    fs.writeFileSync(path.join(tmpDir, 'graph.json'), 'null', 'utf-8');
    expect(loadGraphifyIndex()).toBeNull();
  });

  it('caches the loaded graph (second call does not re-read the file)', () => {
    writeGraph(tmpDir, sampleGraph);
    const first = loadGraphifyIndex();
    expect(first).not.toBeNull();

    // Mutate the file on disk — cached value must NOT change
    writeGraph(tmpDir, { ...sampleGraph, nodes: [] });
    const second = loadGraphifyIndex();
    expect(second).toBe(first);
  });

  it('resetGraphifyCache forces a fresh load', () => {
    writeGraph(tmpDir, sampleGraph);
    const first = loadGraphifyIndex();
    expect(first?.nodes.length).toBe(3);

    writeGraph(tmpDir, { ...sampleGraph, nodes: [] });
    resetGraphifyCache();
    const second = loadGraphifyIndex();
    expect(second?.nodes.length).toBe(0);
  });

  it('returns [] for empty or whitespace-only queries', () => {
    writeGraph(tmpDir, sampleGraph);
    expect(queryGraphifyEntities('')).toEqual([]);
    expect(queryGraphifyEntities('   ')).toEqual([]);
  });

  it('matches code nodes by case-insensitive substring on norm_label', () => {
    writeGraph(tmpDir, sampleGraph);
    const matches = queryGraphifyEntities('handleChatMessage');
    expect(matches.length).toBe(1);
    expect(matches[0].label).toBe('handleChatMessage()');
    // file path is normalised to repo-relative
    expect(matches[0].filePath).toMatch(/^src\/modules\/chat\/chat-service\.ts$/);
    expect(matches[0].location).toBe('L25');
    expect(matches[0].community).toBe(1);
  });

  it('filters out non-code nodes (docs, images, etc.)', () => {
    writeGraph(tmpDir, sampleGraph);
    // README.md is file_type "doc" — must not appear even though norm_label matches
    const matches = queryGraphifyEntities('readme');
    expect(matches).toEqual([]);
  });

  it('respects the limit parameter (default 5, capped lower when fewer matches exist)', () => {
    // Build a graph with 10 matching nodes; ensure default limit of 5 trims
    const manyNodes = Array.from({ length: 10 }, (_, i) => ({
      label: `helper${i}()`,
      file_type: 'code',
      source_file: path.join(process.cwd(), 'src', 'helpers.ts'),
      source_location: `L${i}`,
      id: `helper_${i}`,
      community: 0,
      norm_label: `helper${i}()`,
    }));
    writeGraph(tmpDir, { ...sampleGraph, nodes: manyNodes });
    expect(queryGraphifyEntities('helper').length).toBe(5);
    expect(queryGraphifyEntities('helper', 3).length).toBe(3);
  });

  it('matches when the user query is itself a substring of the node label (reverse match)', () => {
    writeGraph(tmpDir, sampleGraph);
    // Query "route.ts" exactly == node norm_label — both forward and reverse includes pass
    const matches = queryGraphifyEntities('route.ts');
    expect(matches.some((m) => m.label === 'route.ts')).toBe(true);
  });

  it('keeps absolute paths intact when they fall outside cwd', () => {
    const outsideNode = {
      label: 'external.ts',
      file_type: 'code',
      source_file: 'D:\\elsewhere\\external.ts',
      source_location: 'L1',
      id: 'external',
      community: 9,
      norm_label: 'external.ts',
    };
    writeGraph(tmpDir, { ...sampleGraph, nodes: [outsideNode] });
    const matches = queryGraphifyEntities('external');
    expect(matches[0].filePath).toBe('D:/elsewhere/external.ts');
  });
});
