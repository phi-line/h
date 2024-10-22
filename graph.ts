import '@std/dotenv/load';
import { walk } from '@std/fs/walk';

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

async function getTranscriptionFromDeepgram(
  audioFilePath: string,
): Promise<object> {
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

// async function testMain() {
//   try {
//     const audioFilePath =
//       './example_snippets/existing_customer_not_an_emergency.wav';
//     // const audioFilePath = './example_snippets/root.wav';
//     const result = await getTranscriptionFromDeepgram(audioFilePath);
//     console.log(result);
//   } catch (error) {
//     console.error('Error in main function:', error);
//   }
// }

async function main() {
  try {
    const results: { [key: string]: object } = {};
    for await (const entry of walk('snippets/run3')) {
      if (entry.isFile && entry.name.endsWith('.wav')) {
        const audioFilePath = entry.path;
        console.log(audioFilePath);
        const pathParts = audioFilePath.split('/');
        const uniqueId = pathParts[pathParts.length - 2];
        results[uniqueId] = await getTranscriptionFromDeepgram(audioFilePath);
      }
    }
    const resultsJson = JSON.stringify(results, null, 2);
    Deno.mkdirSync('graph', { recursive: true });
    Deno.writeFileSync(
      'graph/run3.json',
      new TextEncoder().encode(resultsJson),
    );
    console.log('Results saved to graph/run3.json');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

if (import.meta.main) {
  main();
}
