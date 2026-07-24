/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              NEELA BRAIN — AI MENTOR ENGINE                   ║
 * ║                                                              ║
 * ║  Powers Aurelius AI (Neela). API keys are user-provided      ║
 * ║  and stored in localStorage — same pattern as Hyperbeam.     ║
 * ║                                                              ║
 * ║  Provider Strategy:                                          ║
 * ║    1. Groq (Llama 3.1 8B Instant) — fast, free tier          ║
 * ║    2. OpenAI-compatible (GPT-4o-mini, NVIDIA NIM, etc.)      ║
 * ║    3. Offline Mode — when no keys or offline                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import { StudyState } from './studyStore';

const API_KEY_STORAGE = 'neela_api_keys';

/** NeelaApiKeys — User-provided API keys stored in localStorage. */
export interface NeelaApiKeys {
  provider: 'groq' | 'openai' | 'none';
  groqKey: string;
  openaiKey: string;
  openaiBaseURL: string;
  openaiModel: string;
}

const loadKeys = (): NeelaApiKeys => {
  try {
    const raw = localStorage.getItem(API_KEY_STORAGE);
    return raw ? JSON.parse(raw) : { provider: 'none', groqKey: '', openaiKey: '', openaiBaseURL: '', openaiModel: '' };
  } catch { return { provider: 'none', groqKey: '', openaiKey: '', openaiBaseURL: '', openaiModel: '' }; }
};

export const saveNeelaKeys = (keys: NeelaApiKeys) => {
  localStorage.setItem(API_KEY_STORAGE, JSON.stringify(keys));
};

export const getNeelaKeys = (): NeelaApiKeys => loadKeys();

export const chatWithNeela = async (
  message: string,
  state: StudyState,
  isOnline: boolean,
  keys?: NeelaApiKeys
): Promise<{ response: string; role: string }> => {
  if (!isOnline) {
    return { response: "# OFFLINE MODE\nI cannot access my neural core offline. Use the Forge in the Scheduler for offline planning.", role: 'assistant' };
  }
  const apiKeys = keys || loadKeys();
  if (!apiKeys.groqKey && !apiKeys.openaiKey) {
    return { response: "## ⚠️ API Key Required\nI need an API key to think. Click the **⚙️ Settings** button in my header and enter a Groq or OpenAI key.", role: 'assistant' };
  }

  const systemPrompt = `You are Neela, a world-class strategic PCM mentor for IIT-JEE preparation.

MENTALITY:
- Strict but caring teacher who wants the user to succeed.
- Speak the truth. Use the Mock Test data to hold the user accountable.
- If the user is slacking, call it out.
- You have PERSISTENT MEMORY via 'chatHistory' in StudyState.
- Generate schedules via [ACTION] blocks when asked.
- Never say "I have no context."

CURRENT SYSTEM CONTEXT:
${JSON.stringify(state)}

POWERS: Include [ACTION] blocks for scheduler updates.
[ACTION]
{"type":"ADD_TASKS","payload":[{"subject":"PHYSICS","type":"STUDY","title":"Electromagnetism","duration":90,"startTime":"06:00 PM","endTime":"07:30 PM"}]}
[/ACTION]

STYLE: Professional Markdown (H1, H2, bold). Be decisive.`;

  if (apiKeys.provider === 'groq' && apiKeys.groqKey) {
    try {
      const groq = new Groq({ apiKey: apiKeys.groqKey, dangerouslyAllowBrowser: true });
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        model: "llama-3.1-8b-instant",
      });
      return { response: completion.choices[0].message.content || '', role: 'assistant' };
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) {
        return { response: "## Invalid API Key\nYour Groq API key was rejected. Check it in Settings ⚙️.", role: 'assistant' };
      }
    }
  }

  if (apiKeys.provider === 'openai' && apiKeys.openaiKey) {
    try {
      const openai = new OpenAI({
        apiKey: apiKeys.openaiKey,
        baseURL: apiKeys.openaiBaseURL || 'https://api.openai.com/v1',
        dangerouslyAllowBrowser: true
      });
      const model = apiKeys.openaiModel || 'gpt-4o-mini';
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        model,
      });
      return { response: completion.choices[0].message.content || '', role: 'assistant' };
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) {
        return { response: "## Invalid API Key\nYour OpenAI/NIM API key was rejected. Check it in Settings ⚙️.", role: 'assistant' };
      }
    }
  }

  return { response: "## Neural Link Severed\nAll AI cores are unreachable right now. Try again in a moment.", role: 'assistant' };
};
