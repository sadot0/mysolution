import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Loader2, ArrowRight, Mail, Calendar, BrainCircuit,
  GripVertical, UserPlus, UserX, UserCheck, Sparkles, Plus,
} from 'lucide-react';
import { candidatesApi } from '../utils/api';
import { Candidate } from '../types';
import { getCategoryColor, getCategoryLabel, formatDate } from '../utils/helpers';
import { staggerItem } from '../utils/animations';

const COLUMNS = [
  {
    id: 'new' as const,
    label: 'НОВЫЕ',
    color: '#fbbf24',
    dotCls: 'bg-yellow-400',
    cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
    statuses: ['new', 'error'],
    icon: Sparkles,
  },
  {
    id: 'analyzed' as const,
    label: 'ОЦЕНЕНЫ',
    color: '#f97316',
    dotCls: 'bg-orange-500',
    cls: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
    statuses: ['analyzed', 'analyzing'],
    icon: BrainCircuit,
  },
  {
    id: 'invited' as const,
    label: 'ПРИГЛАШЕНЫ',
    color: '#10b981',
    dotCls: 'bg-emerald-500',
    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    statuses: ['invited'],
    icon: UserCheck,
  },
  {
    id: 'rejected' as const,
    label: 'ОТКЛОНЕНЫ',
    color: '#f87171',
    dotCls: 'bg-red-400',
    cls: 'bg-red-500/10 border-red-500/30 text-red-500',
    statuses: ['rejected'],
    icon: UserX,
  },
] as const;

type MoveTarget = 'new' | 'analyzed' | 'invited' | 'rejected';

const COLUMN_ICONS: Record<string, typeof Sparkles> = {
  new: Sparkles,
  analyzed: BrainCircuit,
  invited: UserCheck,
  rejected: UserX,
};

interface KanbanBoardProps {
  candidates: Candidate[];
  onRefetch: () => void;
}

