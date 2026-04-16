import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the landing state', async ({ page }) => {
    await expect(page.getByText('NeuroDesk AI')).toBeVisible();
    await expect(page.getByText('Select a conversation or start a new one')).toBeVisible();
  });

  test('should create a new conversation', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    // Should show the chat panel with input
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();
  });

  test('should show persona selector and model switcher in chat', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    // Persona selector should be visible
    await expect(page.getByText('Select Persona').or(page.getByText('General Assistant'))).toBeVisible();
    // Model switcher should be visible
    await expect(page.getByText('Select Model').or(page.getByText('GPT-4o'))).toBeVisible();
  });

  test('should show character counter in message input', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('Hello world');
    await expect(page.getByText('11/10,000')).toBeVisible();
  });

  test('should prevent sending empty messages', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    const sendButton = page.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeDisabled();
  });

  test('should show conversation in sidebar after creation', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Conversation' }).click();
    await expect(page.getByText('New Conversation')).toBeVisible();
  });
});
