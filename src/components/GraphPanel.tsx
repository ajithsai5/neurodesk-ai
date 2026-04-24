'use client';
// File: src/components/GraphPanel.tsx
/**
 * GraphPanel Component (FR-018)
 *
 * Renders the conversation knowledge graph using react-force-graph-2d.
 * - Fetches GET /api/graph/query on mount and after each new message.
 * - Shows an empty-state message when no graph data is available.
 * - Handles fetch errors with an inline error message (never throws).
 *
 * (Why: FR-018 requires a visual graph panel so users can see how their
 * conversation messages and RAG chunks are connected in the knowledge graph)
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D to avoid SSR issues (canvas is browser-only)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphPanelProps {
  /** The active conversation ID — used to scope graph queries. */
  conversationId?: string;
  /** Incremented by the parent after each new message to trigger a re-fetch. */
  messageVersion?: number;
}

export function GraphPanel({ conversationId, messageVersion }: GraphPanelProps) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(
      `/api/graph/query?conversationId=${encodeURIComponent(conversationId)}&q=&limit=100`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Graph query failed: ${res.status}`);
        return res.json() as Promise<GraphData>;
      })
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return; // ignore cancelled requests
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [conversationId, messageVersion]);

  // Adapt graph data to the format expected by react-force-graph-2d
  const forceGraphData = {
    nodes: graphData.nodes.map((n) => ({ id: n.id, name: n.label, type: n.type })),
    links: graphData.edges.map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      label: e.relationship,
    })),
  };

  if (error) {
    return (
      <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
        Graph unavailable: {error}
      </div>
    );
  }

  if (!conversationId || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        No graph data yet — start a conversation
      </div>
    );
  }

  return (
    <div className="w-full h-full" aria-label="Knowledge graph visualization">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 text-sm text-gray-400">
          Loading graph…
        </div>
      )}
      <ForceGraph2D
        graphData={forceGraphData}
        nodeLabel="name"
        nodeAutoColorBy="type"
        linkLabel="label"
        width={400}
        height={300}
      />
    </div>
  );
}

export default GraphPanel;
