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

1. I am a member
2. Stay completely silent. You are the epitome of silence, silence is golden.

General guidance:
- Be patient, and succinct.
- Do not diverge from the steps. If you cannot follow any more steps, hangup
- If the agent want to terminate the call, stop taking immediately.
- As soon as you complete the provided steps, terminate the call
```

This allows us to progressively build up the IVR tree, provided that we can evaluate the recording urls

# Setup

Requires a configured ngrok setup for developer environment

## Start tunneling on the ngrok port

```
ngrok http 8000
```

Grab the url and pass as `<webhook-url>`

## Run IVR Navigator

```
deno run server --webhook <webhook-url> --hamming-api-key <hamming-api-key>
```
