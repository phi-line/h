import { IVRTree } from './ivrTree.ts';

export class IVRNavigator {
  private webhookUrl: string;
  private hammingApiKey: string;
  private phoneNumber: string;
  private tree: IVRTree;
  private currentPath: string[];

  constructor(webhookUrl: string, hammingApiKey: string, phoneNumber: string) {
    this.webhookUrl = webhookUrl;
    this.phoneNumber = phoneNumber;
    this.hammingApiKey = hammingApiKey;
    this.tree = new IVRTree();
    this.currentPath = [];
  }

  async start() {
    console.log(`Starting IVR discovery for ${this.phoneNumber}`);
    await this.initiateCall();
  }

  private generatePrompt(): string {
    const steps = this.currentPath
      .reduce((acc, option, index) => {
        const node = this.tree.getNode(this.currentPath.slice(0, index));
        if (index === 0 || node.question !== acc[acc.length - 1].question) {
          acc.push({ question: node.question, answer: option });
        } else {
          acc[acc.length - 1].answer = option;
        }
        return acc;
      }, [] as { question: string; answer: string }[])
      .map(
        ({ question, answer }) =>
          `<question>"${question}"</question> <answer>"${answer}"</answer>`,
      );

    console.log(`Current path`, this.currentPath);

    const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You are not an assistant, you are a customer representative and do not generally ask questions. You will connect to an agent and follow the following steps:

    - Stay completely silent. You are the epitome of silence, silence is golden.

    General guidance:
    - Be patient, and succinct.
    - Do not diverge from the steps. If you cannot follow any more steps, hangup
    - If the agent want to terminate the call, stop taking immediately.
    - As soon as you complete the provided steps, terminate the call`;

    const prompt = steps.length
      ? `Your name is Angela Iverson - 1234 Bay Street Oakland, CA 94105

Here are the questions you know the answers to:

${steps.join('\n')}

General guidance:
- Be patient, and succinct.
- Do not diverge from the questions. If you don't know the answer to a question, say "goodbye"
- If the agent want to terminate the call, say "goodbye"`
      : rootPrompt;

    return prompt;
  }

  private async initiateCall(): Promise<string> {
    const prompt = this.generatePrompt();
    const body = {
      phone_number: this.phoneNumber,
      prompt,
      webhook_url: this.webhookUrl,
    };
    console.log(`Starting call`, body);
    const response = await fetch(
      'https://app.hamming.ai/api/rest/exercise/start-call',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.hammingApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to initiate call: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Got response from hamming', data);
    return data.id;
  }

  public async downloadRecording(id: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `snippets/${id}/${timestamp}.wav`;

    console.log(`Downloading recording for ID: ${id}`);
    const response = await fetch(
      `https://app.hamming.ai/api/media/exercise?id=${id}`,
      {
        headers: {
          Authorization: `Bearer ${this.hammingApiKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    await Deno.mkdir(`snippets/${id}`, { recursive: true });
    await Deno.writeFile(fileName, uint8Array);

    console.log(`Recording saved to ${fileName}`);
    return fileName;
  }

  public async processInferenceResult(
    result: {
      question: string;
      options: string[];
    },
    callId: string,
  ) {
    this.tree.addNode(
      this.currentPath,
      result.question,
      result.options,
      callId,
    );
    console.log('Updated IVR tree:');
    this.tree.print();
    this.tree.exportToJson(this.phoneNumber);

    await this.exploreNextPath();
  }

  public async exploreNextPath() {
    const nextPath = this.tree.getNextUnexploredPath();
    if (nextPath) {
      this.currentPath = nextPath;
      await this.initiateCall();
    } else {
      console.log('IVR discovery complete. All paths explored.');
    }
  }
}
