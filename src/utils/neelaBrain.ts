import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import { StudyState } from './studyStore';

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1 || "",
  process.env.GROQ_API_KEY_2 || "",
  process.env.GROQ_API_KEY_3 || "",
  process.env.GROQ_API_KEY_4 || ""
];

let currentGroqIndex = 0;

const rotateGroqKey = () => {
  currentGroqIndex = (currentGroqIndex + 1) % GROQ_KEYS.length;
};

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

export const chatWithNeela = async (message: string, state: StudyState, isOnline: boolean): Promise<{ response: string; role: string }> => {
  if (!isOnline) {
    return { response: "# OFFLINE MODE\nI cannot access my full neural core, but I can see your data. Use the Offline Schedule Forge in the Scheduler app for instant planning.", role: 'assistant' };
  }

  const systemPrompt = `
    You are Neela, a world-class strategic PCM mentor. You have direct control over StudyOS.
    
    MENTALITY:
    - You are a strict but caring teacher who wants the user to succeed in IIT-JEE/Competitive exams.
    - Speak the truth. Use the Mock Test data in the context to hold the user accountable to their JEE Equivalence.
    - If the user is slacking (score/percentile dropping), call it out.
    - You have PERSISTENT MEMORY. Look at the 'chatHistory' to remember previous strategy discussions.
    - If the user asks for a schedule, analyze their data and generate one using the [ACTION] tag.
    - If no specific action is needed, engage as a conversational mentor. Never say "I have no context."
    
    CURRENT SYSTEM CONTEXT:
    ${JSON.stringify(state)}

    POWERS:
    You can update the Scheduler by including an [ACTION] block.
    
    ACTION FORMAT (JSON):
    [ACTION]
    {
      "type": "ADD_TASKS",
      "payload": [
        {"subject": "PHYSICS", "type": "STUDY", "title": "Electromagnetism", "duration": 90, "startTime": "06:00 PM", "endTime": "07:30 PM"}
      ]
    }
    [/ACTION]

    STYLE RULES:
    1. Use professional Markdown (H1, H2, bold).
    2. Be decisive. Do not ask for permission to help.
  `;

  try {
    const groq = new Groq({ apiKey: GROQ_KEYS[currentGroqIndex], dangerouslyAllowBrowser: true });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: "llama-3.1-8b-instant",
    });
    return { response: completion.choices[0].message.content || '', role: 'assistant' };
  } catch (error: any) {
    if (error.status === 429) {
      rotateGroqKey();
      return chatWithNeela(message, state, true);
    }
    
    // FALLBACK TO NVIDIA
    try {
        const nvidia = new OpenAI({
            apiKey: NVIDIA_API_KEY,
            baseURL: 'https://integrate.api.nvidia.com/v1',
            dangerouslyAllowBrowser: true
        });
        const nimResponse = await nvidia.chat.completions.create({
            model: "z-ai/glm-5.1",
            messages: [{ role: 'user', content: message }],
        });
        return { response: nimResponse.choices[0].message.content || '', role: 'assistant' };
    } catch (e) {
        return { response: "## Neural Link Severed\nAll AI cores are currently unresponsive. Switching to local processing.", role: 'assistant' };
    }
  }
};