export default function KanbanBoard({ candidates, onRefetch }: KanbanBoardProps) {
  const navigate = useNavigate();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (!dragCounterRef.current[colId]) dragCounterRef.current[colId] = 0;
    dragCounterRef.current[colId]++;
    setDragOverCol(colId);
  };

  const handleDragLeave = (_e: React.DragEvent, colId: string) => {
    if (!dragCounterRef.current[colId]) dragCounterRef.current[colId] = 0;
    dragCounterRef.current[colId]--;
    if (dragCounterRef.current[colId] <= 0) {
      dragCounterRef.current[colId] = 0;
      if (dragOverCol === colId) setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    dragCounterRef.current[colId] = 0;
    setDragOverCol(null);
    const candidateId = e.dataTransfer.getData('candidateId');
    if (!candidateId) return;
    // Find current status of the candidate
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    // Don't move if already in the target column
    const col = COLUMNS.find(c => c.id === colId);
    if (col && (col.statuses as readonly string[]).includes(candidate.status)) return;
    moveCandidate(candidateId, colId);
  };

  return (
    <div className="kanban-board grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none">
      {COLUMNS.map((col) => {
        const colCandidates = candidates.filter((c) =>
          (col.statuses as readonly string[]).includes(c.status),
        );

        return (
          <div
            key={col.id}
            className={`kanban-column flex flex-col gap-3 min-w-[280px] sm:min-w-0 snap-center transition-all duration-200 ${dragOverCol === col.id ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, col.id)}
            onDragLeave={(e) => handleDragLeave(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between px-3.5 py-3 rounded-xl border ${col.cls}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotCls} shrink-0`} />
                <span className="text-xs font-bold tracking-wider">
                  {col.label}
                </span>
              </div>
              <span
                className="text-[11px] font-black font-mono rounded-md px-2 py-0.5 min-w-[28px] text-center"
                style={{
                  background: `${col.color}20`,
                  color: col.color,
                }}
              >
                {colCandidates.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2.5 min-h-[240px]">
              <AnimatePresence mode="popLayout">
                {colCandidates.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    variants={staggerItem}
                    initial="initial"
                    animate="animate"
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  >
                    <KanbanCard
                      candidate={c}
                      col={col}
                      moving={movingId === c.id}
                      onMove={moveCandidate}
                      onClick={() => navigate(`/candidates/${c.id}`)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {colCandidates.length === 0 && (
                <div
                  className="rounded-xl flex flex-col items-center justify-center min-h-[120px] border-2 border-dashed border-white/[0.04] bg-white/[0.01] gap-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.02] flex items-center justify-center">
                    <Plus size={14} className="text-white/25" />
                  </div>
                  <p className="text-xs text-white/25">
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
  const [isDragging, setIsDragging] = useState(false);
  const analysis = c.ai_analysis;
  const isAnalyzing = c.status === 'analyzing';
  const isExcellent = analysis && analysis.overall_score >= 90;

  const targets = COLUMNS.filter((col2) => col2.id !== col.id && col2.id !== 'analyzed');

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('candidateId', c.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`kanban-card group bg-white/[0.03] border border-white/[0.05] rounded-xl cursor-pointer hover:border-orange-500/50 transition-all duration-200 flex flex-col relative overflow-hidden hover:shadow-lg hover:shadow-orange-500/5 ${isDragging ? 'dragging' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: col.color }}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Grip handle + Name + Score */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 cursor-grab">
            <GripVertical size={14} className="text-white/40" />
          </div>
          <p className="font-bold text-white text-sm leading-tight flex-1 truncate">
            {c.full_name}
          </p>
          {analysis ? (
            <div className="relative shrink-0">
              {isExcellent && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid rgba(16,185,129,0.3)',
                    animation: 'statusPulse 2s ease-in-out infinite',
                    margin: -3,
                    borderRadius: '50%',
                  }}
                />
              )}
              <div
                className={`flex items-center justify-center rounded-full font-black text-xs w-9 h-9 font-mono ${
                  analysis.overall_score >= 90
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : analysis.overall_score >= 75
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : analysis.overall_score >= 60
                    ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
                    : 'bg-white/[0.02] border-white/[0.08] text-white/60'
                } border`}
              >
                {analysis.overall_score}
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="shrink-0 w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Loader2 size={14} className="text-blue-400 animate-spin" />
            </div>
          ) : null}
        </div>

        {/* Email */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 pl-6">
          <Mail size={10} className="shrink-0" />
          <span className="truncate">{c.email}</span>
        </div>

        {/* AI category */}
        {analysis && (
          <div className="pl-6">
            <span className={`text-xs font-semibold ${getCategoryColor(analysis.category)}`}>
              {getCategoryLabel(analysis.category)}
            </span>
          </div>
        )}

        {!analysis && !isAnalyzing && (
          <div className="flex items-center gap-1.5 text-xs text-white/25 pl-6">
            <BrainCircuit size={11} />
            Без анализа
          </div>
        )}

        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-white/25 font-mono pl-6">
          <Calendar size={10} className="shrink-0" />
          {formatDate(c.submitted_at)}
        </div>
      </div>

      {/* Move button */}
      {!isAnalyzing && (
        <div
          className="relative px-3.5 py-2.5 border-t border-white/[0.03] bg-white/[0.02]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-1.5 text-xs w-full text-white/40 hover:text-orange-400 transition-colors font-medium"
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
            <div className="absolute bottom-full left-2 right-2 mb-1.5 rounded-xl overflow-hidden z-30 bg-white/[0.03] border border-white/[0.06] shadow-xl shadow-black/50">
              {targets.map((target) => {
                const Icon = COLUMN_ICONS[target.id] || UserPlus;
                return (
                  <button
                    key={target.id}
                    className="w-full text-left text-xs px-3.5 py-3 flex items-center gap-3 text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors"
                    onClick={() => {
                      setShowMove(false);
                      onMove(c.id, target.id);
                    }}
                  >
                    <Icon size={13} style={{ color: target.color }} className="shrink-0" />
                    <span className="flex-1">{target.label}</span>
                    <ArrowRight size={10} className="text-white/25" />
                  </button>
                );
              })}
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
