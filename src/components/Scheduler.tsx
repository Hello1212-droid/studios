import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Clock, Zap, Coffee, Play, BarChart3,
  Plus, Trash2, GripVertical, ChevronRight, Timer, Lock,
  TrendingUp, ListChecks
} from 'lucide-react';
import {
  StudyState, SubjectTask, SubjectConfig, ScheduleResult,
  generateDynamicSchedule, calculateDashboardStats,
  logAction, formatMinutesTo12, DashboardStats
} from '../utils/studyStore';
import AnimatedClock from './AnimatedClock';

interface Props {
  studyState: StudyState;
  setStudyState: React.Dispatch<React.SetStateAction<StudyState>>;
}

const DEFAULT_SUBJECTS: SubjectConfig[] = [
  { name: 'PHYSICS', priority: 3 },
  { name: 'CHEMISTRY', priority: 2 },
  { name: 'MATHS', priority: 3 },
];

const Scheduler: React.FC<Props> = ({ studyState, setStudyState }) => {
  // Forge state
  const [showForge, setShowForge] = useState(false);
  const [forgeStep, setForgeStep] = useState<'subjects' | 'time' | 'preview'>('subjects');
  const [forgeSubjects, setForgeSubjects] = useState<SubjectConfig[]>([...DEFAULT_SUBJECTS]);
  const [forgeStartTime, setForgeStartTime] = useState('8:00 PM');
  const [forgeEndTime, setForgeEndTime] = useState('1:30 AM');
  const [generatedResult, setGeneratedResult] = useState<ScheduleResult | null>(null);

  // Study session state
  const [isStudyActive, setIsStudyActive] = useState(false);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(-1);
  const [studySeconds, setStudySeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [breakCount, setBreakCount] = useState(0);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<SubjectTask[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [lastTaskDate, setLastTaskDate] = useState('');

  const studyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load today's tasks on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = studyState.tasks.filter(t => t.date === today && !t.isDebt);
    if (todayTasks.length > 0 && lastTaskDate !== today) {
      setCurrentSchedule(todayTasks);
      setLastTaskDate(today);
      setCompletedTaskIds(studyState.tasks.filter(t => t.completed).map(t => t.id));
    }
  }, [studyState.tasks]);

  // ===== TIMER MANAGEMENT =====
  const startStudyTimer = useCallback(() => {
    if (studyTimerRef.current) clearInterval(studyTimerRef.current);
    setIsStudyActive(true);
    setStudySeconds(0);
    studyTimerRef.current = setInterval(() => {
      setStudySeconds(s => s + 1);
    }, 1000);
  }, []);

  const stopStudyTimer = useCallback(() => {
    if (studyTimerRef.current) {
      clearInterval(studyTimerRef.current);
      studyTimerRef.current = null;
    }
    setIsStudyActive(false);
  }, []);

  const startBreakTimer = useCallback(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    setIsBreakActive(true);
    setBreakSeconds(0);
    breakTimerRef.current = setInterval(() => {
      setBreakSeconds(s => s + 1);
    }, 1000);
  }, []);

  const stopBreakTimer = useCallback(() => {
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    setIsBreakActive(false);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (studyTimerRef.current) clearInterval(studyTimerRef.current);
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, []);

  // ===== FORGE LOGIC =====
  const openForge = () => {
    setForgeStep('subjects');
    setForgeSubjects([...DEFAULT_SUBJECTS]);
    setForgeStartTime('8:00 PM');
    setForgeEndTime('1:30 AM');
    setGeneratedResult(null);
    setShowForge(true);
  };

  const addSubject = () => {
    const newName = 'SUBJECT' + (forgeSubjects.length + 1);
    setForgeSubjects([...forgeSubjects, { name: newName, priority: 1 }]);
  };

  const removeSubject = (index: number) => {
    if (forgeSubjects.length <= 1) return;
    setForgeSubjects(forgeSubjects.filter((_, i) => i !== index));
  };

  const updateSubjectName = (index: number, name: string) => {
    const updated = [...forgeSubjects];
    updated[index] = { ...updated[index], name: name.toUpperCase() };
    setForgeSubjects(updated);
  };

  const updateSubjectPriority = (index: number, priority: number) => {
    const updated = [...forgeSubjects];
    updated[index] = { ...updated[index], priority: Math.max(1, Math.min(3, priority)) };
    setForgeSubjects(updated);
  };

  const handleGenerateSchedule = () => {
    const result = generateDynamicSchedule(
      forgeSubjects,
      forgeStartTime,
      forgeEndTime,
      50, // break interval
      10  // break duration
    );
    setGeneratedResult(result);
    setForgeStep('preview');
  };

  const handleEngageSchedule = () => {
    if (!generatedResult) return;

    const today = new Date().toISOString().split('T')[0];
    const existingDebt = studyState.tasks.filter(t => t.isDebt);

    setCurrentSchedule(generatedResult.tasks);
    setCompletedTaskIds([]);
    setCurrentTaskIndex(-1);
    setBreakCount(0);
    setLastTaskDate(today);

    setStudyState(prev => {
      const newState = {
        ...prev,
        tasks: [...existingDebt, ...generatedResult.tasks],
        session: {
          ...prev.session,
          isActive: false,
          isBreak: false,
          currentTaskId: null,
          currentTaskIndex: -1,
          totalStudySeconds: 0,
          totalBreakSeconds: 0,
          breakCount: 0,
          completedTaskIds: []
        }
      };
      return logAction(newState, 'FORGE_SCHEDULE', `Generated ${generatedResult.tasks.length} study blocks`);
    });

    setShowForge(false);
  };

  // @ts-ignore
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const enterKiosk = useCallback(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.send('enter-kiosk');
        console.log('[StudyOS] Kiosk mode requested from Scheduler');
      } catch (e) {
        console.error('[StudyOS] Scheduler enterKiosk error:', e);
      }
    }
  }, [isElectron]);

  const exitKiosk = useCallback(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.send('exit-kiosk');
        console.log('[StudyOS] Exiting kiosk mode from Scheduler');
      } catch (e) {
        console.error('[StudyOS] Scheduler exitKiosk error:', e);
      }
    }
  }, [isElectron]);

  // ===== STUDY EXECUTION =====
  const startStudy = (taskIndex: number) => {
    const task = currentSchedule[taskIndex];
    if (!task || task.completed) return;

    setCurrentTaskIndex(taskIndex);
    startStudyTimer();
    // Activate kiosk lockdown on study start
    enterKiosk();

    setStudyState(prev => logAction(prev, 'START_STUDY', `Started: ${task.title}`, {
      taskId: task.id, subject: task.subject, plannedDuration: task.duration
    }));
  };

  const completeCurrentTask = () => {
    if (currentTaskIndex < 0) return;
    const task = currentSchedule[currentTaskIndex];
    if (!task) return;

    stopStudyTimer();
    exitKiosk();

    const newCompletedIds = [...completedTaskIds, task.id];
    setCompletedTaskIds(newCompletedIds);

    // Mark task as completed in state
    setStudyState(prev => {
      const updatedTasks = prev.tasks.map(t =>
        t.id === task.id ? { ...t, completed: true } : t
      );
      const newState = {
        ...prev,
        tasks: updatedTasks,
        session: {
          ...prev.session,
          isActive: false,
          totalStudySeconds: prev.session.totalStudySeconds + studySeconds,
          completedTaskIds: newCompletedIds
        }
      };
      return logAction(newState, 'COMPLETE_TASK', `Completed: ${task.title}`, {
        taskId: task.id, studySeconds
      });
    });

    setStudySeconds(0);

    // Move to next task
    const nextIndex = currentTaskIndex + 1;
    if (nextIndex < currentSchedule.length) {
      // Rebalance remaining schedule after completion
      const remainingSchedule = currentSchedule.filter((_, i) => i > currentTaskIndex && !newCompletedIds.includes(currentSchedule[i]?.id || ''));
      if (remainingSchedule.length > 0) {
        // Auto-start next task after short gap
        setCurrentTaskIndex(nextIndex);
        startStudyTimer();
      } else {
        setCurrentTaskIndex(-1);
      }
    } else {
      setCurrentTaskIndex(-1);
    }
  };

  const takeBreak = () => {
    if (currentTaskIndex < 0) return;

    // Pause study timer — exit kiosk for break
    stopStudyTimer();
    exitKiosk();
    // Start break timer
    setBreakCount(c => c + 1);
    startBreakTimer();

    const task = currentSchedule[currentTaskIndex];
    setStudyState(prev => logAction(prev, 'START_BREAK', `Break during: ${task?.title}`, {
      taskId: task?.id, elapsedStudySeconds: studySeconds
    }));
  };

  const endBreak = () => {
    stopBreakTimer();
    // Re-enter kiosk when returning from break
    enterKiosk();

    const breakDurationSec = breakSeconds;

    setStudyState(prev => logAction(prev, 'STOP_BREAK', 'Returned from break', {
      durationSeconds: breakDurationSec
    }));

    // Rebalance the schedule
    const now = new Date();
    const currentTimeStr = formatMinutesTo12(now.getHours() * 60 + now.getMinutes());
    const endTimeStr = currentSchedule.length > 0
      ? currentSchedule[currentSchedule.length - 1].endTime
      : '11:59 PM';

    // Mark any completed tasks
    const completedIds = [...completedTaskIds];

    // Check if current task should be marked complete (time might have been consumed)
    const shouldCompleteCurrent = studySeconds > 0;
    if (shouldCompleteCurrent && currentTaskIndex >= 0) {
      const currentTask = currentSchedule[currentTaskIndex];
      if (currentTask) {
        completedIds.push(currentTask.id);
        setStudyState(prev => {
          const updatedTasks = prev.tasks.map(t =>
            t.id === currentTask.id ? { ...t, completed: true } : t
          );
          return logAction({ ...prev, tasks: updatedTasks }, 'AUTO_COMPLETE',
            `Time consumed: ${currentTask.title}`, { studySeconds });
        });
      }
    }

    setCompletedTaskIds(completedIds);

    // Re-run algorithm for remaining
    const remainingSubjects: SubjectConfig[] = [];
    const remainingSchedule: SubjectTask[] = [];
    let foundCurrent = false;

    currentSchedule.forEach((task, i) => {
      if (completedIds.includes(task.id)) return;
      if (!foundCurrent && i <= currentTaskIndex) {
        foundCurrent = true;
        return;
      }
      remainingSchedule.push(task);
      if (!remainingSubjects.find(s => s.name === task.subject)) {
        remainingSubjects.push({ name: task.subject, priority: task.priority });
      }
    });

    if (remainingSchedule.length > 0 && remainingSubjects.length > 0) {
      const rebalanceResult = generateDynamicSchedule(
        remainingSubjects,
        currentTimeStr,
        endTimeStr,
        50, 10
      );

      if (rebalanceResult.tasks.length > 0) {
        setCurrentSchedule(prev => {
          // Replace remaining tasks with rebalanced ones
          const completedPart = prev.filter((_, i) => i <= currentTaskIndex);
          return [...completedPart, ...rebalanceResult.tasks];
        });

        // Try to start next study session
        setCurrentTaskIndex(currentTaskIndex + 1);
        setTimeout(() => startStudyTimer(), 500);
      }
    }

    setBreakSeconds(0);
  };

  // ===== DASHBOARD =====
  const stats = calculateDashboardStats(currentSchedule, studyState.auditLog);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatMinutes = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // ===== RENDER =====
  const todayTasks = currentSchedule;
  const activeTask = currentTaskIndex >= 0 && currentTaskIndex < todayTasks.length
    ? todayTasks[currentTaskIndex]
    : null;

  return (
    <div className="flex flex-col h-full bg-[#0c0c10] text-white overflow-hidden select-none">
      {/* ===== HEADER ===== */}
      <div className="px-6 py-4 bg-[#121218] border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white/90">
            {isBreakActive ? 'BREAK PROTOCOL' : isStudyActive ? 'STUDY PROTOCOL' : 'MISSION CONTROL'}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-tighter">
            {isBreakActive ? (
              <span className="text-orange-400">BREAK IN PROGRESS</span>
            ) : isStudyActive ? (
              <span className="text-green-400">STUDY ACTIVE</span>
            ) : todayTasks.length > 0 ? (
              <span className="text-blue-400/60">SCHEDULE READY</span>
            ) : (
              <span className="text-white/30">NO ACTIVE SCHEDULE</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {todayTasks.length > 0 && (
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                showDashboard
                  ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                  : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <BarChart3 size={12} /> {showDashboard ? 'SCHEDULE' : 'DASHBOARD'}
            </button>
          )}
          <button
            onClick={openForge}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase hover:bg-blue-500/20 transition-all"
          >
            <Zap size={12} /> FORGE
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {showDashboard ? (
          /* ===== DASHBOARD VIEW ===== */
          <DashboardPanel
            stats={stats}
            breakSeconds={breakSeconds}
            breakCount={breakCount}
            formatTime={formatTime}
            formatMinutes={formatMinutes}
          />
        ) : (
          /* ===== SCHEDULE VIEW ===== */
          <>
            {/* Session Timer Display */}
            {(isStudyActive || isBreakActive) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-3xl border ${
                  isBreakActive
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      isBreakActive ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                      <Timer size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">
                        {isBreakActive ? 'BREAK TIMER' : 'STUDY TIMER'}
                      </h3>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight">
                        {isBreakActive
                          ? 'Auto-counting — do nothing'
                          : activeTask?.title || 'Studying'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-black tabular-nums tracking-tighter ${
                      isBreakActive ? 'text-orange-400' : 'text-green-400'
                    }`}>
                    {isBreakActive
                      ? `${Math.floor(breakSeconds / 60)}:${String(breakSeconds % 60).padStart(2, '0')}`
                      : `${Math.floor(studySeconds / 60)}:${String(studySeconds % 60).padStart(2, '0')}`
                    }
                  </div>
                    {isBreakActive ? (
                      <button
                        onClick={endBreak}
                        className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-black uppercase tracking-widest transition-all animate-pulse"
                      >
                        END BREAK
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={takeBreak}
                          className="px-4 py-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          BREAK
                        </button>
                        <button
                          onClick={completeCurrentTask}
                          className="px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          DONE ✓
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Break Monitor */}
            {!isStudyActive && !isBreakActive && currentTaskIndex >= 0 && (
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/10 text-white/40">
                      <Coffee size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Study Momentum</h3>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight">
                        Paused — {formatTime(studySeconds)} studied
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={takeBreak}
                      className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-xl text-xs font-bold transition-all"
                    >
                      <Coffee size={14} /> BREAK
                    </button>
                    <button
                      onClick={completeCurrentTask}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl text-xs font-bold transition-all"
                    >
                      <CheckCircle2 size={14} /> DONE
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {todayTasks.length === 0 && !isStudyActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <Zap size={64} className="text-blue-500/20 mb-6" />
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white/30 mb-3">No Schedule Active</h3>
                <p className="text-white/20 text-sm font-medium mb-8">Forge a study plan to begin</p>
                <button
                  onClick={openForge}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/30 flex items-center gap-3"
                >
                  <Zap size={16} /> CREATE SCHEDULE
                </button>
              </motion.div>
            )}

            {/* Task List */}
            {todayTasks.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    PROTOCOL — {todayTasks.filter(t => t.completed || completedTaskIds.includes(t.id)).length}/{todayTasks.length} COMPLETE
                  </h3>
                </div>

                <div className="space-y-2">
                  {todayTasks.map((task, index) => {
                    const isCurrent = index === currentTaskIndex && isStudyActive;
                    const isCompleted = task.completed || completedTaskIds.includes(task.id);

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                          isCurrent
                            ? 'bg-green-500/10 border-green-500/40 shadow-lg shadow-green-900/20'
                            : isCompleted
                            ? 'bg-white/5 border-white/10 opacity-60'
                            : 'glass border-white/5 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className={`shrink-0 ${isCompleted ? 'text-green-500' : isCurrent ? 'text-green-400' : 'text-white/20'}`}>
                          {isCompleted ? (
                            <CheckCircle2 size={22} />
                          ) : isCurrent ? (
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                              <Play size={22} fill="currentColor" />
                            </motion.div>
                          ) : (
                            <Circle size={22} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              isCurrent ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                            }`}>
                              {task.subjectDisplay || task.subject}
                            </span>
                            <h4 className={`text-sm font-bold truncate ${isCompleted ? 'line-through opacity-40' : ''}`}>
                              {task.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-medium text-white/30">{task.startTime} — {task.endTime}</span>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="text-[10px] font-bold text-blue-500/60 uppercase">{task.duration}M</span>
                            <span className="text-[10px] font-bold" style={{
                              color: task.priority === 3 ? '#ef4444' : task.priority === 2 ? '#f59e0b' : '#6b7280'
                            }}>P{task.priority}</span>
                          </div>
                        </div>
                        {!isCompleted && !isCurrent && !isStudyActive && currentTaskIndex < 0 && (
                          <button
                            onClick={() => startStudy(index)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase transition-all opacity-0 group-hover:opacity-100"
                          >
                            START
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Start all button when no session active */}
            {todayTasks.length > 0 && currentTaskIndex < 0 && !isStudyActive && !isBreakActive && (
              <button
                onClick={() => startStudy(0)}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-xs font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/30 flex items-center justify-center gap-3"
              >
                <Lock size={14} /> <Play size={14} fill="currentColor" /> START LOCKDOWN SESSION
              </button>
            )}
          </>
        )}
      </div>

      {/* ===== FORGE OVERLAY ===== */}
      <AnimatePresence>
        {showForge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0c0c10]/98 backdrop-blur-2xl overflow-y-auto"
          >
            <div className="min-h-full flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-2xl space-y-8">

                {/* Step 1: Subjects */}
                {forgeStep === 'subjects' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <div className="text-center">
                      <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Configure Subjects</h2>
                      <p className="text-white/40 text-sm font-medium">Set your study subjects and their priorities</p>
                    </div>

                    <div className="space-y-4">
                      {forgeSubjects.map((subject, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-5 rounded-2xl bg-white/5 border border-white/10"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 flex-1">
                              <GripVertical size={16} className="text-white/20" />
                              <input
                                value={subject.name}
                                onChange={e => updateSubjectName(index, e.target.value)}
                                placeholder="Subject name"
                                className="bg-transparent text-lg font-black uppercase tracking-tight outline-none flex-1 placeholder:text-white/20"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {[1, 2, 3].map(p => (
                                  <button
                                    key={p}
                                    onClick={() => updateSubjectPriority(index, p)}
                                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                                      subject.priority === p
                                        ? p === 3 ? 'bg-red-500 text-white shadow-lg' :
                                          p === 2 ? 'bg-amber-500 text-white shadow-lg' :
                                          'bg-blue-500 text-white shadow-lg'
                                        : 'bg-white/10 text-white/30 hover:bg-white/20'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => removeSubject(index)}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <button
                      onClick={addSubject}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-white/10 text-white/40 hover:border-blue-500/30 hover:text-blue-400 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Subject
                    </button>

                    <div className="flex gap-3">
                      <button onClick={() => setShowForge(false)} className="flex-1 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                        ABORT
                      </button>
                      <button onClick={() => setForgeStep('time')} className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                        NEXT: SET TIME <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Time */}
                {forgeStep === 'time' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <div className="text-center">
                      <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Study Hours</h2>
                      <p className="text-white/40 text-sm font-medium">Set your study time window</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                        <AnimatedClock
                          value={forgeStartTime}
                          onChange={setForgeStartTime}
                          label="START TIME"
                        />
                      </div>
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                        <AnimatedClock
                          value={forgeEndTime}
                          onChange={setForgeEndTime}
                          label="END TIME"
                        />
                      </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock size={16} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-white/40">Break Configuration</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[9px] uppercase text-white/30 font-bold">Every</span>
                          <div className="text-blue-400 font-black text-sm">50 MIN</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase text-white/30 font-bold">Duration</span>
                          <div className="text-blue-400 font-black text-sm">10 MIN</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setForgeStep('subjects')} className="flex-1 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                        BACK
                      </button>
                      <button onClick={handleGenerateSchedule} className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                        GENERATE <Zap size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Preview */}
                {forgeStep === 'preview' && generatedResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                  >
                    <div className="text-center">
                      <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-green-400">✅ Schedule Ready</h2>
                      <p className="text-white/40 text-sm font-medium">
                        {generatedResult.totalMinutes} min split across {generatedResult.tasks.length} blocks
                      </p>
                    </div>

                    {/* Allocation breakdown */}
                    <div className="grid grid-cols-3 gap-4">
                      {generatedResult.subjectAllocations.map(a => (
                        <div key={a.subject} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                          <div className="text-[9px] font-black uppercase text-white/30 mb-1">{a.subject}</div>
                          <div className="text-2xl font-black text-blue-400">{formatMinutes(a.minutes)}</div>
                          <div className="text-[10px] text-white/20 font-bold">{a.percentage}%</div>
                        </div>
                      ))}
                    </div>

                    {/* Preview schedule */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Generated Timeline</h3>
                      {generatedResult.tasks.map((task, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                          <div className="w-1 h-10 rounded-full" style={{
                            background: task.priority === 3 ? '#ef4444' : task.priority === 2 ? '#f59e0b' : '#3b82f6'
                          }} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase text-white/40">{task.subjectDisplay || task.subject}</span>
                              <span className="text-xs font-bold text-white/90">{task.title}</span>
                            </div>
                            <div className="text-[10px] text-white/30 font-medium">{task.startTime} → {task.endTime} ({task.duration}min)</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase" style={{
                              color: task.priority === 3 ? '#ef4444' : task.priority === 2 ? '#f59e0b' : '#3b82f6'
                            }}>P{task.priority}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setForgeStep('time')} className="flex-1 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                        REDO
                      </button>
                      <button onClick={handleEngageSchedule} className="flex-[2] py-4 rounded-2xl bg-green-600 text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-green-900/40 hover:bg-green-500 transition-all flex items-center justify-center gap-3">
                        <Lock size={14} /> <Play size={14} fill="currentColor" /> START LOCKDOWN SESSION
                      </button>
                    </div>
                  </motion.div>
                )}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ===== DASHBOARD PANEL COMPONENT =====
interface DashboardPanelProps {
  stats: DashboardStats;
  breakSeconds: number;
  breakCount: number;
  formatTime: (s: number) => string;
  formatMinutes: (m: number) => string;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({
  stats, breakSeconds, breakCount, formatTime, formatMinutes
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 size={16} className="text-purple-400" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Study Analytics Dashboard</h3>
      </div>

      {/* Top Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
          <div className="text-[9px] font-black uppercase text-blue-400/60 tracking-widest mb-2">Completion</div>
          <div className="text-4xl font-black text-blue-400 tracking-tighter">{stats.completionRate}%</div>
          <div className="text-[10px] text-white/30 font-bold mt-1">{stats.completedTasks}/{stats.totalTasks} tasks</div>
        </div>
        <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
          <div className="text-[9px] font-black uppercase text-purple-400/60 tracking-widest mb-2">Total Study Time</div>
          <div className="text-4xl font-black text-purple-400 tracking-tighter">
            {stats.totalStudyMinutes > 0 ? formatMinutes(stats.totalStudyMinutes) : '0m'}
          </div>
          <div className="text-[10px] text-white/30 font-bold mt-1">Planned blocks</div>
        </div>
      </div>

      {/* Subject Breakdown */}
      <div className="space-y-3">
        <h4 className="text-[9px] font-black uppercase text-white/30 tracking-widest flex items-center gap-2">
          <TrendingUp size={12} className="text-green-400" /> Subject Breakdown
        </h4>
        {stats.subjectBreakdown.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-white/20 text-[10px] font-bold uppercase tracking-wider">
            No data yet
          </div>
        ) : (
          stats.subjectBreakdown.map(s => (
            <div key={s.subject} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase">{s.subject}</span>
                </div>
                <span className="text-[10px] font-bold text-white/40">
                  {s.completedTasks}/{s.tasksCount} tasks · {formatMinutes(s.totalMinutes)}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.totalMinutes > 0 ? (s.completedMinutes / s.totalMinutes) * 100 : 0}%` }}
                  className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Break Stats */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coffee size={18} className="text-orange-400" />
            <div>
              <h4 className="text-sm font-bold text-orange-300">Break Analysis</h4>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight">Session Statistics</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-orange-400">{breakCount} breaks</div>
            <div className="text-[10px] text-white/30 font-bold">~{formatTime(breakSeconds)} total</div>
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="space-y-2">
        <h4 className="text-[9px] font-black uppercase text-white/30 tracking-widest flex items-center gap-2">
          <ListChecks size={12} className="text-blue-400" /> Live Audit Log
        </h4>
        {stats.todayAuditLog.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-white/20 text-[10px] font-bold uppercase tracking-wider">
            No events recorded yet
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {stats.todayAuditLog.slice(-20).reverse().map((entry, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5" style={{
                  background: entry.action.includes('BREAK') ? '#f97316' :
                    entry.action.includes('COMPLETE') ? '#22c55e' :
                    entry.action.includes('START') ? '#3b82f6' : '#6b7280'
                }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-white/70 truncate">{entry.action}</div>
                  <div className="text-[9px] text-white/30">{entry.reason || ''}</div>
                </div>
                <div className="text-[9px] text-white/20 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scheduler;
