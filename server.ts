/**
 * @fileoverview This module implements a DFS approach to navigate phone trees.
 * It handles the start of a navigation process, and processes recordings notifications
 * via webhooks. It runs inference on those recordings to decide the next steps in the
 * discovery process.
 *
 * @module recording
 */
import '@std/dotenv/load';

import { IVRNavigator } from './navigator.ts';
import { analyzeAudioRecording } from './inference.ts';

const WEBHOOK_URL = Deno.env.get('WEBHOOK_URL');
const HAMMING_API_KEY = Deno.env.get('HAMMING_API_KEY');

if (!WEBHOOK_URL || !HAMMING_API_KEY) {
  throw new Error(
    'Missing required environment variables: WEBHOOK_URL and/or HAMMING_API_KEY',
  );
}

let navigator: IVRNavigator;

/**
 * Represents a request from the recording webhook.
 * @interface
 */
interface RecordingWebhookRequest {
  /** The unique identifier for the recording. */
  id: string;
  /** The status of the webhook event. */
  status: string;
  /** Indicates if the recording is available. */
  recording_available: boolean;
}

/**
 * Represents a request to navigate.
 * @interface
 */
interface NavigateRequest {
  /** The phone number to navigate. */
  phoneNumber: string;
  /** The pre-prompt for the agent. */
  agentPrePrompt: string;
}

/**
 * Handles incoming HTTP requests and routes them to the appropriate handler.
 *
 * @param {Request} req - The incoming HTTP request.
 * @returns {Promise<Response>} The HTTP response.
 */
async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/navigate' && req.method === 'POST') {
    const body = (await req.json()) as NavigateRequest;
    const { phoneNumber, agentPrePrompt } = body;

    if (!phoneNumber) {
      return new Response('Missing phoneNumber', {
        status: 400,
      });
    }

    navigator = new IVRNavigator(
      WEBHOOK_URL!,
      HAMMING_API_KEY!,
      phoneNumber,
      agentPrePrompt,
    );
    navigator.start().catch(console.error);

    return new Response('IVR navigation started', { status: 200 });
  }

  if (url.pathname === '/webhook' && req.method === 'POST') {
    const body = (await req.json()) as RecordingWebhookRequest;
    console.debug('Received webhook:', body);

    switch (body.status) {
      case 'event_phone_call_connected':
        break;
      case 'event_phone_call_ended':
        break;
      case 'event_recording':
        if (body.recording_available) {
          console.log(`Recording available for ID: ${body.id}`);
          let audioFilePath;
          try {
            audioFilePath = await navigator.downloadRecording(body.id);
          } catch (error) {
            console.error(`Error downloading recording: ${error}`);
            break;
          }

          const inferenceResult = await analyzeAudioRecording(
            audioFilePath,
            navigator.agentPrePrompt,
          );
          console.log('Got inference result', inferenceResult);

          if (inferenceResult) {
            await navigator.processInferenceResult(inferenceResult, body.id);
          } else {
            await navigator.exploreNextPath();
          }
        } else {
          console.log(`Recording not available for ID: ${body.id}`);
        }
        break;
      default:
        console.log(`Unhandled webhook status: ${body.status}`);
    }

    return new Response('OK', { status: 200 });
  }

  return new Response('Not Found', { status: 404 });
}

if (import.meta.main) {
  Deno.serve(router);
}
