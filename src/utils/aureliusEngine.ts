export interface PCMProgress {
  physics: { chapter: string; dppScore: number; backlogCount: number };
  chemistry: { chapter: string; dppScore: number; backlogCount: number };
  maths: { chapter: string; dppScore: number; backlogCount: number };
}

export interface AureliusTask {
  title: string;
  duration: number; // in minutes
  type: 'HW' | 'DPP_REDO' | 'BACKLOG' | 'STUDY';
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  reason: string;
}

export const generateAureliusStrategy = (data: PCMProgress, _studyTimeAvailable: number): AureliusTask[] => {
  const tasks: AureliusTask[] = [];
  
  // Logic: Priorities
  // 1. Redo DPP if score < 50% (CRITICAL)
  // 2. Clear Backlogs (HIGH)
  // 3. Current HW (NORMAL)

  const subjects: (keyof PCMProgress)[] = ['physics', 'chemistry', 'maths'];

  subjects.forEach(sub => {
    const info = data[sub];
    
    // Critical: Bad DPP scores
    if (info.dppScore < 50) {
      tasks.push({
        title: `Redo ${sub} DPP: ${info.chapter}`,
        duration: 45,
        type: 'DPP_REDO',
        priority: 'CRITICAL',
        reason: `Your score of ${info.dppScore}% in ${info.chapter} is unacceptable. Master the basics.`
      });
    }

    // High: Backlogs
    if (info.backlogCount > 0) {
      tasks.push({
        title: `Clear ${sub} Backlog`,
        duration: 60,
        type: 'BACKLOG',
        priority: 'HIGH',
        reason: `You have ${info.backlogCount} lectures missed. You are falling behind.`
      });
    }

    // Normal: Current HW
    tasks.push({
      title: `${sub} Practice: ${info.chapter}`,
      duration: 90,
      type: 'HW',
      priority: 'NORMAL',
      reason: `Standard practice for current class topic.`
    });
  });

  // Sort by priority and trim to available time
  return tasks.sort((a, b) => {
    const weight = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };
    return weight[a.priority] - weight[b.priority];
  });
};
