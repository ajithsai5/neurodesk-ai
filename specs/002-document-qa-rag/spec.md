# Feature Specification: Document Q&A (Mini RAG)

**Feature Branch**: `002-document-qa-rag`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "Upload any PDF and ask natural language questions about it. The system retrieves the most relevant sections and generates grounded answers with page-level source citations. Pipeline: PDF → text extraction → overlapping chunks → embeddings → vector store → similarity search → LLM answer with citations. Supports cloud LLMs (OpenAI, Azure OpenAI, Anthropic) and local LLMs (Ollama — `llama3.1:8b` for generation, `nomic-embed-text` for embeddings). Reuses the shared chat shell from Feature 01."

## Clarifications

### Session 2026-04-22

- Q: When the user switches LLM provider mid-conversation, how should the system handle the embedding model mismatch? → A: Fixed embedding model per conversation — chosen at first document upload, never changes even if the LLM provider switches.
- Q: Is this a single-user system, or must uploaded documents be isolated per authenticated user? → A: Single-user local tool — one user, no authentication required; all conversations and documents belong to that user.
- Q: When a user asks a question before any document is uploaded, what should happen? → A: Regular chat fallback — system answers from LLM knowledge with no document context; document Q&A activates automatically once a document is uploaded.
- Q: Are uploaded documents scoped to the conversation they were uploaded in, or accessible across all conversations? → A: User-global library — all uploaded documents are available across all conversations; any document from any past upload can be referenced from any conversation.
- Q: Can the user delete documents from the library? → A: Yes, with permanent deletion — user can remove a document; the file and its vector index are deleted.
- Q: What local vector store technology should be used to persist embeddings? → A: `sqlite-vec` (SQLite vector extension) — reuses the existing SQLite database file, keeping the stack minimal with zero new infrastructure.
- Q: What should happen when a user uploads a file that already exists in the library? → A: Deduplicate by content hash — if an identical file is already in the library, skip processing and notify the user; no duplicate entry is created.
- Q: What chunk size and overlap should the text splitter use? → A: 512 tokens per chunk, 64 token overlap — balanced for `nomic-embed-text` and prevents context loss at chunk boundaries.
- Q: When document processing fails, can the user retry in-place or must they re-upload? → A: No retry — system marks the document as `failed` with a visible error state; the user must delete the entry and re-upload the file.
- Q: How many chunks should be retrieved from the vector index per query? → A: Top 5 chunks — ~2,560 tokens of context, fits comfortably within `llama3.1:8b`'s 8K context window.

## User Scenarios & Testing

### User Story 1 - Upload a PDF and Ask a Question (Priority: P1)

A user uploads a PDF document to NeuroDesk AI and immediately asks a natural language question about its contents. The system extracts text from the PDF, finds the most relevant sections, and generates an answer grounded in the document with page-level source citations.

**Why this priority**: This is the core value proposition — users need to get accurate, cited answers from their documents. Without this, the feature has no utility.

**Independent Test**: Can be fully tested by uploading a single PDF, asking "What is the main topic of this document?", and verifying the answer references actual content with page numbers.

**Acceptance Scenarios**:

1. **Given** a user has an active conversation, **When** they upload a 10-page PDF, **Then** the system acknowledges the upload, processes the document, and confirms it is ready for questions within a reasonable time.
2. **Given** a PDF has been uploaded and processed, **When** the user asks "What does section 3 say about X?", **Then** the system returns an answer that quotes or paraphrases the relevant section with a citation like "[Page 5]".
3. **Given** a PDF has been uploaded and processed, **When** the user asks a question whose answer is not in the document, **Then** the system states that the information was not found in the uploaded document rather than hallucinating an answer.

---

### User Story 2 - Switch Between Cloud and Local LLM (Priority: P2)

A user who works with sensitive or confidential documents wants to use a local LLM (via Ollama) so that no data leaves their machine. Another user prefers cloud LLMs for higher quality answers. Both users can switch between providers in the UI.

**Why this priority**: Provider flexibility is essential for adoption — privacy-conscious users need local inference, while others want cloud model quality. Reuses the model switching infrastructure from Feature 01.

**Independent Test**: Can be tested by uploading a PDF, asking the same question with a cloud provider, then switching to a local Ollama model and asking again — both should return grounded answers.

**Acceptance Scenarios**:

1. **Given** the user has uploaded a document, **When** they select a local Ollama model from the model switcher, **Then** subsequent Q&A queries are processed entirely on the local machine with no external API calls.
2. **Given** the user is using a local model, **When** they switch to a cloud provider (OpenAI/Anthropic), **Then** subsequent queries use the cloud API and the document context is preserved.
3. **Given** Ollama is not running or not installed, **When** the user selects a local model, **Then** the system displays a clear error message explaining that the local model is unavailable.

---

### User Story 3 - Multi-Turn Q&A on the Same Document (Priority: P2)

