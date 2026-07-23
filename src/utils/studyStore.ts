export type TaskType = 'DPP' | 'HOMEWORK' | 'BACKLOG' | 'SURGERY' | 'STUDY';
export type Subject = string;

export const STANDARD_SUBJECTS = ['PHYSICS', 'CHEMISTRY', 'MATHS'] as const;

export interface SubjectConfig {
  name: string;
  priority: number; // 1-3
}

export interface TestResult {
  id: string;
  date: string;
  testName: string;
  provider: string;
  score: number;
  total: number;
  rank: number;
  totalStudents: number;
  overallPercentile: number;
  subjectPercentiles: Record<Subject, number>;
  jeeEquivalentPercentile: number;
  targetPercentile: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  timestamp: string;
  title: string;
  messages: ChatMessage[];
}

export interface SubjectTask {
  id: string;
  subject: Subject;
  subjectDisplay?: string;
  type: TaskType;
  title: string;
  subtitle: string;
  duration: number; // minutes
  startTime: string; // HH:mm AM/PM
  endTime: string; // HH:mm AM/PM
  completed: boolean;
  date: string; // YYYY-MM-DD
  isDebt: boolean;
  priority: number; // 1-3
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  reason?: string;
  metadata?: any;
}

export interface StudySessionState {
  isActive: boolean;
  isBreak: boolean;
  currentTaskId: string | null;
  currentTaskIndex: number;
  studyStartedAt: number | null; // Date.now()
  breakStartedAt: number | null;
  totalStudySeconds: number;
  totalBreakSeconds: number;
  breakCount: number;
  completedTaskIds: string[];
}

export interface StudyState {
  tasks: SubjectTask[];
  auditLog: AuditEntry[];
  testResults: TestResult[];
  chatHistory: ChatSession[];
  pcm: any;
  lastLogin: string;
  session: StudySessionState;
  config: {
    startTime: string; // HH:mm (24h)
    endTime: string; // HH:mm (24h)
    breakInterval: number; // minutes
    breakDuration: number; // minutes
  }
}

// ===== TIME UTILITIES =====

