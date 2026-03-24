import { useState, useMemo } from 'react';
import { usePageTitle } from '../utils/usePageTitle';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Code,
  Brain,
  Database,
  MessageCircle,
  Globe,
  Lightbulb,
  Puzzle,
  Plus,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Play,
  Trophy,
  X,
  Search,
  UserCheck,
} from 'lucide-react';
import Layout from '../components/Layout';
import { candidatesApi } from '../utils/api';
import { formatDate } from '../utils/helpers';
import { pageVariants, staggerContainer, staggerItem } from '../utils/animations';
import type { LucideIcon } from 'lucide-react';
import type { Candidate } from '../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface TestTemplate {
  id: string;
  title: string;
  icon: LucideIcon;
  questionCount: number;
  timeMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completedCount: number;
  avgScore: number;
}

interface TestResult {
  id: string;
  candidateName: string;
  testName: string;
  score: number;
  maxScore: number;
  date: string;
  passed: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const TEST_TEMPLATES: TestTemplate[] = [
  { id: '1', title: 'JavaScript основы', icon: Code, questionCount: 20, timeMinutes: 30, difficulty: 'intermediate', completedCount: 142, avgScore: 68 },
  { id: '2', title: 'React & Frontend', icon: Code, questionCount: 15, timeMinutes: 25, difficulty: 'advanced', completedCount: 89, avgScore: 71 },
  { id: '3', title: 'Python & Backend', icon: Brain, questionCount: 20, timeMinutes: 30, difficulty: 'intermediate', completedCount: 117, avgScore: 65 },
  { id: '4', title: 'SQL & Базы данных', icon: Database, questionCount: 15, timeMinutes: 20, difficulty: 'beginner', completedCount: 203, avgScore: 74 },
  { id: '5', title: 'Soft Skills оценка', icon: MessageCircle, questionCount: 10, timeMinutes: 15, difficulty: 'beginner', completedCount: 310, avgScore: 82 },
  { id: '6', title: 'Логическое мышление', icon: Puzzle, questionCount: 12, timeMinutes: 20, difficulty: 'intermediate', completedCount: 178, avgScore: 59 },
  { id: '7', title: 'English Level', icon: Globe, questionCount: 25, timeMinutes: 20, difficulty: 'intermediate', completedCount: 256, avgScore: 72 },
  { id: '8', title: 'Общий IQ тест', icon: Lightbulb, questionCount: 15, timeMinutes: 25, difficulty: 'advanced', completedCount: 94, avgScore: 61 },
];

const MOCK_RESULTS: TestResult[] = [
  { id: '1', candidateName: 'Алексей Петров', testName: 'JavaScript основы', score: 85, maxScore: 100, date: '2026-03-20', passed: true },
  { id: '2', candidateName: 'Мария Иванова', testName: 'React & Frontend', score: 72, maxScore: 100, date: '2026-03-19', passed: true },
  { id: '3', candidateName: 'Дмитрий Ким', testName: 'SQL & Базы данных', score: 45, maxScore: 100, date: '2026-03-18', passed: false },
];

const DIFFICULTY_MAP: Record<TestTemplate['difficulty'], { label: string; color: string; bg: string }> = {
  beginner: { label: 'Начальный', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  intermediate: { label: 'Средний', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  advanced: { label: 'Продвинутый', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AssessmentsPage() {
  usePageTitle('Тестирование');
  const [activeTab, setActiveTab] = useState<'templates' | 'my' | 'results'>('templates');
  const [assignModal, setAssignModal] = useState<TestTemplate | null>(null);

  /* Fetch real test results from analyzed candidates */
  const { data: realResults } = useQuery({
    queryKey: ['test-results'],
    queryFn: () =>
      candidatesApi.listAll({}).then((r) => {
        const candidates: Candidate[] = r.data.candidates || [];
        return candidates
          .filter((c) => c.ai_analysis)
          .slice(0, 10)
          .map((c, idx) => ({
            id: `real-${idx}`,
            candidateName: c.full_name,
            testName: 'AI Оценка',
            score: c.ai_analysis?.overall_score || 0,
            maxScore: 100,
            date: c.submitted_at,
            passed: (c.ai_analysis?.overall_score || 0) >= 60,
          }));
      }).catch((e) => { console.error('Ошибка загрузки результатов оценки:', e); return []; }),
    staleTime: 60_000,
  });

  const displayResults: TestResult[] = realResults && realResults.length > 0 ? realResults : MOCK_RESULTS;

  const tabs = [
    { key: 'templates' as const, label: 'Шаблоны тестов' },
    { key: 'my' as const, label: 'Мои тесты' },
    { key: 'results' as const, label: 'Результаты' },
  ];

  return (
    <Layout>
      <motion.div
        className="p-6 md:p-8 page-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wider">ТЕСТИРОВАНИЕ</h1>
            <p className="text-sm text-white/60 mt-1">
              Оценка навыков и знаний кандидатов
            </p>
          </div>
          <button
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
            onClick={() => toast('Конструктор тестов будет доступен в следующем обновлении', { icon: '🛠' })}
          >
            <Plus size={16} />
            Создать тест
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.03]/60 border border-white/[0.04] rounded-2xl p-1 backdrop-blur-xl w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-white/60 hover:text-neutral-200 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {TEST_TEMPLATES.map((test) => (
              <TestCard key={test.id} test={test} onAssign={() => setAssignModal(test)} />
            ))}
          </motion.div>
        )}

        {/* My tests tab */}
        {activeTab === 'my' && (
          <motion.div
            className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl text-center py-20 backdrop-blur-xl"
            variants={staggerItem}
            initial="initial"
            animate="animate"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-white/[0.02] border border-neutral-600 rounded-2xl flex items-center justify-center">
                <ClipboardList size={28} className="text-white/40" />
              </div>
            </div>
            <p className="font-semibold text-neutral-300 mb-1 text-lg">
              Создайте свой первый тест
            </p>
            <p className="text-sm text-white/40 max-w-xs mx-auto mb-6">
              Используйте конструктор для создания уникальных тестов для вашей компании
            </p>
            <button
              className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
              onClick={() => toast('Конструктор тестов будет доступен в следующем обновлении', { icon: '🛠' })}
            >
              <Plus size={16} />
              Создать тест
            </button>
          </motion.div>
        )}

        {/* Results tab */}
        {activeTab === 'results' && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {realResults && realResults.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-white/40">Показаны реальные данные AI-оценок кандидатов</span>
              </div>
            )}
            <div className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl overflow-hidden backdrop-blur-xl">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/[0.04] text-xs text-white/40 uppercase tracking-wider font-medium">
                <div className="col-span-3">Кандидат</div>
                <div className="col-span-3">Тест</div>
                <div className="col-span-2">Результат</div>
                <div className="col-span-2">Дата</div>
                <div className="col-span-2">Статус</div>
              </div>

              {/* Rows */}
              {displayResults.map((result) => (
                <motion.div
                  key={result.id}
                  variants={staggerItem}
                  className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.04]/50 hover:bg-white/[0.02]/30 transition-colors"
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-orange-400">
                        {result.candidateName.charAt(0)}
                      </span>
                    </div>
                    <span className="text-sm text-white font-medium truncate">
                      {result.candidateName}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm text-neutral-300">{result.testName}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/[0.02] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${result.passed ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${(result.score / result.maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-white tabular-nums" >
                      {result.score}%
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-white/60">{formatDate(result.date)}</span>
                  </div>
                  <div className="col-span-2 flex items-center">
                    {result.passed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-medium text-emerald-400">
                        <CheckCircle size={12} />
                        Пройден
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-medium text-red-400">
                        <XCircle size={12} />
                        Не пройден
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}

              {displayResults.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-white/40">Результатов пока нет</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Assign to candidate modal */}
      <AnimatePresence>
        {assignModal && (
          <AssignModal test={assignModal} onClose={() => setAssignModal(null)} />
        )}
      </AnimatePresence>
    </Layout>
  );
}

/* ------------------------------------------------------------------ */
/*  Assign Modal                                                       */
/* ------------------------------------------------------------------ */
function AssignModal({ test, onClose }: { test: TestTemplate; onClose: () => void }) {
  const [search, setSearch] = useState('');

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['candidates-for-assign'],
    queryFn: () => candidatesApi.listAll({}).then((r) => r.data.candidates || []),
    staleTime: 30_000,
  });

  const candidates: Candidate[] = candidatesData || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const handleAssign = (candidate: Candidate) => {
    toast.success(
      `Тест "${test.title}" будет отправлен кандидату ${candidate.full_name} (функция в разработке)`,
    );
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg bg-white/[0.03] border border-white/[0.06]/60 rounded-2xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
          <div>
            <h3 className="text-base font-semibold text-white">Назначить кандидату</h3>
            <p className="text-xs text-white/40 mt-0.5">
              Тест: {test.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.02] transition-colors text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск кандидата..."
              className="input w-full pl-10 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Candidate list */}
        <div className="px-5 pb-5 max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-8">
              <Users size={24} className="mx-auto text-white/25 mb-2" />
              <p className="text-sm text-white/40">
                {candidates.length === 0 ? 'Кандидаты не найдены' : 'Ничего не найдено'}
              </p>
            </div>
          )}

          <div className="space-y-1 mt-2">
            {filtered.slice(0, 20).map((c) => (
              <button
                key={c.id}
                onClick={() => handleAssign(c)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.02]/60 transition-colors text-left group"
              >
                <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-orange-400">
                    {c.full_name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{c.full_name}</p>
                  <p className="text-xs text-white/40 truncate">{c.email}</p>
                </div>
                <UserCheck size={16} className="text-white/25 group-hover:text-orange-400 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Test card component                                                */
/* ------------------------------------------------------------------ */
function TestCard({ test, onAssign }: { test: TestTemplate; onAssign: () => void }) {
  const Icon = test.icon;
  const diff = DIFFICULTY_MAP[test.difficulty];

  return (
    <motion.div
      variants={staggerItem}
      className="bg-white/[0.03]/80 border border-white/[0.06]/60 rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 backdrop-blur-xl flex flex-col"
    >
      {/* Icon + difficulty */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
          <Icon size={18} className="text-orange-400" />
        </div>
        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${diff.bg} ${diff.color}`}>
          {diff.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-white mb-3">{test.title}</h3>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-white/40 mb-4">
        <span className="flex items-center gap-1">
          <ClipboardList size={12} />
          {test.questionCount} вопросов
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {test.timeMinutes} мин
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-white/40 mb-4 mt-auto">
        <span className="flex items-center gap-1">
          <Users size={12} />
          Пройден {test.completedCount} раз
        </span>
        <span className="flex items-center gap-1">
          <Trophy size={12} />
          Средний балл: {test.avgScore}%
        </span>
      </div>

      {/* Assign button */}
      <button
        className="w-full py-2 px-3 text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-2"
        onClick={onAssign}
      >
        <Play size={13} />
        Назначить кандидату
      </button>
    </motion.div>
  );
}
