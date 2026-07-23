import { chatWithNeela } from '../src/utils/neelaBrain.test.js';

// Mock PCM Data
const mockPcmData = {
  physics: [{ name: 'Rotation', dpps: [{ score: 5, total: 20 }], backlogs: ['Lec 1'] }],
  chemistry: [{ name: 'Thermodynamics', dpps: [], backlogs: [] }],
  maths: [{ name: 'Integration', dpps: [], backlogs: [] }],
};

async function runTests() {
  console.log('--- STARTING NEELA AGENTIC TESTS ---');

  // TEST 1: Offline Heuristic (100% Accuracy Check)
  console.log('\n[TEST 1] Checking Offline Heuristic...');
  const offlineResult = await chatWithNeela('I need a schedule', mockPcmData, false);
  console.log('Result:', offlineResult.response);
  if (offlineResult.response.includes('OFFLINE MODE')) {
    console.log('✅ Offline Heuristic Passed');
  } else {
    console.log('❌ Offline Heuristic Failed');
  }

  // TEST 2: Online Agentic Response (Groq)
  console.log('\n[TEST 2] Checking Online Agentic Core (Groq)...');
  try {
    const onlineResult = await chatWithNeela('Analyze my physics performance and give me a strict verdict.', mockPcmData, true);
    console.log('Neela says:', onlineResult.response);
    console.log('✅ Online Core Functional');
  } catch (err) {
    console.log('❌ Online Core Error:', err.message);
  }

  console.log('\n--- TESTS COMPLETE ---');
}

runTests();
