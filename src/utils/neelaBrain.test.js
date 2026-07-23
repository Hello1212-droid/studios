import { Groq } from 'groq-sdk';
import OpenAI from 'openai';

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1 || "",
  process.env.GROQ_API_KEY_2 || "",
  process.env.GROQ_API_KEY_3 || "",
  process.env.GROQ_API_KEY_4 || ""
];

let currentGroqIndex = 0;

const getGroqClient = () => {
  return new Groq({ apiKey: GROQ_KEYS[currentGroqIndex] });
};

const rotateGroqKey = () => {
  currentGroqIndex = (currentGroqIndex + 1) % GROQ_KEYS.length;
};

const nvidiaClient = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "",
  baseURL: 'https://integrate.api.nvidia.com/v1'
});

export const getOfflineSchedule = (pcmData, time) => {
  return "OFFLINE MODE: Prioritizing oldest backlogs first due to lack of internet connection.";
};

export const chatWithNeela = async (message, pcmData, isOnline) => {
  if (!isOnline) {
    return { response: getOfflineSchedule(pcmData, 4), role: 'assistant' };
  }

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: `You are Neela, a strict AI mentor. PCM Data: ${JSON.stringify(pcmData)}. 
        CRITICAL: You MUST use professional Markdown for EVERY response. 
        - Use # H1 for high-level verdicts.
        - Use ## H2 for sections like "The Battlefield" or "Today's Protocol".
        - Use **bold** for emphasis on critical failures or requirements.
        - Use lists (- or 1.) for steps.
        - NO ASCII art. Use clean typography.` },
        { role: 'user', content: message }
      ],
      model: "llama-3.1-8b-instant",
    });
    return { response: completion.choices[0].message.content, role: 'assistant' };
  } catch (error) {
    if (error.status === 429) {
      rotateGroqKey();
      return chatWithNeela(message, pcmData, true);
    }
    const nimResponse = await nvidiaClient.chat.completions.create({
      model: "z-ai/glm-5.1",
      messages: [{ role: 'user', content: message }],
    });
    return { response: nimResponse.choices[0].message.content, role: 'assistant' };
  }
};
