import { useState, useEffect, useMemo } from 'react';
import { X, Trophy, AlertTriangle, Loader2 } from 'lucide-react';
import { candidatesApi } from '../utils/api';
import type { AIScores } from '../types';

interface CompareCandidate {
  id: string;
  full_name: string;
  email: string;
  status: string;
  submitted_at: string;
  ai_analysis: {
    overall_score: number;
    category: string;
    scores: AIScores;
    strengths: string[];
    weaknesses: string[];
    summary: string;
  } | null;
  vacancies: { title: string } | null;
}

interface ComparisonResult {
  recommended: string;
  recommended_name: string;
  reason: string;
}

interface CompareModalProps {
  candidateIds: string[];
  onClose: () => void;
}

const SCORE_LABELS: Record<keyof AIScores, string> = {
  hard_skills: 'Hard Skills',
  experience: 'Опыт',
  education: 'Образование',
  soft_skills: 'Soft Skills',
  languages: 'Языки',
  culture_fit: 'Культура',
};

const SCORE_KEYS: (keyof AIScores)[] = [
  'hard_skills', 'experience', 'education', 'soft_skills', 'languages', 'culture_fit',
];

const COLORS = ['#f97316', '#3B82F6', '#10B981', '#A855F7', '#EF4444'];

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    excellent: 'Отлично', good: 'Хорошо', average: 'Средне', below: 'Ниже среднего', below_average: 'Ниже среднего',
  };
  return map[cat] || cat;
}

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    excellent: 'bg-green-500/20 text-green-400', good: 'bg-blue-500/20 text-blue-400',
    average: 'bg-yellow-500/20 text-yellow-400', below: 'bg-red-500/20 text-red-400',
    below_average: 'bg-red-500/20 text-red-400',
  };
  return map[cat] || 'bg-white/[0.06] text-white/60';
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 75) return 'text-blue-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// SVG Radar/Spider Chart
function RadarChart({ candidates, colors }: { candidates: CompareCandidate[]; colors: string[] }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 110;
  const levels = 5;
  const keys = SCORE_KEYS;
  const n = keys.length;

  const angleSlice = (Math.PI * 2) / n;

  function getPoint(index: number, value: number): [number, number] {
    const angle = angleSlice * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Grid circles
  const gridCircles = Array.from({ length: levels }, (_, i) => {
    const r = (radius / levels) * (i + 1);
    return (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    );
  });

  // Axis lines + labels
  const axes = keys.map((key, i) => {
    const [x, y] = getPoint(i, 100);
    const [lx, ly] = getPoint(i, 118);
    return (
      <g key={key}>
        <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x={lx} y={ly} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle" dominantBaseline="middle">
          {SCORE_LABELS[key]}
        </text>
      </g>
    );
  });

  // Candidate polygons
  const polygons = candidates
    .filter(c => c.ai_analysis?.scores)
    .map((c, ci) => {
      const scores = c.ai_analysis!.scores;
      const points = keys.map((key, i) => {
        const val = scores[key] ?? 0;
        return getPoint(i, val);
      });
      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
      const color = colors[ci] || '#999';
      return (
        <g key={c.id}>
          <path d={pathD} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" />
          {points.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
          ))}
        </g>
      );
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {gridCircles}
      {axes}
      {polygons}
    </svg>
  );
}

