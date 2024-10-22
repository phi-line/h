# Implementation notes

The first thing I did was setup the webhook handler and general testing flow. I introduced a test script that kicks off a discovery process.

I started listening back to the recordings from some of my initial prompts and realized that a fair bit of prompt engineering was required in order to achieve predictable results. Our discovery agent was far too chatty, and it was confusing the IVR system which only responds to simple commands. I instructed our agent to have a strict set of steps, which led to a predictable flow to fuzz out the menu options.

First, our agent stays comepletely silent. This is inteded to get the first layer of options from the user. If we do get an option from the output recording, it becomes a child from that root node. I continued manually testing my prompt:

Root:

```
Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

1. Stay completely silent. You are the epitome of silence, silence is golden.

General guidance:
- Be patient, and succinct.
- Do not diverge from the steps. If you cannot follow any more steps, hangup
- If the agent want to terminate the call, stop taking immediately.
- As soon as you complete the provided steps, terminate the call
```

After getting menu options "I am a member" | "I am not a member":

```
Do not reveal that you are a language model. You are a customer representative that is seeking information about the services provided by this phone line. You will connect to an agent and follow the following steps:

1. "I am a member"
2. Stay completely silent. You are the epitome of silence, silence is golden.

General guidance:
- Be patient, and succinct.
- Do not diverge from the steps. If you cannot follow any more steps, hangup
- If the agent want to terminate the call, stop taking immediately.
- As soon as you complete the provided steps, terminate the call
```

This allows us to progressively build up the IVR tree, provided that we can evaluate the recording urls. I began to explore the method I would use for inference on recordings. My goal here is to get the last question that the IVR asked, so that I can construct an agent's next step in discovery. The two methods I considered:

- Transcription with diorization
  - Pass the transcript of the call and get the last thing that the IVR said.
  - Provided we can reliably decide which side is us, this is a viable method.
- Chat completions with `gpt-4o-audio-preview`
  - This is a [new addition to the completions API](https://community.openai.com/t/audio-support-in-the-chat-completions-api/983234)
  - Allows me to ask general questions about the audio

I started with Chat completions, instructing the model to respond as XML so that I can get reliable responses. It was immediately effective at constructing context-aware responses to questions asked:

```
$ deno run --allow-env --allow-read --allow-net inference.ts
{
  question: "What kind of issue are you facing?",
  options: [ "Plumbing issue", "Air conditioning issue", "General inquiry" ]
}

$ deno run --allow-env --allow-read --allow-net inference.ts
{
  question: "Are you an existing customer with us?",
  options: [ "Yes", "No" ]
}
```

I created a tree structure so that I can explore the IVR in a breadth first fashion. Here's the result of my first search through the example number provided:

```
Question: Are you an existing customer with us?
Options: Yes, No
  Yes:
    Question: Is this an emergency?
    Options: Yes, No
      Yes:
        Question:
        Options:
      No:
        Question: What kind of issue are you facing?
        Options: Heating issue, Cooling issue, Plumbing issue, General inquiry
          Heating issue:
            Question:
            Options:
  No:
    Question: Is there anything else I can assist you with?
    Options: Yes, I'd like more information about your services, No, that's all for now, Can I speak to a human representative?
      Yes, I'd like more information about your services:
        Question: Could you please provide your name and physical address first?
        Options: John Doe, 123 Main St, Springfield, IL, Jane Smith, 456 Elm St, Burlington, VT, Mike Johnson, 789 Oak St, Dayton, OH
      No, that's all for now:
        Question:
        Options:
      Can I speak to a human representative?:
        Question: May I have your name and physical address, please?
        Options: John Doe, 123 Elm Street, Springfield, Jane Smith, 456 Maple Avenue, Centerville, Mike Johnson, 789 Oak Lane, River Town
```

While the main flow of the search was present, there were a few issues with the recordings as I was listening back to them. Our agents started to hallucinate more. It would interrupt frequently, leading to flakiness in the next results. I went back to the drawing board on various prompt alternatives to try and produce predictable results. I also ran into a case where the two agents were in a loop, both trying to end the call, but still awaiting each other's responses. I began searching for thr right prompt that would have the highest cohesion to the goal.

To aid with this prompt engineering, I thought it would be helpful if the decisions could be supplied with the text transcript. I leveraged the deepgram API's voice utterances to get a back and forth diorized transcript between IVR agent and our agent.

# Setup

## Configure .env

Copy `.env.sample` to `.env`

```
cp .env.sample .env
```

Fill in `OPENAI_API_KEY` and `HAMMING_API_KEY`

## Install and configure ngrok

Requires a configured ngrok setup for developer environment

## Start tunneling on the ngrok port

```
ngrok http 8000
```

Grab the url and add to `.env` as `WEBHOOK_URL`

## Run IVR Navigator Server

```
deno run server
```

## Initiate IVR Navigation

While the navigator server is running

```
deno run discover
```
