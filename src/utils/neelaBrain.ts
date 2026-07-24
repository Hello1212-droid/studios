/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              NEELA BRAIN — AI MENTOR ENGINE                   ║
 * ║                                                              ║
 * ║  Powers the Aurelius AI Mentor (Neela). She is a strict,     ║
 * ║  high-signal PCM mentor for JEE preparation.                 ║
 * ║                                                              ║
 * ║  Provider Strategy:                                          ║
 * ║    1. Groq (Llama 3.1 8B Instant) — primary, fast           ║
 * ║       Uses 4-key rotation to avoid rate limits               ║
 * ║    2. NVIDIA NIM (GLM-5) — fallback if Groq is down         ║
 * ║    3. Offline Mode — heuristic responses when offline        ║
 * ║                                                              ║
 * ║  Agentic Capability:                                         ║
 * ║    Neela can issue [ACTION] blocks in her responses to       ║
 * ║    directly modify the Scheduler (add tasks) and PCM         ║
 * ║    chapter database. See studyStore.processNeelaAction().     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { Groq } from 'groq-sdk';          // Groq SDK for Llama 3.1
import OpenAI from 'openai';             // OpenAI-compatible SDK for NVIDIA NIM
import { StudyState } from './studyStore'; // Full app state for context injection

/**
 * GROQ_KEYS — Array of 4 Groq API keys for rate-limit rotation.
 * When one key gets rate-limited (HTTP 429), the next key is tried.
 * Keys come from environment variables.
 */
const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1 || "",
  process.env.GROQ_API_KEY_2 || "",
  process.env.GROQ_API_KEY_3 || "",
  process.env.GROQ_API_KEY_4 || ""
];

/** currentGroqIndex — Tracks which Groq key is currently being used for rate-limit rotation. */
let currentGroqIndex = 0;

/** rotateGroqKey() — Moves to the next Groq API key in the rotation. Wraps around. */
const rotateGroqKey = () => {
  currentGroqIndex = (currentGroqIndex + 1) % GROQ_KEYS.length;
};

/** NVIDIA_API_KEY — API key for the NVIDIA NIM fallback provider. */
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

/**
 * chatWithNeela(message, state, isOnline)
 * ──────────────────────────────────────────────────────────
 * Sends a message to the Neela AI mentor and returns her response.
 *
 * Parameters:
 *   message  → The user's chat message
 *   state    → Full StudyState for context injection (test results,
 *              tasks, chat history — Neela has full visibility)
 *   isOnline → navigator.onLine value. If false, returns offline fallback.
 *
 * Returns:
 *   { response: string, role: 'assistant' }
 *
 * System Prompt (Neela's Personality):
 *   - Strict but caring JEE mentor
 *   - Uses Mock Test data to hold the user accountable
 *   - Has persistent memory via chatHistory
 *   - Can generate schedules via [ACTION] blocks
 *   - Professional Markdown formatting
 *
 * Rate Limit Handling:
 *   If Groq returns 429 (rate limited), rotates to the next API key
 *   and retries recursively.
 *
 * Fallback Chain:
 *   Groq → NVIDIA NIM → Offline message
 */
export const chatWithNeela = async (
  message: string,
  state: StudyState,
  isOnline: boolean
): Promise<{ response: string; role: string }> => {
  // ── Offline Fallback ────────────────────────────────────
  if (!isOnline) {
    return {
      response: "# OFFLINE MODE\n" +
        "I cannot access my full neural core, but I can see your data. " +
        "Use the Offline Schedule Forge in the Scheduler app for instant planning.",
      role: 'assistant'
    };
  }

  // ── System Prompt ────────────────────────────────────────
  // This is Neela's "personality" — injected as the system message.
  // The full StudyState is JSON-stringified so Neela sees ALL user data.
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
        {
          "subject": "PHYSICS",
          "type": "STUDY",
          "title": "Electromagnetism",
          "duration": 90,
          "startTime": "06:00 PM",
          "endTime": "07:30 PM"
        }
      ]
    }
    [/ACTION]

    STYLE RULES:
    1. Use professional Markdown (H1, H2, bold).
    2. Be decisive. Do not ask for permission to help.
  `;

  // ── Try Groq (Primary) ──────────────────────────────────
  try {
    // Create Groq client with the current key in the rotation
    // dangerouslyAllowBrowser: true because this runs in a browser context
    const groq = new Groq({
      apiKey: GROQ_KEYS[currentGroqIndex],
      dangerouslyAllowBrowser: true
    });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: "llama-3.1-8b-instant",  // Fast, capable, cheap on Groq
    });

    return {
      response: completion.choices[0].message.content || '',
      role: 'assistant'
    };
  } catch (error: any) {
    // ── Rate Limit Rotation ─────────────────────────────────
    // HTTP 429 means this API key is rate-limited.
    // Rotate to the next key and retry.
    if (error.status === 429) {
      rotateGroqKey();
      return chatWithNeela(message, state, true); // Recursive retry with new key
    }

    // ── Try NVIDIA NIM (Fallback) ──────────────────────────
    try {
      // NVIDIA NIM uses the OpenAI-compatible API format
      const nvidia = new OpenAI({
        apiKey: NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1', // NVIDIA's API endpoint
        dangerouslyAllowBrowser: true
      });

      const nimResponse = await nvidia.chat.completions.create({
        model: "z-ai/glm-5.1",        // GLM-5 model on NVIDIA NIM
        messages: [{ role: 'user', content: message }],
      });

      return {
        response: nimResponse.choices[0].message.content || '',
        role: 'assistant'
      };
    } catch (e) {
      // ── Total Failure ──────────────────────────────────
      // Both Groq and NVIDIA are unreachable. Return a graceful
      // fallback message so the UI doesn't break.
      return {
        response: "## Neural Link Severed\n" +
          "All AI cores are currently unresponsive. Switching to local processing.",
        role: 'assistant'
      };
    }
  }
};
