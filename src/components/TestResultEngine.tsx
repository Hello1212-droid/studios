import React, { useState } from 'react';
import { Trophy, TrendingUp, Plus, Calendar, Save, ChevronRight, Users, Award, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TestResult, StudyState } from '../utils/studyStore';

interface TestResultEngineProps {
  studyState: StudyState;
  setStudyState: React.Dispatch<React.SetStateAction<StudyState>>;
}

// JEE 2027 Estimated total applicants (from research data)
const JEE_2027_ESTIMATED_APPLICANTS = 1700000; // 17 lakh

// Provider difficulty multipliers for JEE equivalence
const PROVIDER_MULTIPLIERS: Record<string, number> = {
  'FIITJEE': 1.08,
  'ALLEN': 1.05,
  'MATHONGO': 1.03,
  'JEE_MAIN_PREV': 1.0,
  'JEE_ADV_PREV': 1.15,
  'AKASH': 1.04,
  'RESONANCE': 1.06,
  'UNACADEMY': 1.02,
  'BYJUS': 1.02,
};

// JEE Score ranges per percentile (approx based on 2025-2026 trends)
const PERCENTILE_TO_SCORE_MAP: [number, number][] = [
  [99.9, 280], [99.5, 240], [99, 210], [98, 180], [95, 150],
  [90, 120], [85, 100], [80, 85], [70, 65], [60, 50], [50, 38],
  [40, 28], [30, 20], [20, 12], [10, 5], [0, 0]
];

const estimateJEEScoreFromPercentile = (percentile: number): number => {
  for (const [p, score] of PERCENTILE_TO_SCORE_MAP) {
    if (percentile >= p) return score + (percentile - p) * 20;
  }
  return 0;
};

const calculateJEE2027Prediction = (
  mockScore: number,
  mockTotal: number,
  mockPercentile: number,
  mockRank: number,
  mockTotalStudents: number,
  provider: string
) => {
  // 1. Raw mock percentile from rank/total
  const rankBasedPercentile = ((mockTotalStudents - mockRank) / mockTotalStudents) * 100;

  // 2. Cross-verify with user-provided percentile, use the average
  const verifiedPercentile = mockPercentile > 0
    ? (rankBasedPercentile + mockPercentile) / 2
    : rankBasedPercentile;

  // 3. Apply provider difficulty multiplier
  let multiplier = 1.0;
  const matchedKey = Object.keys(PROVIDER_MULTIPLIERS).find(
    k => provider.toUpperCase().includes(k)
  );
  if (matchedKey) multiplier = PROVIDER_MULTIPLIERS[matchedKey];

  const jeeEquivalentPercentile = Math.min(99.99, verifiedPercentile * multiplier);

  // 4. Project to JEE 2027 context
  // If rank-based percentile is X% among mock students, project same percentile among JEE applicants
  const projectedJeeRank = Math.round(
    JEE_2027_ESTIMATED_APPLICANTS * (1 - jeeEquivalentPercentile / 100)
  );

  // 5. Estimate JEE score from percentile
  const estimatedJeeScore = estimateJEEScoreFromPercentile(jeeEquivalentPercentile);

  // 6. Calculate improvement targets
  const targetPercentile = calculateTarget(jeeEquivalentPercentile);
  const targetRank = Math.round(
    JEE_2027_ESTIMATED_APPLICANTS * (1 - targetPercentile / 100)
  );
  const targetScore = estimateJEEScoreFromPercentile(targetPercentile);

  // 7. Marks percentage
  const marksPercentage = mockTotal > 0 ? (mockScore / mockTotal) * 100 : 0;

  return {
    mockPercentile: parseFloat(verifiedPercentile.toFixed(3)),
    jeeEquivalentPercentile: parseFloat(jeeEquivalentPercentile.toFixed(3)),
    projectedJeeRank,
    estimatedJeeScore,
    targetPercentile: parseFloat(targetPercentile.toFixed(3)),
    targetRank,
    targetScore,
    marksPercentage: parseFloat(marksPercentage.toFixed(1)),
    gap: parseFloat((targetPercentile - jeeEquivalentPercentile).toFixed(3)),
    jeeApplicants: JEE_2027_ESTIMATED_APPLICANTS,
  };
};