export default function CompareModal({ candidateIds, onClose }: CompareModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CompareCandidate[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    candidatesApi.compareMulti(candidateIds)
      .then(res => {
        if (cancelled) return;
        setCandidates(res.data.candidates || []);
        setComparison(res.data.comparison || null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Ошибка загрузки данных');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [candidateIds]);

  const colors = useMemo(() => candidates.map((_, i) => COLORS[i % COLORS.length]), [candidates]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onClick={onClose}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-6xl mx-4 bg-white/[0.03] border border-white/[0.04] rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.04]">
          <h2 className="text-xl font-bold text-white">Сравнение кандидатов</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.04] text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span className="ml-3 text-white/60">Загрузка...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-20 text-red-400">
              <AlertTriangle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          {!loading && !error && candidates.length > 0 && (
            <>
              {/* AI Recommendation Banner */}
              {comparison && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-orange-400 flex-shrink-0" />
                    <div>
                      <p className="text-white font-semibold">
                        Рекомендуем: {comparison.recommended_name}
                      </p>
                      <p className="text-white/60 text-sm mt-0.5">{comparison.reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Radar Chart */}
              <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <h3 className="text-sm font-medium text-white/60 mb-3 text-center">Радарная диаграмма</h3>
                <RadarChart candidates={candidates} colors={colors} />
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-3">
                  {candidates.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
                      <span className="text-sm text-white/80">{c.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="text-left text-sm font-medium text-white/40 pb-4 pr-4 w-36">Параметр</th>
                      {candidates.map((c, i) => (
                        <th key={c.id} className="text-center pb-4 px-3" style={{ minWidth: '160px' }}>
                          {/* Avatar + Name */}
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: colors[i] + '33', border: `2px solid ${colors[i]}` }}
                            >
                              {getInitials(c.full_name)}
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm leading-tight">{c.full_name}</p>
                              <p className="text-white/40 text-xs mt-0.5">{c.email}</p>
                            </div>
                            {comparison?.recommended === c.id && (
                              <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                                <Trophy size={10} /> Лучший
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {/* Overall Score */}
                    <tr>
                      <td className="py-4 pr-4 text-sm text-white/60 font-medium">Общий балл</td>
                      {candidates.map(c => (
                        <td key={c.id} className="py-4 px-3 text-center">
                          {c.ai_analysis ? (
                            <span className={`text-3xl font-bold ${getScoreColor(c.ai_analysis.overall_score)}`}>
                              {c.ai_analysis.overall_score}
                            </span>
                          ) : (
                            <span className="text-white/25 text-sm">Нет данных</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Category */}
                    <tr>
                      <td className="py-3 pr-4 text-sm text-white/60 font-medium">Категория</td>
                      {candidates.map(c => (
                        <td key={c.id} className="py-3 px-3 text-center">
                          {c.ai_analysis ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(c.ai_analysis.category)}`}>
                              {getCategoryLabel(c.ai_analysis.category)}
                            </span>
                          ) : (
                            <span className="text-white/25 text-sm">--</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Individual scores */}
                    {SCORE_KEYS.map(key => (
                      <tr key={key}>
                        <td className="py-3 pr-4 text-sm text-white/60">{SCORE_LABELS[key]}</td>
                        {candidates.map((c, ci) => {
                          const score = c.ai_analysis?.scores?.[key];
                          return (
                            <td key={c.id} className="py-3 px-3">
                              {score != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-white/[0.02] rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${score}%`, backgroundColor: colors[ci] }}
                                    />
                                  </div>
                                  <span className="text-sm text-white/80 w-8 text-right font-mono">{score}</span>
                                </div>
                              ) : (
                                <span className="text-white/25 text-sm">--</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Strengths */}
                    <tr>
                      <td className="py-3 pr-4 text-sm text-white/60 font-medium align-top">Сильные стороны</td>
                      {candidates.map(c => (
                        <td key={c.id} className="py-3 px-3 align-top">
                          {c.ai_analysis?.strengths?.length ? (
                            <ul className="space-y-1">
                              {c.ai_analysis.strengths.slice(0, 5).map((s, i) => (
                                <li key={i} className="text-xs text-green-400/80 flex items-start gap-1.5">
                                  <span className="mt-1 w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-white/25 text-sm">--</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Weaknesses */}
                    <tr>
                      <td className="py-3 pr-4 text-sm text-white/60 font-medium align-top">Слабые стороны</td>
                      {candidates.map(c => (
                        <td key={c.id} className="py-3 px-3 align-top">
                          {c.ai_analysis?.weaknesses?.length ? (
                            <ul className="space-y-1">
                              {c.ai_analysis.weaknesses.slice(0, 5).map((w, i) => (
                                <li key={i} className="text-xs text-red-400/80 flex items-start gap-1.5">
                                  <span className="mt-1 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-white/25 text-sm">--</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loading && !error && candidates.length === 0 && (
            <div className="text-center py-20 text-white/40">
              Кандидаты не найдены
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
