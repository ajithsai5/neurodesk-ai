// File: src/modules/graph/index.ts
// Public API for the graph module — re-exports from graph-client and graph-service.
// Pattern mirrors src/modules/chat/index.ts.

export {
  initGraphClient,
  getGraphStats,
} from './graph-client';

export {
  writeConversationNode,
  writeChunkNodes,
  queryGraph,
  queryCodeEntities,
  rerankWithGraph,
  cascadeDeleteConversation,
  // T079: F004 additions — cross-document edge builder and stopword set
  createCrossDocumentEdges,
  STOPWORDS,
} from './graph-service';

export type {
  GraphNode,
  GraphEdge,
  GraphQueryResult,
  GraphStats,
  GraphNodeType,
  GraphRelationship,
  CodeEntity,
} from './types';