// Parse 12h time string like "8:00 PM" or "01:30 AM" to minutes from midnight
export const parseTime12toMinutes = (timeStr: string): number => {
  const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = parseInt(match12[2]);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  // Try 24h format
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

// Convert minutes to 12h time string
export const formatMinutesTo12 = (minutes: number): string => {
  const totalMinutes = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
};

// Get current time of day in minutes
export const getCurrentTimeMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

// ===== SMART SCHEDULING ALGORITHM =====

export interface ScheduleResult {
  tasks: SubjectTask[];
  totalMinutes: number;
  subjectAllocations: { subject: string; minutes: number; percentage: number }[];
}

export const generateDynamicSchedule = (
  subjects: SubjectConfig[],
  startTimeStr: string,
  endTimeStr: string,
  breakInterval: number = 50,
  breakDuration: number = 10
): ScheduleResult => {
  let currentMinutes = parseTime12toMinutes(startTimeStr);
  let endMinutes = parseTime12toMinutes(endTimeStr);

  // Handle cross-midnight
  if (endMinutes <= currentMinutes) {
    endMinutes += 24 * 60;
  }

  const totalAvailable = endMinutes - currentMinutes;
  if (totalAvailable <= 0 || subjects.length === 0) {
    return { tasks: [], totalMinutes: 0, subjectAllocations: [] };
  }

  const tasks: SubjectTask[] = [];
  const totalWeight = subjects.reduce((acc, s) => acc + s.priority, 0);
  
  // Sort subjects by priority descending
  const sortedSubjects = [...subjects].sort((a, b) => b.priority - a.priority);

  // Calculate allocations per subject
  const allocations: { name: string; priority: number; allocated: number }[] = sortedSubjects.map(s => ({
    name: s.name,
    priority: s.priority,
    allocated: (s.priority / totalWeight) * totalAvailable
  }));

  const subjectAllocations = allocations.map(a => ({
    subject: a.name,
    minutes: Math.round(a.allocated),
    percentage: Math.round((a.allocated / totalAvailable) * 100)
  }));

  let timeSinceLastBreak = 0;
  const today = new Date().toISOString().split('T')[0];
  let subjectIndex = 0;
  let maxIterations = 1000; // safety guard
  let iterations = 0;

  while (currentMinutes < endMinutes && subjectIndex < sortedSubjects.length && iterations < maxIterations) {
    iterations++;

    // Check if it's time for a break
    if (timeSinceLastBreak >= breakInterval) {
      const breakEnd = Math.min(currentMinutes + breakDuration, endMinutes);
      currentMinutes = breakEnd;
      timeSinceLastBreak = 0;
      continue;
    }

    const sub = allocations[subjectIndex];
    if (!sub) break;

    const alreadyAllocated = tasks
      .filter(t => t.subject === sub.name)
      .reduce((acc, t) => acc + t.duration, 0);

    const remainingForSubject = sub.allocated - alreadyAllocated;

    if (remainingForSubject <= 0) {
      subjectIndex++;
      continue;
    }

    const remainingTime = endMinutes - currentMinutes;
    const availableBeforeBreak = breakInterval - timeSinceLastBreak;
    
    const duration = Math.min(remainingForSubject, remainingTime, availableBeforeBreak);

    if (duration < 10) {
      subjectIndex++;
      continue;
    }

    const blockStartMinutes = currentMinutes;
    currentMinutes += duration;
    timeSinceLastBreak += duration;

    tasks.push({
      id: Math.random().toString(36).substr(2, 9),
      subject: sub.name,
      subjectDisplay: sub.name,
      type: 'STUDY',
      title: `${sub.name} Focused Study`,
      subtitle: `Deep work on ${sub.name}`,
      duration: Math.floor(duration),
      startTime: formatMinutesTo12(blockStartMinutes),
      endTime: formatMinutesTo12(currentMinutes),
      completed: false,
      date: today,
      isDebt: false,
      priority: sub.priority
    });
  }

  return { tasks, totalMinutes: totalAvailable, subjectAllocations };
};

// ===== REBALANCE AFTER BREAK =====

export const rebalanceSchedule = (
  currentTasks: SubjectTask[],
  completedTaskIds: string[],
  currentTimeStr: string,
  endTimeStr: string,
  breakInterval: number = 50,
  breakDuration: number = 10
): ScheduleResult => {
  // Mark completed tasks
  const remainingTasks = currentTasks.filter(t => !completedTaskIds.includes(t.id));
  
  // Get remaining subjects and their priorities
  const subjectPriorityMap = new Map<string, number>();
  remainingTasks.forEach(t => {
    const existing = subjectPriorityMap.get(t.subject);
    if (!existing || t.priority > existing) {
      subjectPriorityMap.set(t.subject, t.priority);
    }
  });

  // Check if endTime has already passed
  const currentMinutes = parseTime12toMinutes(currentTimeStr);
  let endMinutes = parseTime12toMinutes(endTimeStr);
  if (endMinutes <= currentMinutes) {
    endMinutes += 24 * 60;
  }

  if (currentMinutes >= endMinutes || subjectPriorityMap.size === 0) {
    return { tasks: [], totalMinutes: 0, subjectAllocations: [] };
  }

  const subjects: SubjectConfig[] = Array.from(subjectPriorityMap.entries()).map(
    ([name, priority]) => ({ name, priority })
  );

  return generateDynamicSchedule(subjects, currentTimeStr, endTimeStr, breakInterval, breakDuration);
};

// ===== DASHBOARD STATS =====

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalStudyMinutes: number;
  totalBreakMinutes: number;
  breakCount: number;
  subjectBreakdown: {
    subject: string;
    totalMinutes: number;
    completedMinutes: number;
    tasksCount: number;
    completedTasks: number;
  }[];
  todayAuditLog: AuditEntry[];
}

export const calculateDashboardStats = (tasks: SubjectTask[], auditLog: AuditEntry[]): DashboardStats => {
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.date === today);
  const todayAuditLog = auditLog.filter(e => e.timestamp.startsWith(today));

  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalStudyMinutes = todayTasks.reduce((acc, t) => acc + t.duration, 0);

  // Break stats from audit log
  const breakStarts = todayAuditLog.filter(e => e.action === 'START_BREAK');
  const breakEnds = todayAuditLog.filter(e => e.action === 'STOP_BREAK');
  const breakCount = breakStarts.length;

  // Calculate break minutes from metadata if available
  let totalBreakMinutes = 0;
  breakEnds.forEach(e => {
    if (e.metadata?.durationSeconds) {
      totalBreakMinutes += Math.ceil(e.metadata.durationSeconds / 60);
    }
  });

  // Subject breakdown
  const subjectMap = new Map<string, { totalMin: number; completedMin: number; tasksCount: number; completedTasks: number }>();
  todayTasks.forEach(t => {
    const key = t.subjectDisplay || t.subject;
    const existing = subjectMap.get(key) || { totalMin: 0, completedMin: 0, tasksCount: 0, completedTasks: 0 };
    existing.totalMin += t.duration;
    existing.tasksCount += 1;
    if (t.completed) {
      existing.completedMin += t.duration;
      existing.completedTasks += 1;
    }
    subjectMap.set(key, existing);
  });

  return {
    totalTasks,
    completedTasks,
    completionRate,
    totalStudyMinutes,
    totalBreakMinutes,
    breakCount,
    subjectBreakdown: Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      totalMinutes: data.totalMin,
      completedMinutes: data.completedMin,
      tasksCount: data.tasksCount,
      completedTasks: data.completedTasks
    })),
    todayAuditLog
  };
};

