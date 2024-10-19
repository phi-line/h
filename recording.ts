/**
 * @fileoverview This module handles the recording webhook endpoint and processes incoming recording requests.
 * It defines the structure of the webhook request, sets up a URL pattern for matching,
 * and implements a handler function to process the requests and log the received data.
 *
 * @module recording
 */

interface RecordingWebhookRequest {
  id: string;
  status: string;
  recording_available: boolean;
}

const RECORDING_WEBHOOK_URL = new URLPattern({ pathname: '/recording' });

async function handler(req: Request): Promise<Response> {
  const match = RECORDING_WEBHOOK_URL.exec(req.url);

  console.log(req);

  if (match) {
    if (req.body) {
      const body = (await req.json()) as RecordingWebhookRequest;
      console.log('Body:', body);
    }
  }

  return new Response('Not found', {
    status: 404,
  });
}

Deno.serve(handler);
