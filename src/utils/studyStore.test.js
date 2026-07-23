// TEMPORARY JS VERSION FOR CLI TESTING
export const calculateCarryForward = (tasks, lastLoginDate) => {
  const today = new Date().toISOString().split('T')[0];
  return tasks.map(task => {
    if (!task.completed && task.date < today && !task.isDebt) {
      return { ...task, isDebt: true };
    }
    return task;
  });
};

export const processNeelaAction = (state, aiResponse) => {
  try {
    const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
    if (!actionMatch) return state;

    const action = JSON.parse(actionMatch[1]);
    let newState = { ...state };

    if (action.type === 'ADD_TASKS') {
      const newTasks = action.payload.map((t) => ({
        id: Math.random().toString(36).substr(2, 9),
        completed: false,
        isDebt: false,
        date: new Date().toISOString().split('T')[0],
        ...t
      }));
      newState.tasks = [...newState.tasks, ...newTasks];
    }

    if (action.type === 'UPDATE_PCM') {
      const { subject, chapter, dpp, backlog } = action.payload;
      const sub = subject.toLowerCase();
      const chapterIdx = newState.pcm[sub].findIndex(c => c.name.toLowerCase() === chapter.toLowerCase());
      
      if (chapterIdx > -1) {
        if (dpp) newState.pcm[sub][chapterIdx].dpps.push(dpp);
        if (backlog) newState.pcm[sub][chapterIdx].backlogs.push(backlog);
      }
    }

    return newState;
  } catch (e) {
    console.error("Agent failed to execute action:", e);
    return state;
  }
};
