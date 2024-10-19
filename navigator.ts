// const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

// 1. Stay completely silent. You are the epitome of silence, silence is golden.

// General guidance:
// - Be patient, and succinct.
// - Do not diverge from the steps. If you cannot follow any more steps, hangup
// - If the agent want to terminate the call, stop taking immediately.
// - As soon as you complete the provided steps, terminate the call`;

// const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

// 1. Say "I am an existing customer"
// 2. Stay completely silent. You are the epitome of silence, silence is golden.

// General guidance:
// - Be patient, and succinct.
// - Do not diverge from the steps. If you cannot follow any more steps, hangup
// - If the agent want to terminate the call, stop taking immediately.
// - As soon as you complete the provided steps, terminate the call`;

const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

1. Say "I am an existing customer"
2. Say "This is not an emergency situation."
3. Stay completely silent. You are the epitome of silence, silence is golden.

General guidance:
- Be patient, and succinct.
- Do not diverge from the steps. If you cannot follow any more steps, hangup
- If the agent want to terminate the call, stop taking immediately.
- As soon as you complete the provided steps, terminate the call`;

// const rootPrompt = `Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

// 1. Say "I am not an existing customer"
// 2. Stay completely silent. You are the epitome of silence, silence is golden.

// General guidance:
// - Be patient, and succinct.
// - Do not diverge from the steps. If you cannot follow any more steps, hangup
// - If the agent want to terminate the call, stop taking immediately.
// - As soon as you complete the provided steps, terminate the call`;

//   `- Determine the customer's membership status (Gold, Silver, or Not a Member).
//   Direct Gold Members to a Premium Concierge service.
//   - Collect information from new, non-member customers.
//   - For Silver Members and new customers, guide them through describing their issue and scheduling an appointment.`,

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
}
