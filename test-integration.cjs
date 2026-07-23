const { loadState, saveState } = require('./src/utils/studyStore');

const state = loadState();

if (!state.testResults) state.testResults = [];
if (!state.chatHistory) state.chatHistory = [];

const test = {
  id: '1',
  date: '2026-05-19',
  testName: 'Mock 1',
  provider: 'FIITJEE',
  score: 180,
  total: 300,
  rank: 50,
  overallPercentile: 98.2,
  subjectPercentiles: { PHYSICS: 97, CHEMISTRY: 99, MATHS: 95 },
  jeeEquivalentPercentile: 98.4,
  targetPercentile: 99.5
};

const chat = {
  id: 'session-1',
  timestamp: new Date().toISOString(),
  title: 'JEE Strategy Discussion',
  messages: [{ role: 'user', content: 'How do I improve my physics?', timestamp: new Date().toISOString() }]
};

state.testResults.push(test);
state.chatHistory.push(chat);

saveState(state);

const updatedState = loadState();
console.log('--- DATA INTEGRATION TEST ---');
console.log('Tests found:', updatedState.testResults.length);
console.log('Chats found:', updatedState.chatHistory.length);
console.log('Test Target:', updatedState.testResults[0].targetPercentile);
