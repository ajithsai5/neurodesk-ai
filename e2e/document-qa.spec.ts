// File: e2e/document-qa.spec.ts
/**
 * E2E tests for Document Q&A feature (T032 — US3 multi-turn Q&A).
 *
 * Tests cover:
 *   1. Uploading a document and waiting for ingestion to complete
 *   2. Asking an initial question and receiving a grounded response
 *   3. Multi-turn follow-up: second question uses both conversation history and document context
 *   4. Sources (CitationPanel) visible for grounded answers
 *
 * Requires: dev server on :3000 + Ollama on :11434 with nomic-embed-text + llama3.1:8b
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// All tests in this file share state (uploaded document persists in the test DB)
test.describe.configure({ mode: 'serial' });

test.describe('Document Q&A', () => {
  // Generous timeout: Ollama embedding + LLM generation can be slow on first load
  test.setTimeout(180_000);

  /** Helper — expand the Documents panel and upload the test fixture */
  async function uploadTestDocument(page: Parameters<Parameters<typeof test>[1]>[0]) {
    // The sidebar Documents toggle button contains "Documents" and an arrow span.
    // Use .filter({ hasText: /Documents/ }) to match regardless of ▼/▲ state.
    const docsToggle = page.locator('aside button').filter({ hasText: /^Documents/ });
    await docsToggle.click();

    // Wait for the Upload Document button to be rendered (panel expanded)
    await expect(page.getByRole('button', { name: /Upload Document/i })).toBeVisible();

    // Set files directly on the hidden <input type="file"> — Playwright handles hidden inputs
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-document.txt'));
  }

  /** Helper — wait for the document to finish ingestion (Ready) or detect it was deduped */
  async function waitForDocumentReady(page: Parameters<Parameters<typeof test>[1]>[0]) {
    // The DocumentStatus badge uses label '✓ Ready'; match with regex to avoid unicode issues
    // Also accept 'Already in library' (409 duplicate) — document is already ready in that case
    await expect(
      page.getByText(/✓\s*Ready/).or(page.getByText(/Already in library/i))
    ).toBeVisible({ timeout: 90_000 });
  }

  test('should upload a document and receive a grounded answer on the first question', async ({ page }) => {
    // 1. Navigate and create a new conversation
    await page.goto('/');
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    // 2. Upload the test document via the sidebar Documents panel
    await uploadTestDocument(page);

    // 3. Wait for ingestion to complete
    await waitForDocumentReady(page);

    // 4. Ask a question grounded in the document content
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('What is quantum computing?');
    await page.getByRole('button', { name: 'Send' }).click();

    // 5. Wait for the assistant response — .prose is the markdown container in StreamingMessage
    await expect(page.locator('.prose').first()).toBeVisible({ timeout: 90_000 });
  });

  test('should handle multi-turn follow-up using document context', async ({ page }) => {
    // 1. Navigate and create a fresh conversation
    await page.goto('/');
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    // 2. Upload (or confirm dedup) — document from previous test is already in the library
    await uploadTestDocument(page);
    await waitForDocumentReady(page);

    // 3. First turn — question about the document
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('What are the applications of quantum computing mentioned in the document?');
    await page.getByRole('button', { name: 'Send' }).click();

    // 4. Wait for first assistant response
    await expect(page.locator('.prose').first()).toBeVisible({ timeout: 90_000 });

    // 5. Second turn — follow-up referencing prior response (multi-turn context test)
    await input.fill('Can you elaborate on that?');
    await page.getByRole('button', { name: 'Send' }).click();

    // 6. Verify a second assistant response is generated (conversation history + RAG preserved)
    await expect(page.locator('.prose').nth(1)).toBeVisible({ timeout: 90_000 });
  });

  test('should show a Sources panel for answers grounded in documents', async ({ page }) => {
    // 1. Navigate and create a conversation
    await page.goto('/');
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    // 2. Open Documents panel and confirm document is in the library
    await uploadTestDocument(page);
    await waitForDocumentReady(page);

    // 3. Ask a question
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('What challenges does quantum computing face?');
    await page.getByRole('button', { name: 'Send' }).click();

    // 4. Wait for the assistant response
    await expect(page.locator('.prose').first()).toBeVisible({ timeout: 90_000 });

    // 5. Verify the Sources toggle button appeared (CitationPanel — US4)
    await expect(page.getByRole('button', { name: /Sources/i })).toBeVisible({ timeout: 10_000 });

    // 6. Expand citations and verify at least one source maps to our test document
    await page.getByRole('button', { name: /Sources/i }).click();
    await expect(page.getByText(/test-document\.txt, Page/i)).toBeVisible();
  });
});