A user uploads a document and asks a series of follow-up questions. The system maintains conversation context so the user can refer back to previous answers and drill deeper into specific sections.

**Why this priority**: Real document analysis requires iterative questioning. Users rarely get their answer in a single query — they refine, follow up, and cross-reference.

**Independent Test**: Can be tested by uploading a PDF, asking an initial question, then asking a follow-up like "Tell me more about that" and verifying the system uses both the document and prior conversation context.

**Acceptance Scenarios**:

1. **Given** a user has asked a question about an uploaded PDF and received an answer, **When** they ask "Can you elaborate on that?", **Then** the system understands "that" refers to the previous answer and provides more detail from the document.
2. **Given** a multi-turn conversation about a document, **When** the user asks a new unrelated question about the same document, **Then** the system retrieves fresh relevant sections rather than relying solely on prior conversation context.

---

### User Story 4 - View Source Citations (Priority: P3)

A user wants to verify the accuracy of an AI-generated answer by checking the original source sections. Citations in the answer link to or display the relevant passages from the document.

**Why this priority**: Citations build trust and allow verification. Without them, users cannot distinguish grounded answers from hallucinated ones.

**Independent Test**: Can be tested by asking a factual question about an uploaded PDF and verifying that the response includes page-level citations that match actual content in the document.

**Acceptance Scenarios**:

1. **Given** the system returns an answer with citations like "[Page 3]", **When** the user reviews the citation, **Then** they can see the source text passage that the answer was derived from.
2. **Given** an answer draws from multiple sections, **When** the system cites multiple pages, **Then** each citation correctly maps to the relevant passage in the document.

---

### User Story 5 - Upload Multiple File Formats (Priority: P3)

A user uploads documents in formats beyond PDF (e.g., plain text, Markdown). The system extracts and processes text from supported formats.

**Why this priority**: Expanding supported formats increases the feature's utility, but PDF is the most common format and the core requirement.

**Independent Test**: Can be tested by uploading a .txt file, asking a question, and verifying the system processes it the same way as a PDF.

**Acceptance Scenarios**:

1. **Given** a user uploads a .txt file, **When** processing completes, **Then** the user can ask questions and receive cited answers just like with a PDF.
2. **Given** a user uploads an unsupported file type (e.g., .xlsx), **When** the upload is attempted, **Then** the system rejects it with a message listing supported formats.

---

### Edge Cases

- What happens when a user uploads a file that is already in the library (identical content)?
  The system computes a SHA-256 hash on upload. If a matching hash is found, processing is skipped and the user sees "Document already in library." No duplicate entry or vector index entry is created.
- What happens when a user uploads an empty PDF (0 text content, only images)?
  The system informs the user that no extractable text was found and suggests uploading a text-based PDF.
- What happens when a user uploads a very large PDF (500+ pages)?
  The system enforces a file size and page count limit, rejecting documents that exceed the threshold with a clear error message.
- What happens when the user asks a question before any document is uploaded?
  The system responds with regular LLM chat behavior (no document context). Document Q&A activates automatically once at least one document has been successfully processed in the conversation. No "document mode" toggle is required.
- How does the system handle scanned PDFs (image-only, no selectable text)?
  v1 does not include OCR. The system detects image-only pages and informs the user that text extraction is not possible for scanned documents.
- What happens if the vector store or embedding service is unavailable?
  The system returns a user-friendly error indicating that document search is temporarily unavailable, without exposing internal details.
- What happens when document processing fails partway through (e.g., embedding error on chunk 47 of 200)?
  The system marks the document as `failed`, stores the error message (e.g., "Embedding failed: Ollama unreachable"), and displays it in the document library. No partial vector index is kept. The user must delete the failed entry and re-upload — there is no in-place retry.
