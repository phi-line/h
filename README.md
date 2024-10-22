# Implementation

I created an IVR discovery agent that fuzzes out potential paths for any number of potential phone trees. You can supply the agent with memory, and it's able to navigate a branching path structure, one call at a time. It does this by running inference on the previous call, and deciding what its next actions should be. All of the collected calls recordings are finally fed into a transcription model where they are merged into a dataset @ `utterances/dataset.json`. From this, we can use classification to infer the graph of the IVR tree from segments of speech.

## Discovery Example

```
Question: Are you an existing customer with us?
Options: Yes, No
  Yes:
    Question: Is this an emergency?
    Options: Yes, it is an emergency., No, it is not an emergency., I am not sure, but I need assistance with a plumbing issue.
      Yes, it is an emergency.:
        Question: Is this an emergency?
        Options: Yes, No
          Yes:
            Question: is this an emergency situation
            Options: yes, no
          No:
            Question: Could you please let me know what kind of issue you are facing?
            Options: I am facing a plumbing issue., There is a leak in my bathroom., My kitchen sink is clogged.
      No, it is not an emergency.:
        Question: What kind of issue are you facing?
        Options: I have a leak in the bathroom., I am facing a clog in the kitchen sink., There is low water pressure in the shower.
      I am not sure, but I need assistance with a plumbing issue.:
        Question: hello
        Options: Yes, I'm here., Hello, Olivia., Can you hear me?
  No:
    Question: Is this an emergency situation?
    Options: Yes, No, I'm not sure
      Yes:
        Question: Is this an emergency?
        Options: Yes, No
      No:
        Question: What kind of issue are you facing?
        Options: Leaky faucet, Clogged drain, Water heater problem
      I'm not sure:
        Question: Could you please describe the issue you're facing?
        Options: I have a leaking faucet., There's a blockage in my sink., One of my pipes is making strange noises.
```

## Implementation notes

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

This did improve the cohesion of the model, but I still had some issues with the discovery inference. I wanted to explore tracking terminal states of the graph, for example "Transferring to an agent", but found this identification process too hard to do with one prompt. My discovery process was effective at fuzzing out potential paths, but I think some extra analysis is required to parse out the "runs" of the discovery process. This would be much easier to handle just-in-time, where I'd have the full ability to control our agent in the loop. Since the challenge media only outputs the full transcript, I have to do a lot of fuzzy parsing in order to identify the key parts of the call.

One potential method to aid with this could be to classify on the utterances. For example, if the agent tranferred the call it could be labelled as such "TRANSFERRED_CALL". Or if our agent supplied information it could be labelled as "PROVIDED_ADDRESS". I think with sufficient lablels we could convert the discover recordings into a graph state. I did experiment with this, but ultimately found it too challenging to do in the time frame allowed for this take-home.

All in all, I had a great time working on this challenge. It was perplexing at first since our agent can only be controlled with a prompt at the start, and nothing else. I came up with a root prompt that had a high degree of cohesion -- staying silent. I thought that if I forced it to answer any questions it did know, and to stay silent for the ones it didn't know, I could progressively built up the graph. I did my best to provide it with sufficient context but found it, but I think ultimately I may have confused my inference with too many goals. I think the best step moving forward is to do this classification meta-analysis on all discovered paths' transcripts. Provided, I can come up with sufficient labels to classify states of IVR trees, this could be a great option for consolidating the discovery dataset `utterances/dataset.json` into something digestable. I'd love to have an open ended discussion about how I navigated the problem and what can be done with next steps.

Current issues:

- Discovery process is unbounded. `inference.ts` needs to identify when at a terminal state
- Discovery process is prone to looping. `inference.ts` needs to identify when it's already explored a path
- Utterances dataset is not being classified at the moment.

# Setup

You need deno 2 installed :)
[Install deno](https://docs.deno.com/runtime/getting_started/installation/)

## Configure .env

Copy `.env.sample` to `.env`

```
cp .env.sample .env
```

Fill in `OPENAI_API_KEY`, `HAMMING_API_KEY`, and `DEEPGRAM_API_KEY`

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

## Generate Utterances dataset

```
deno run generate
```