const calculateTarget = (currentJeeEquiv: number): number => {
  if (currentJeeEquiv >= 99.9) return 99.99;
  if (currentJeeEquiv >= 99) return Math.min(99.99, currentJeeEquiv + 0.2);
  if (currentJeeEquiv >= 95) return currentJeeEquiv + 1.0;
  if (currentJeeEquiv >= 90) return currentJeeEquiv + 3.0;
  if (currentJeeEquiv >= 80) return currentJeeEquiv + 5.0;
  return Math.max(90, currentJeeEquiv + 8.0);
};

interface FormData {
  testName: string;
  provider: string;
  score: string;
  total: string;
  rank: string;
  totalStudents: string;
  percentile: string;
}

const TestResultEngine: React.FC<TestResultEngineProps> = ({ studyState, setStudyState }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predictionProvider, setPredictionProvider] = useState('');
  const [showPrediction, setShowPrediction] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    testName: '',
    provider: '',
    score: '',
    total: '',
    rank: '',
    totalStudents: '',
    percentile: '',
  });

  const handleSave = () => {
    if (!formData.testName || !formData.score || !formData.total || !formData.rank) return;

    const score = parseInt(formData.score);
    const total = parseInt(formData.total);
    const rank = parseInt(formData.rank);
    const totalStudents = parseInt(formData.totalStudents) || 10000;
    const percentile = parseFloat(formData.percentile) || 0;

    const prediction = calculateJEE2027Prediction(
      score, total, percentile, rank, totalStudents, formData.provider
    );
    setPredictionResult(prediction);
    setPredictionProvider(formData.provider);

    const newResult: TestResult = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      testName: formData.testName,
      provider: formData.provider || 'Unknown',
      score,
      total,
      rank,
      totalStudents,
      overallPercentile: prediction.mockPercentile,
      subjectPercentiles: { PHYSICS: 0, CHEMISTRY: 0, MATHS: 0 },
      jeeEquivalentPercentile: prediction.jeeEquivalentPercentile,
      targetPercentile: prediction.targetPercentile,
    };

    setStudyState(prev => ({
      ...prev,
      testResults: [newResult, ...(prev.testResults || [])]
    }));

    setShowAddForm(false);
    setShowPrediction(true);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      testName: '',
      provider: '',
      score: '',
      total: '',
      rank: '',
      totalStudents: '',
      percentile: '',
    });
  };

  const results = studyState.testResults || [];
  const latestResult = results[0];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-white overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#121218] shrink-0">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 tracking-tighter">
            <Trophy className="text-yellow-500" size={32} />
            PERCENTILE <span className="text-blue-500">ENGINE</span>
          </h1>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mt-1">
            JEE 2027 Score Predictor
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-black uppercase tracking-widest shadow-xl shadow-blue-600/20"
        >
          <Plus size={20} /> Log Result
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        {/* Prediction Result Panel */}
        {showPrediction && predictionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Main Prediction Card */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/10 border border-blue-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={16} className="text-blue-400" />
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">JEE 2027 Prediction</span>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Predicted JEE 2027 Equivalent</div>
                    <div className="text-6xl font-black text-blue-400 tracking-tighter">
                      {predictionResult.jeeEquivalentPercentile}
                      <span className="text-2xl opacity-50 ml-1">%ile</span>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="bg-blue-500/10 rounded-xl px-3 py-1.5">
                        <span className="text-[10px] text-blue-400 font-black uppercase">Est. Score</span>
                        <div className="text-lg font-black text-white">{predictionResult.estimatedJeeScore}/300</div>
                      </div>
                      <div className="bg-blue-500/10 rounded-xl px-3 py-1.5">
                        <span className="text-[10px] text-blue-400 font-black uppercase">Projected Rank</span>
                        <div className="text-lg font-black text-white">#{predictionResult.projectedJeeRank.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <div className="text-right">
                      <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Target for Next Attempt</div>
                      <div className="text-4xl font-black text-purple-400 tracking-tighter">
                        {predictionResult.targetPercentile}
                        <span className="text-base opacity-50 ml-1">%ile</span>
                      </div>
                      <div className="text-xs text-purple-400/60 font-bold mt-1 uppercase tracking-wider">
                        Target Rank: #{predictionResult.targetRank.toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-4 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/30">
                      <span className="text-[10px] font-black uppercase text-red-400">Gap to Target</span>
                      <div className="text-2xl font-black text-red-400">-{predictionResult.gap}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Raw Mock %ile</div>
                <div className="text-xl font-black text-white/80">{predictionResult.mockPercentile}</div>
                <div className="text-[9px] text-white/20 mt-0.5">From rank data</div>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Marks %</div>
                <div className="text-xl font-black text-green-400">{predictionResult.marksPercentage}%</div>
                <div className="text-[9px] text-white/20 mt-0.5">Score/Total</div>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Provider Factor</div>
                <div className="text-xl font-black text-amber-400">
                  {predictionProvider ? `1.0${(predictionResult.jeeEquivalentPercentile / Math.max(0.1, predictionResult.mockPercentile)).toFixed(2).slice(2)}x` : '1.00x'}
                </div>
                <div className="text-[9px] text-white/20 mt-0.5">Difficulty multiplier</div>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">JEE 2027 Applicants</div>
                <div className="text-xl font-black text-purple-400">{predictionResult.jeeApplicants.toLocaleString()}</div>
                <div className="text-[9px] text-white/20 mt-0.5">Estimated</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Current Status Cards */}
        {latestResult && (
          <div className="grid grid-cols-3 gap-6">
            <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-transparent">
              <div className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2">JEE 2027 Equivalent</div>
              <div className="text-4xl font-black text-blue-400 tracking-tighter">
                {latestResult.jeeEquivalentPercentile} <span className="text-lg opacity-50">%ile</span>
              </div>
              <div className="text-[10px] text-white/20 mt-2 font-bold uppercase italic">Latest result scaled</div>
            </div>

            <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-transparent">
              <div className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Next Target</div>
              <div className="text-4xl font-black text-purple-400 tracking-tighter">
                {latestResult.targetPercentile} <span className="text-lg opacity-50">%ile</span>
              </div>
              <div className="text-[10px] text-white/20 mt-2 font-bold uppercase italic">
                Gap: +{(latestResult.targetPercentile - latestResult.jeeEquivalentPercentile).toFixed(3)}%
              </div>
            </div>

            <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-green-500/10 to-transparent">
              <div className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Latest Rank</div>
              <div className="text-4xl font-black text-green-400 tracking-tighter">
                #{latestResult.rank.toLocaleString()}
              </div>
              <div className="text-[10px] text-white/20 mt-2 font-bold uppercase italic">
                Out of {latestResult.totalStudents.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Trajectory History */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">
            <TrendingUp size={14} className="text-green-400" /> Trajectory History
          </h2>

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/10 border-2 border-dashed border-white/5 rounded-3xl">
              <Calendar size={64} className="mb-4 opacity-5" />
              <p className="font-black uppercase tracking-widest text-sm text-white/20">No Combat Data Logged</p>
              <p className="text-[10px] text-white/10 mt-2 font-bold">Log your first mock test to get JEE 2027 prediction</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, idx) => {
                const prevResult = idx < results.length - 1 ? results[idx + 1] : null;
                const improvement = prevResult
                  ? (result.jeeEquivalentPercentile - prevResult.jeeEquivalentPercentile).toFixed(2)
                  : '0.00';

                return (
                  <div key={result.id} className="glass p-5 rounded-3xl border border-white/5 hover:bg-white/[0.02] transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 border border-blue-500/20">
                          <Award size={24} />
                        </div>
                        <div>
                          <div className="font-black text-lg tracking-tight">{result.testName}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="bg-blue-500/10 text-blue-400 text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-blue-500/20">
                              {result.provider}
                            </span>
                            <span className="text-white/20 text-[9px] font-bold">{result.date}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-0.5">Mock %ile</div>
                          <div className="text-base font-black text-white/60">{result.overallPercentile}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-blue-400/40 text-[9px] uppercase tracking-widest font-black mb-0.5">JEE 2027</div>
                          <div className="text-xl font-black text-blue-400">{result.jeeEquivalentPercentile}%ile</div>
                        </div>
                        <div className="text-right min-w-[60px]">
                          <div className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-0.5">vs Prev</div>
                          <div className={`text-base font-black ${parseFloat(improvement) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {parseFloat(improvement) >= 0 ? '+' : ''}{improvement}
                          </div>
                        </div>
                        <ChevronRight className="text-white/10 group-hover:text-white/40 transition-colors" size={16} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== ADD RESULT OVERLAY ===== */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-8 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-2xl space-y-8"
            >
              <div className="text-center">
                <h2 className="text-3xl font-black tracking-tighter mb-2 flex items-center justify-center gap-3">
                  <Trophy className="text-yellow-500" size={28} /> NEW COMBAT RECORD
                </h2>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                  Enter your mock stats for JEE 2027 prediction
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2 col-span-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black ml-1">Test Name</label>
                  <input
                    type="text"
                    value={formData.testName}
                    onChange={e => setFormData({ ...formData, testName: e.target.value })}
                    placeholder="e.g. AITS Phase 1"
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all placeholder:text-white/20"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black ml-1">Score Obtained</label>
                  <input
                    type="number"
                    value={formData.score}
                    onChange={e => setFormData({ ...formData, score: e.target.value })}
                    placeholder="e.g. 170"
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black ml-1">Out Of</label>
                  <input
                    type="number"
                    value={formData.total}
                    onChange={e => setFormData({ ...formData, total: e.target.value })}
                    placeholder="e.g. 300"
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-purple-400 uppercase tracking-[0.2em] font-black ml-1">Your Rank</label>
                  <input
                    type="number"
                    value={formData.rank}
                    onChange={e => setFormData({ ...formData, rank: e.target.value })}
                    placeholder="e.g. 8655"
                    className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 text-sm font-black focus:outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black ml-1">Total Candidates</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.totalStudents}
                      onChange={e => setFormData({ ...formData, totalStudents: e.target.value })}
                      placeholder="e.g. 15000"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <Users size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black ml-1">Percentile (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.percentile}
                    onChange={e => setFormData({ ...formData, percentile: e.target.value })}
                    placeholder="e.g. 39.07"
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 col-span-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black ml-1">Test Provider</label>
                  <select
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="">Select Provider (affects scaling)</option>
                    <option value="FIITJEE">FIITJEE (High Difficulty ×1.08)</option>
                    <option value="ALLEN">ALLEN (Medium-High ×1.05)</option>
                    <option value="RESONANCE">Resonance (High ×1.06)</option>
                    <option value="AKASH">Aakash (Medium ×1.04)</option>
                    <option value="MATHONGO">MathonGo (JEE Level ×1.03)</option>
                    <option value="UNACADEMY">Unacademy (Standard ×1.02)</option>
                    <option value="JEE_MAIN_PREV">JEE Main Previous Year (Baseline ×1.0)</option>
                    <option value="JEE_ADV_PREV">JEE Advanced Previous Year (Very High ×1.15)</option>
                    <option value="OTHER">Other / Local (Standard ×1.0)</option>
                  </select>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-3">
                  <Brain size={16} className="text-blue-400" />
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">JEE 2027 Prediction Engine</span>
                </div>
                <p className="text-xs text-white/30 mt-2 leading-relaxed">
                  Your input will be cross-verified against ~{JEE_2027_ESTIMATED_APPLICANTS.toLocaleString()} estimated JEE Main 2027 applicants.
                  Difficulty multipliers adjust for provider toughness. Target is auto-calculated for next milestone.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-8 py-5 rounded-[1.5rem] bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-xs"
                >
                  Abort
                </button>
                <button
                  onClick={handleSave}
                  className="flex-[2] px-8 py-5 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 transition-all font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-2xl shadow-blue-600/30"
                >
                  <Save size={18} /> Predict JEE 2027 Score
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TestResultEngine;
