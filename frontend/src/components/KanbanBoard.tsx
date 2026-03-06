import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight, Mail, Calendar, BrainCircuit } from 'lucide-react';
import { candidatesApi } from '../utils/api';
import { Candidate } from '../types';
import { getCategoryColor, getCategoryLabel, formatDate } from '../utils/helpers';

const COLUMNS = [
  {
    id: 'new' as const,
    label: 'Новые',
    color: '#fbbf24',
    border: 'rgba(245,158,11,0.3)',
    bg: 'rgba(245,158,11,0.04)',
    statuses: ['new', 'error'],
  },
  {
    id: 'analyzed' as const,
    label: 'Оценены',
    color: '#FF9A3C',
    border: 'rgba(255,110,0,0.3)',
    bg: 'rgba(255,110,0,0.04)',
    statuses: ['analyzed', 'analyzing'],
  },
  {
    id: 'invited' as const,
    label: 'Приглашены',
    color: '#10b981',
    border: 'rgba(16,185,129,0.3)',
    bg: 'rgba(16,185,129,0.04)',
    statuses: ['invited'],
  },
  {
    id: 'rejected' as const,
    label: 'Отклонены',
    color: '#f87171',
    border: 'rgba(239,68,68,0.3)',
    bg: 'rgba(239,68,68,0.04)',
    statuses: ['rejected'],
  },
] as const;

type MoveTarget = 'new' | 'analyzed' | 'invited' | 'rejected';

interface KanbanBoardProps {
  candidates: Candidate[];
  onRefetch: () => void;
}

export default function KanbanBoard({ candidates, onRefetch }: KanbanBoardProps) {
  const navigate = useNavigate();
  const [movingId, setMovingId] = useState<string | null>(null);

  const moveCandidate = async (id: string, status: string) => {
    setMovingId(id);
    try {
      await candidatesApi.updateStatus(id, status);
      onRefetch();
    } catch {
      toast.error('Ошибка изменения статуса');
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colCandidates = candidates.filter((c) =>
          (col.statuses as readonly string[]).includes(c.status),
        );

        return (
          <div key={col.id} className="flex flex-col gap-3 min-w-0">
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: col.bg, border: `1px solid ${col.border}` }}
            >
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: col.color }}
              >
                {col.label}
              </span>
              <span
                className="text-xs font-black min-w-[20px] h-5 flex items-center justify-center rounded-full"
                style={{
                  background: col.bg,
                  color: col.color,
                  border: `1px solid ${col.border}`,
                  padding: '0 6px',
                }}
              >
                {colCandidates.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2.5" style={{ minHeight: 240 }}>
              {colCandidates.map((c) => (
                <KanbanCard
                  key={c.id}
                  candidate={c}
                  col={col}
                  moving={movingId === c.id}
                  onMove={moveCandidate}
                  onClick={() => navigate(`/candidates/${c.id}`)}
                />
              ))}
              {colCandidates.length === 0 && (
                <div
                  className="rounded-2xl flex items-center justify-center"
                  style={{
                    minHeight: 100,
                    border: `1px dashed ${col.border}`,
                    background: `${col.bg}`,
                  }}
                >
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    Нет кандидатов
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  candidate: c,
  col,
  moving,
  onMove,
  onClick,
}: {
  candidate: Candidate;
  col: typeof COLUMNS[number];
  moving: boolean;
  onMove: (id: string, status: MoveTarget) => void;
  onClick: () => void;
}) {
  const [showMove, setShowMove] = useState(false);
  const analysis = c.ai_analysis;
  const isAnalyzing = c.status === 'analyzing';

  const targets = COLUMNS.filter((col2) => col2.id !== col.id && col2.id !== 'analyzed');

  return (
    <div
      className="card flex flex-col gap-2.5"
      style={{
        padding: '0.875rem',
        position: 'relative',
        borderColor: col.border,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onClick={onClick}
    >
      {/* Name + score */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-white text-sm leading-tight flex-1 truncate">
          {c.full_name}
        </p>
        {analysis ? (
          <div
            className="shrink-0 flex items-center justify-center rounded-full font-black text-xs"
            style={{
              width: 32, height: 32,
              background:
                analysis.overall_score >= 90
                  ? 'rgba(16,185,129,0.15)'
                  : analysis.overall_score >= 75
                  ? 'rgba(255,110,0,0.15)'
                  : 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${
                analysis.overall_score >= 90
                  ? 'rgba(16,185,129,0.4)'
                  : analysis.overall_score >= 75
                  ? 'rgba(255,110,0,0.4)'
                  : 'rgba(255,255,255,0.12)'
              }`,
              color: getCategoryColor(analysis.category).replace('text-', '').includes('emerald')
                ? '#10b981'
                : getCategoryColor(analysis.category).includes('blue')
                ? '#60a5fa'
                : getCategoryColor(analysis.category).includes('yellow')
                ? '#fbbf24'
                : '#f87171',
            }}
          >
            {analysis.overall_score}
          </div>
        ) : isAnalyzing ? (
          <Loader2 size={14} className="text-blue-400 animate-spin shrink-0 mt-0.5" />
        ) : null}
      </div>

      {/* Email */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <Mail size={10} />
        <span className="truncate">{c.email}</span>
      </div>

      {/* AI category */}
      {analysis && (
        <span className={`text-xs font-semibold ${getCategoryColor(analysis.category)}`}>
          {getCategoryLabel(analysis.category)}
        </span>
      )}

      {!analysis && !isAnalyzing && (
        <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          <BrainCircuit size={11} />
          Без анализа
        </div>
      )}

      {/* Date */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        <Calendar size={10} />
        {formatDate(c.submitted_at)}
      </div>

      {/* Move button */}
      {!isAnalyzing && (
        <div
          className="relative pt-2 mt-0.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-1 text-xs w-full transition-colors"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = col.color)}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
            onClick={() => setShowMove(!showMove)}
            disabled={moving}
          >
            {moving ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <ArrowRight size={11} />
            )}
            Переместить
          </button>

          {showMove && (
            <div
              className="absolute bottom-full left-0 mb-1 rounded-xl overflow-hidden z-30"
              style={{
                background: 'rgba(10,7,3,0.98)',
                border: '1px solid rgba(255,110,0,0.2)',
                backdropFilter: 'blur(24px)',
                minWidth: 150,
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              }}
            >
              {targets.map((target) => (
                <button
                  key={target.id}
                  className="w-full text-left text-xs px-3 py-2.5 flex items-center gap-2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,110,0,0.08)';
                    e.currentTarget.style.color = target.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                  }}
                  onClick={() => {
                    setShowMove(false);
                    onMove(c.id, target.id);
                  }}
                >
                  <span style={{ color: target.color, fontSize: 8 }}>●</span>
                  {target.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function _getCategoryColor(category: string): string {
  switch (category) {
    case 'excellent': return '#10b981';
    case 'good': return '#60a5fa';
    case 'average': return '#fbbf24';
    default: return '#f87171';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void _getCategoryColor;
export { _getCategoryColor as getScoreColor };
