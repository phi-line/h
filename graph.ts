import '@std/dotenv/load';
import { walk } from '@std/fs/walk';

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

interface Utterance {
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

type DeepgramResponse = {
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

async function getTranscriptionFromDeepgram(
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

interface GraphNode {
  utterance: Utterance;
  children: Map<string, GraphNode>;
  similarity?: number; // Similarity score with parent
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

function isYesResponse(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();
  return (
    normalized === 'yes' ||
    normalized === 'yeah' ||
    normalized === 'yea' ||
    normalized === 'correct'
  );
}

function isNoResponse(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();
  return normalized === 'no' || normalized === 'nope' || normalized === 'nah';
}

function createConversationGraph(utterances: Utterance[]): GraphNode | null {
  if (utterances.length === 0) return null;

  const SIMILARITY_THRESHOLD = 0.8;

  // Create root node from first utterance
  const root: GraphNode = {
    utterance: utterances[0],
    children: new Map(),
  };

  // Process remaining utterances
  for (let i = 1; i < utterances.length; i++) {
    const currentUtterance = utterances[i];
    let currentNode = root;
    let added = false;

    // Try to find a matching parent node
    const processNode = (node: GraphNode) => {
      if (added) return;

      // Check for yes/no responses first
      if (isYesResponse(currentUtterance.transcript)) {
        if (!node.children.has('yes')) {
          node.children.set('yes', {
            utterance: currentUtterance,
            children: new Map(),
            similarity: 1,
          });
          added = true;
        }
        return;
      }

      if (isNoResponse(currentUtterance.transcript)) {
        if (!node.children.has('no')) {
          node.children.set('no', {
            utterance: currentUtterance,
            children: new Map(),
            similarity: 1,
          });
          added = true;
        }
        return;
      }

      // Calculate similarity with current node
      const similarity = calculateSimilarity(
        node.utterance.transcript,
        currentUtterance.transcript,
      );

      // If similar enough, add as child
      if (similarity >= SIMILARITY_THRESHOLD) {
        const key = `similar_${node.children.size}`;
        node.children.set(key, {
          utterance: currentUtterance,
          children: new Map(),
          similarity,
        });
        added = true;
        return;
      }

      // Recursively check children
      for (const child of node.children.values()) {
        processNode(child);
      }
    };

    processNode(root);

    // If no match found, add as new root child
    if (!added) {
      const key = `unmatched_${root.children.size}`;
      root.children.set(key, {
        utterance: currentUtterance,
        children: new Map(),
        similarity: 0,
      });
    }
  }

  return root;
}

function printGraphNodeAsMermaid(
  node: GraphNode,
  nodeId: string = 'root',
): string {
  let mermaidSchema = `flowchart TD\n`;

  const traverse = (currentNode: GraphNode, currentId: string) => {
    for (const [key, childNode] of currentNode.children.entries()) {
      const childId = `${currentId}_${key}`;
      mermaidSchema += `    ${currentId} -->|${
        childNode.similarity?.toFixed(2) || '0.00'
      }| ${childId}[${childNode.utterance.transcript}]\n`;
      traverse(childNode, childId);
    }
  };

  mermaidSchema += `    ${nodeId}[${node.utterance.transcript}]\n`;
  traverse(node, nodeId);

  return mermaidSchema;
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

    // console.log('Utterances:', utterances);
    const node = await createConversationGraph(utterances);
    console.log(printGraphNodeAsMermaid(node!));
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

if (import.meta.main) {
  main();
}