- What happens when multiple documents exist in the user's library?
  The system searches across all documents in the library when answering questions, citing the document name and page number for each retrieved passage.

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept PDF file uploads from the user through the chat interface.
- **FR-002**: System MUST extract text content from uploaded PDFs while preserving page-level boundaries.
- **FR-003**: System MUST split extracted text into overlapping chunks of **512 tokens** with a **64-token overlap**, measured using the same `cl100k_base` tokenizer already used by the context window module.
- **FR-004**: System MUST generate vector embeddings for each text chunk and store them in a searchable index using `sqlite-vec` within the existing SQLite database (`data/neurodesk.db`).
- **FR-005**: When the user asks a question, the system MUST retrieve the top **5** most relevant chunks from the vector index using cosine similarity search and inject them into the LLM prompt as document context.
- **FR-006**: System MUST generate answers that are grounded in the retrieved document content, not general knowledge.
- **FR-007**: Every answer MUST include page-level source citations indicating where the information was found.
- **FR-008**: System MUST clearly state when a question cannot be answered from the uploaded document(s).
- **FR-009**: System MUST support switching between cloud LLM providers (OpenAI, Anthropic) and local LLM providers (Ollama) using the existing model switcher UI.
- **FR-010**: When a local LLM provider is selected, all processing MUST occur locally with no external API calls. Generation MUST use Ollama `llama3.1:8b`; embeddings MUST use Ollama `nomic-embed-text`.
- **FR-011**: System MUST maintain a user-global document library; all uploaded documents are accessible from any conversation without re-uploading.
- **FR-011a**: When answering a question, the system MUST search across all documents in the user's library and cite which document and page each retrieved passage comes from.
- **FR-012**: System MUST enforce file size limits and supported format validation on uploads.
- **FR-012a**: System MUST compute a content hash (SHA-256) for each uploaded file. If a file with the same hash already exists in the library, the upload MUST be rejected with a user-facing notice ("Document already in library") and no duplicate entry or vector index is created.
- **FR-013**: System MUST support at minimum PDF and plain text (.txt) file formats.
- **FR-014**: System MUST persist uploaded documents and their vector indices so they survive page refreshes and server restarts.
- **FR-015**: System MUST integrate with the existing conversation and chat infrastructure from Feature 01.
- **FR-016**: The embedding model used to index a conversation's documents MUST remain fixed for the lifetime of that conversation; switching LLM providers MUST NOT trigger re-embedding or invalidate the existing vector index.
- **FR-017**: When no document has been uploaded to a conversation, the system MUST respond to user messages using standard LLM chat behavior (no document retrieval). Document Q&A MUST activate automatically once at least one document has been successfully processed.
- **FR-018**: Users MUST be able to permanently delete a document from the library. Deletion MUST remove both the stored file and its vector index from disk.

### Key Entities

- **Document**: An uploaded file stored in the user's global document library, accessible from all conversations. Key attributes: original filename, file format, file size, page count, processing status (pending/ready/failed), upload timestamp, SHA-256 content hash (unique, used for deduplication), error message (populated on failure). Lifecycle: pending → ready (on successful processing) or failed (on error, with error message displayed); permanently deleted on user request (file and vector index removed). No in-place retry — user must delete a failed entry and re-upload.
- **Document Chunk**: A segment of extracted text from a document. Key attributes: text content, page number, chunk position, parent document reference.
- **Chunk Embedding**: A vector representation of a document chunk stored in the search index. Key attributes: vector data, reference to source chunk.
- **Citation**: A reference linking an answer passage to a specific document chunk. Key attributes: document name, page number, source text excerpt.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can upload a PDF and receive their first cited answer within 60 seconds for documents under 50 pages.
- **SC-002**: 95% of answers to questions that are answerable from the document include at least one accurate page-level citation.
- **SC-003**: When asked about information not in the document, the system correctly declines to answer (rather than hallucinating) at least 90% of the time.
- **SC-004**: Users can switch between cloud and local LLM providers and continue querying the same document without re-uploading or re-processing.
- **SC-005**: The system supports documents up to 200 pages and 50 MB in size without failure.
- **SC-006**: Local LLM mode (Ollama) generates answers with zero external network calls, verifiable by network monitoring.
- **SC-007**: Multi-turn follow-up questions correctly reference prior conversation context at least 85% of the time.

## Assumptions

- This is a single-user local tool — no user authentication is required, and all conversations and documents belong to a single operator. Multi-user isolation is out of scope for v1.
- Users have a modern web browser with file upload support (drag-and-drop or file picker).
- PDF documents contain selectable text (not scanned images). OCR support is out of scope for v1.
- Users running local LLMs have Ollama installed with `llama3.1:8b` pulled for generation and `nomic-embed-text` pulled for embeddings. Local Ollama model files are stored at `G:\Ollama\Model`.
- The existing chat interface and conversation model from Feature 01 will be extended, not replaced.
- The embedding model used to index a conversation's documents is chosen at the time of first upload and remains fixed for that conversation's lifetime, regardless of subsequent LLM provider switches.
- Local embeddings use Ollama's `nomic-embed-text` model. When only cloud providers are configured, embeddings use the cloud provider's embedding API (e.g., OpenAI embeddings).
- File storage for uploaded documents uses the local filesystem (not cloud storage) in v1.
- The vector index is stored locally using `sqlite-vec` (SQLite vector extension) within the same database file (`data/neurodesk.db`) — no separate vector database process or infrastructure required.
- Documents are stored in a user-global library and are accessible from any conversation without re-uploading.
- Text chunking uses 512-token chunks with 64-token overlap, tokenized with `cl100k_base` (reusing `js-tiktoken` already in the project).
- Retrieval returns the top 5 chunks per query (~2,560 tokens), leaving sufficient headroom in `llama3.1:8b`'s 8K context window for conversation history and system prompt.
- Maximum concurrent document processing is 1 document at a time in v1.
- Azure OpenAI support follows the same interface as standard OpenAI (compatible SDK).
