import '@std/dotenv/load';
import openai from 'npm:openai@4.68.1';
import { DOMParser, Element } from 'jsr:@b-fuze/deno-dom';
import { encodeBase64 } from '@std/encoding/base64';

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

function generateScriptFromUtterances(utterances: Utterance[]): string {
  //   console.log(utterances);
  const scriptContent = utterances
    .map((utterance) => {
      const speaker = utterance.channel === 0 ? 'agent' : 'customer';
      return `<${speaker}>${utterance.transcript}</${speaker}>`;
    })
    .join('\n');

  return `<script>\n${scriptContent}\n</script>`;
}

function createInferencePrompt(memory: string): string {
  return `Your Memory:
-  ${memory}

Goal:
- Your first goal is to identify the last unanswered question asked by the IVR phone line. If the <customer> responded, We shouldn't count it and return an empty <res> block
- Your second goal should be to generate the possible answers to that question. If the answer is free-form, try to use the overall context of the call to think of some options. If it asks for information, be sure to leverage "Your Memory"
- The output should be the question, followed by two or more XML bounded options <res> <ques></ques> <opt>Option 1</opt> <opt>Option 2</opt> <opt>Option 3</opt> </res>

General guidance:
- Be as concise as possible.
- Always try to give a definite answer to a "yes" or "no" question. Avoid "I don't know" or other flimsy responses.
- If nothing happened, simply return an empty <res> block.
- If the agent and the customer had a full conversation, return an empty <res> block
- Format your result as a series of XML tags <res> <ques></ques> <opt></opt> <opt></opt> </res>`;
}

interface parsedInference {
  question: string;
  options: string[];
}

function parseXmlToJson(xmlString: string): parsedInference | null {
  const xmlContentCleaned = xmlString
    .replace(/[\s\S]*?(<res>[\s\S]*?<\/res>)[\s\S]*/i, '$1')
    .trim();

  const xmlContentStripped = xmlContentCleaned.replace(/>\s+</g, '><');

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContentStripped, 'text/html');

  const resElement = xmlDoc.querySelector('res');
  if (!resElement) return null;

  const questionElement = resElement.querySelector('ques');
  const optionElements = resElement.querySelectorAll('opt');

  if (!questionElement) return null;

  const question = questionElement.textContent || '';
  const options = Array.from(optionElements)
    .map((el) => (el as Element).textContent || '')
    .filter(Boolean);

  return {
    question,
    options,
  };
}

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

export async function analyzeAudioRecording(
  audioFilePath: string,
): Promise<parsedInference | null> {
  const transcription = await getTranscriptionFromDeepgram(audioFilePath);

  let memory = '';
  memory +=
    '-  Your name is is Angela Iverson - 1234 Bay Street Oakland, CA 94105. You are inquiring about the services provided by this phone line. This is a pre-recorded call between you and an IVR phone line. You have been provided a <script></script> of lines between <agent></agent> and <customer></customer> Please reference this script for your accurate inference';

  const { utterances } = transcription.results;
  const script = generateScriptFromUtterances(utterances);

  memory += '\n' + script;

  const prompt = createInferencePrompt(memory);
  console.log(prompt);

  const client = new openai.OpenAI();

  const audioFile = await Deno.readFile(audioFilePath);
  const base64str = encodeBase64(audioFile);

  const response = await client.chat.completions.create({
    model: 'gpt-4o-audio-preview',
    modalities: ['text'],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'input_audio',
            input_audio: { data: base64str, format: 'wav' },
          },
        ],
      },
    ],
    // response_format: { type: 'json_object' },
  });

  const xmlContent = response.choices[0].message.content;
  if (!xmlContent) {
    console.log('No content in the response');
    return null;
  }

  return parseXmlToJson(xmlContent);
}

async function main() {
  try {
    // const audioFilePath = './example_snippets/existing_customer_not_an_emergency.wav';
    const audioFilePath = './example_snippets/root.wav';
    const result = await analyzeAudioRecording(audioFilePath);
    console.log(result);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

if (import.meta.main) {
  main();
}
