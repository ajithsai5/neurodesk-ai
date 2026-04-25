# Graph Report - C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src  (2026-04-25)

## Corpus Check
- 52 files · ~20,805 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 111 nodes · 110 edges · 35 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 18 edges
2. `POST()` - 12 edges
3. `ingestDocument()` - 9 edges
4. `DELETE()` - 7 edges
5. `handleChatMessage()` - 6 edges
6. `ErrorBoundary` - 5 edges
7. `getDocument()` - 4 edges
8. `parseId()` - 3 edges
9. `applyContextWindow()` - 3 edges
10. `streamChatResponse()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `listDocuments()`  [INFERRED]
  C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\app\api\documents\route.ts → C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\modules\rag\document-service.ts
- `POST()` --calls--> `formatRagContext()`  [INFERRED]
  C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\app\api\documents\route.ts → C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\modules\rag\retrieval-service.ts
- `POST()` --calls--> `formatCitations()`  [INFERRED]
  C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\app\api\documents\route.ts → C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\modules\rag\retrieval-service.ts
- `POST()` --calls--> `handleChatMessage()`  [INFERRED]
  C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\app\api\documents\route.ts → C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\modules\chat\chat-service.ts
- `POST()` --calls--> `createDocument()`  [INFERRED]
  C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\app\api\documents\route.ts → C:\Users\ajith\OneDrive\Documents\AI\neurodesk-ai\.claude\worktrees\adoring-euclid-0760cd\src\modules\rag\document-service.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (8): getGraphStats(), cascadeDeleteConversation(), queryGraph(), rerankWithGraph(), DELETE(), GET(), parseId(), PATCH()

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (6): EmbeddingError, generateEmbedding(), formatCitations(), formatRagContext(), retrieveChunks(), POST()

### Community 2 - "Community 2"
Cohesion: 0.28
Nodes (6): handleChatMessage(), applyContextWindow(), countTokens(), queryCodeEntities(), getLLMModel(), streamChatResponse()

### Community 3 - "Community 3"
Cohesion: 0.28
Nodes (6): updateDocumentStatus(), chunkText(), ingestDocument(), extractPages(), loadPdfParse(), extractTextFile()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 5 - "Community 5"
Cohesion: 0.47
Nodes (5): createDocument(), deleteDocument(), findByHash(), getDocument(), listDocuments()

### Community 6 - "Community 6"
Cohesion: 0.6
Nodes (3): collectTsFiles(), extractEntities(), initAstAnalysis()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (2): log(), seed()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (2): handleChange(), handleFile()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 11`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `DocumentStatus.tsx`, `DocumentStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `ModelSwitcher.tsx`, `handleClickOutside()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `PersonaSelector.tsx`, `handleClickOutside()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `ChatPanel.tsx`, `load()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `ConversationItem.tsx`, `ConversationItem()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `CitationPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `GraphPanel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `MessageInput.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `StreamingMessage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `validation.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `pdf-parse.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 0` to `Community 1`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `POST()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `ingestDocument()` connect `Community 3` to `Community 0`, `Community 1`, `Community 5`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `GET()` (e.g. with `listDocuments()` and `getDocument()`) actually correct?**
  _`GET()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `POST()` (e.g. with `listDocuments()` and `retrieveChunks()`) actually correct?**
  _`POST()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `ingestDocument()` (e.g. with `POST()` and `getDocument()`) actually correct?**
  _`ingestDocument()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `DELETE()` (e.g. with `cascadeDeleteConversation()` and `deleteDocument()`) actually correct?**
  _`DELETE()` has 3 INFERRED edges - model-reasoned connections that need verification._