// ===== DEFAULT STATE =====

const STORAGE_KEY = 'studyos_data_v3';

const createDefaultState = (): StudyState => ({
  tasks: [],
  auditLog: [],
  testResults: [],
  chatHistory: [],
  pcm: {
    physics: [{ name: 'Rotation', dpps: [], backlogs: [] }],
    chemistry: [{ name: 'Thermodynamics', dpps: [], backlogs: [] }],
    maths: [{ name: 'Integration', dpps: [], backlogs: [] }],
  },
  lastLogin: new Date().toISOString().split('T')[0],
  session: {
    isActive: false,
    isBreak: false,
    currentTaskId: null,
    currentTaskIndex: -1,
    studyStartedAt: null,
    breakStartedAt: null,
    totalStudySeconds: 0,
    totalBreakSeconds: 0,
    breakCount: 0,
    completedTaskIds: []
  },
  config: {
    startTime: "18:00",
    endTime: "23:00",
    breakInterval: 50,
    breakDuration: 10
  }
});

export const loadState = (): StudyState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  try {
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure session field exists for legacy data
      if (!parsed.session) {
        parsed.session = createDefaultState().session;
      }
      return parsed as StudyState;
    }
  } catch (e) {
    // Corrupted data, start fresh
  }
  return createDefaultState();
};

export const saveState = (state: StudyState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[StudyOS] Failed to save state:', e);
  }
};

// ===== STATE HELPERS =====

export const updateChatSession = (state: StudyState, session: ChatSession): StudyState => {
  const existingIdx = state.chatHistory.findIndex(s => s.id === session.id);
  let newHistory = [...state.chatHistory];
  if (existingIdx >= 0) {
    newHistory[existingIdx] = session;
  } else {
    newHistory = [session, ...newHistory];
  }
  const newState = { ...state, chatHistory: newHistory };
  saveState(newState);
  return newState;
};

export const calculateCarryForward = (tasks: SubjectTask[]): SubjectTask[] => {
  const today = new Date().toISOString().split('T')[0];
  return tasks.map(task => {
    if (!task.completed && task.date < today && !task.isDebt) {
      return { ...task, isDebt: true };
    }
    return task;
  });
};

export const logAction = (state: StudyState, action: string, reason?: string, metadata?: any): StudyState => {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    reason,
    metadata
  };
  const newState = { ...state, auditLog: [...state.auditLog.slice(-99), entry] };
  saveState(newState);
  return newState;
};

// ===== NEELA ACTION PROCESSING =====

export const processNeelaAction = (state: StudyState, aiResponse: string): StudyState => {
  try {
    const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
    if (!actionMatch) return state;

    const action = JSON.parse(actionMatch[1]);
    let newState = { ...state };

    if (action.type === 'ADD_TASKS') {
      const today = new Date().toISOString().split('T')[0];
      const newTasks = action.payload.map((t: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        completed: false,
        isDebt: false,
        date: today,
        ...t
      }));
      newState.tasks = [...newState.tasks, ...newTasks];
      newState = logAction(newState, 'NEELA_ADD_TASKS', 'AI generated schedule update');
    }

    if (action.type === 'UPDATE_PCM') {
      const { subject, chapter, dpp, backlog } = action.payload;
      const sub = subject.toLowerCase();
      const chapterIdx = newState.pcm[sub]?.findIndex((c: any) => c.name.toLowerCase() === chapter.toLowerCase());
      if (chapterIdx !== undefined && chapterIdx > -1) {
        if (dpp) newState.pcm[sub][chapterIdx].dpps.push(dpp);
        if (backlog) newState.pcm[sub][chapterIdx].backlogs.push(backlog);
      }
    }

    return newState;
  } catch (e) {
    return state;
  }
};
