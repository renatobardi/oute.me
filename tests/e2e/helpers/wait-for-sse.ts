import type { Page, Response } from '@playwright/test';

/**
 * Intercepts SSE responses and collects events.
 *
 * Usage:
 *   const events = await waitForSSEEvents(page, '/api/chat/*\/message', async () => {
 *     await page.click('#send-message');
 *   });
 *   expect(events.some(e => e.type === 'done')).toBe(true);
 */
export interface SSEEvent {
  type: string;
  data: unknown;
}

export async function waitForSSEEvents(
  page: Page,
  urlPattern: string | RegExp,
  triggerAction: () => Promise<void>,
  options: { timeout?: number; waitForDone?: boolean } = {}
): Promise<SSEEvent[]> {
  const { timeout = 30000, waitForDone = true } = options;

  const events: SSEEvent[] = [];

  // Set up response interception
  const responsePromise = page.waitForResponse(
    (response: Response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );

  // Trigger the action that initiates SSE
  await triggerAction();

  const response = await responsePromise;

  // Parse SSE stream from response body
  const body = await response.text();
  const lines = body.split('\n');

  for (const line of lines) {
    if (line.startsWith('data:')) {
      try {
        const data = JSON.parse(line.slice(5).trim());
        events.push({
          type: data.type || data.event || 'unknown',
          data,
        });
      } catch {
        // Non-JSON data line
        events.push({ type: 'raw', data: line.slice(5).trim() });
      }
    }
  }

  return events;
}

/**
 * Wait for a specific SSE event type with content matching.
 */
export async function waitForSSEEvent(
  page: Page,
  urlPattern: string | RegExp,
  eventType: string,
  triggerAction: () => Promise<void>,
  timeout = 30000
): Promise<SSEEvent | undefined> {
  const events = await waitForSSEEvents(page, urlPattern, triggerAction, {
    timeout,
    waitForDone: false,
  });

  return events.find((e) => e.type === eventType);
}
