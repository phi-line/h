import { assertEquals } from '@std/assert';

const serverUrl = 'http://localhost:8000';

Deno.test('Navigate Endpoint Test', async () => {
  // Can be any information needed to navigate the IVR tree effectively
  const agentPrePrompt = `Your name is Angela Iverson - 1234 Bay Street Oakland, CA 94105. You have a plumbing issue.`;

  const navigateResponse = await fetch(`${serverUrl}/navigate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber: '+14153580761',
      agentPrePrompt,
    }),
  });

  assertEquals(navigateResponse.status, 200);
  assertEquals(await navigateResponse.text(), 'IVR navigation started');

  console.log('Navigation process initiated successfully');
});
