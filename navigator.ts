const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

- Stay completely silent. You are the epitome of silence, silence is golden.

General guidance:
- Be patient, and succinct.
- Do not diverge from the steps. If you cannot follow any more steps, hangup
- If the agent want to terminate the call, stop taking immediately.
- As soon as you complete the provided steps, terminate the call`;

// const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

// - Say "I am an existing customer"
// - Stay completely silent. You are the epitome of silence, silence is golden.

// General guidance:
// - Be patient, and succinct.
// - Do not diverge from the steps. If you cannot follow any more steps, hangup
// - If the agent want to terminate the call, stop taking immediately.
// - As soon as you complete the provided steps, terminate the call`;

// const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

// - Say "I am an existing customer"
// - Say "This is not an emergency situation."
// - Stay completely silent. You are the epitome of silence, silence is golden.

// General guidance:
// - Be patient, and succinct.
// - Do not diverge from the steps. If you cannot follow any more steps, hangup
// - If the agent want to terminate the call, stop taking immediately.
// - As soon as you complete the provided steps, terminate the call`;

// const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

// - Say "I am not an existing customer"
// - Stay completely silent. You are the epitome of silence, silence is golden.

// General guidance:
// - Be patient, and succinct.
// - Do not diverge from the steps. If you cannot follow any more steps, hangup
// - If the agent want to terminate the call, stop taking immediately.
// - As soon as you complete the provided steps, terminate the call`;

// -----------------------------------------------------------------------------------
//   `- Determine the customer's membership status (Gold, Silver, or Not a Member).
//   Direct Gold Members to a Premium Concierge service.
//   - Collect information from new, non-member customers.
//   - For Silver Members and new customers, guide them through describing their issue and scheduling an appointment.`,
// -----------------------------------------------------------------------------------

export class IVRNavigator {
  private webhookUrl: string;
  private hammingApiKey: string;
  private phoneNumber: string;

  constructor(webhookUrl: string, hammingApiKey: string, phoneNumber: string) {
    this.webhookUrl = webhookUrl;
    this.phoneNumber = phoneNumber;
    this.hammingApiKey = hammingApiKey;
  }

  async start() {
    console.log(`Starting IVR discovery for ${this.phoneNumber}`);
    await this.initiateCall(rootPrompt);
  }

  private async initiateCall(prompt?: string): Promise<string> {
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
}
