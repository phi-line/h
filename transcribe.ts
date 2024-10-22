import '@std/dotenv/load';
import { walk } from '@std/fs/walk';

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

export interface Utterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  id: string;
}

export type DeepgramResponse = {
  metadata: {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
    model_info: {
      [key: string]: {
        name: string;
        version: string;
        arch: string;
      };
    };
  };
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
        words: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    }>;
    utterances: Array<Utterance>;
  };
};

export async function getTranscriptionFromDeepgram(
  audioFilePath: string,
): Promise<DeepgramResponse> {
  const audioFile = await Deno.readFile(audioFilePath);
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?multichannel=true&utterances=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav',
      },
      body: audioFile,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get transcription: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

async function main() {
  try {
    let results: { [key: string]: DeepgramResponse } = {};

    try {
      const fileInfo = Deno.statSync('graph/run3.json');
      if (fileInfo.isFile) {
        const data = Deno.readFileSync('graph/run3.json');
        results = JSON.parse(new TextDecoder().decode(data));
        console.log('Results loaded from graph/run3.json');
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        for await (const entry of walk('snippets/run3')) {
          if (entry.isFile && entry.name.endsWith('.wav')) {
            const audioFilePath = entry.path;
            console.log(audioFilePath);
            const pathParts = audioFilePath.split('/');
            const uniqueId = pathParts[pathParts.length - 2];
            results[uniqueId] = await getTranscriptionFromDeepgram(
              audioFilePath,
            );
          }
        }
        const resultsJson = JSON.stringify(results, null, 2);
        Deno.mkdirSync('graph', { recursive: true });
        Deno.writeFileSync(
          'graph/run3.json',
          new TextEncoder().encode(resultsJson),
        );
        console.log('Results saved to graph/run3.json');
      } else {
        throw error;
      }
    }

    const utterances = Object.values(results).flatMap(
      (result) => result.results.utterances,
    );

    console.log('Utterances:', utterances);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

if (import.meta.main) {
  main();
}
