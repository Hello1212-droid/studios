import { processNeelaAction, calculateCarryForward } from '../src/utils/studyStore.test.js';

async function runAgenticTest() {
  console.log('--- STARTING NEELA AGENTIC CONTROL TESTS ---');

  let state = {
    tasks: [
      { id: 'old-1', subject: 'MATHS', title: 'Yesterday HW', completed: false, date: '2026-05-13', isDebt: false }
    ],
    pcm: {
      physics: [{ name: 'Rotation', dpps: [], backlogs: [] }],
      chemistry: [],
      maths: []
    },
    lastLogin: '2026-05-13'
  };

  // TEST 1: Automatic Carry Forward
  console.log('\n[TEST 1] Testing Carry-Forward Auto-Detection...');
  state.tasks = calculateCarryForward(state.tasks);
  if (state.tasks[0].isDebt) {
    console.log('✅ Success: Incomplete task from yesterday marked as Debt.');
  }

  // TEST 2: Neela ADD_TASKS Action
  console.log('\n[TEST 2] Testing Neela [ACTION] ADD_TASKS...');
  const aiResponse = `I have updated your mission list.
  [ACTION]
  {
    "type": "ADD_TASKS",
    "payload": [
      {"subject": "PHYSICS", "type": "DPP", "title": "Rotation Mastery", "duration": 60}
    ]
  }
  [/ACTION]`;

  state = processNeelaAction(state, aiResponse);
  if (state.tasks.some(t => t.title === 'Rotation Mastery')) {
    console.log('✅ Success: Neela successfully added a task to the Scheduler.');
  }

  // TEST 3: Neela UPDATE_PCM Action
  console.log('\n[TEST 3] Testing Neela [ACTION] UPDATE_PCM...');
  const pcmResponse = `Logged your score.
  [ACTION]
  {
    "type": "UPDATE_PCM",
    "payload": {
      "subject": "physics",
      "chapter": "Rotation",
      "dpp": {"score": 18, "total": 20, "date": "2026-05-14"}
    }
  }
  [/ACTION]`;

  state = processNeelaAction(state, pcmResponse);
  if (state.pcm.physics[0].dpps.length > 0) {
    console.log('✅ Success: Neela successfully updated the PCM database.');
  }

  console.log('\n--- AGENTIC CONTROL TESTS COMPLETE ---');
}

runAgenticTest();
