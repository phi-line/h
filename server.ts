/**
 * @fileoverview This module implements a DFS approach to navigate phone trees.
 * It handles the start of a navigation process, and handles the recordings requests
 * via webhooks.
 *
 * @module recording
 */

import { IVRNavigator } from './navigator.ts';

let WEBHOOK_URL: string;
let HAMMING_API_KEY: string;
let navigator: IVRNavigator;

interface RecordingWebhookRequest {
  id: string;
  status: string;
  recording_available: boolean;
}

interface NavigateRequest {
  phoneNumber: string;
}

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/navigate' && req.method === 'POST') {
    const body = (await req.json()) as NavigateRequest;
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return new Response('Missing phoneNumber', {
        status: 400,
      });
    }

    navigator = new IVRNavigator(WEBHOOK_URL, HAMMING_API_KEY, phoneNumber);
    navigator.start().catch(console.error);

    return new Response('IVR navigation started', { status: 200 });
  }

  if (url.pathname === '/webhook' && req.method === 'POST') {
    const body = (await req.json()) as RecordingWebhookRequest;
    console.debug('Received webhook:', body);
    return new Response('OK', { status: 200 });
  }

  return new Response('Not Found', { status: 404 });
}

if (import.meta.main) {
  const args = Deno.args;
  if (
    args.length < 4 ||
    args[0] !== '--webhook' ||
    args[2] !== '--hamming-api-key'
  ) {
    console.error(
      'Usage: deno run navigate --webhook <webhook-url> --hamming-api-key <api-key>',
    );
    Deno.exit(1);
  }

  WEBHOOK_URL = args[1];
  HAMMING_API_KEY = args[3];
  console.log(`Webhook URL set to: ${WEBHOOK_URL}`);
  console.log(`Hamming API Key set`);

  Deno.serve(router);
}
