import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { CustomQuestion } from '../types';

const QUESTION_TYPES: { value: CustomQuestion['type']; label: string }[] = [
  { value: 'text', label: 'Короткий текст' },
  { value: 'textarea', label: 'Длинный текст' },
  { value: 'radio', label: 'Один вариант' },
  { value: 'checkbox', label: 'Несколько вариантов' },
  { value: 'yesno', label: 'Да / Нет' },
  { value: 'scale', label: 'Шкала 1–10' },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface QuestionItemProps {
  question: CustomQuestion;
  index: number;
  total: number;
  onChange: (q: CustomQuestion) => void;
  onDelete: () => void;
  onMove: (dir: 'up' | 'down') => void;
}

function QuestionItem({ question, index, total, onChange, onDelete, onMove }: QuestionItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [newOption, setNewOption] = useState('');

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    onChange({ ...question, options: [...(question.options || []), trimmed] });
    setNewOption('');
  };

  const removeOption = (i: number) => {
    const opts = [...(question.options || [])];
    opts.splice(i, 1);
    onChange({ ...question, options: opts });
  };

  const needsOptions = question.type === 'radio' || question.type === 'checkbox';

  return (
    <div
      className="rounded-2xl overflow-hidden border border-orange-500/15 bg-white/[0.02]"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-orange-500/[0.05]"
        style={{ borderBottom: expanded ? '1px solid rgba(255,110,0,0.10)' : 'none' }}
      >
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove('up')}
            className={`leading-none ${index === 0 ? 'text-white/15' : 'text-white/40'}`}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove('down')}
            className={`leading-none ${index === total - 1 ? 'text-white/15' : 'text-white/40'}`}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <GripVertical size={14} className="text-white/20 shrink-0" />

        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 bg-orange-500/[0.12] border border-orange-500/25 text-orange-400"
        >
          #{index + 1}
        </span>

        <p className="flex-1 text-sm font-semibold text-white truncate">
          {question.label || 'Без названия'}
        </p>

        <span className="text-xs shrink-0 text-white/30">
          {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
        </span>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-white/[0.35]"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 flex items-center justify-center rounded-lg transition-all w-7 h-7 bg-red-500/[0.08] border border-red-500/20 text-red-400"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-3">
          <div>
            <label className="label text-xs">Текст вопроса</label>
            <input
              type="text"
              className="input"
              placeholder="Введите вопрос..."
              value={question.label}
              onChange={(e) => onChange({ ...question, label: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="label text-xs">Тип</label>
              <select
                className="select-premium w-full"
                value={question.type}
                onChange={(e) =>
                  onChange({ ...question, type: e.target.value as CustomQuestion['type'], options: [] })
                }
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => onChange({ ...question, required: !question.required })}
                className={`flex items-center gap-2 text-sm transition-all ${question.required ? 'text-orange-400' : 'text-white/[0.35]'}`}
              >
                <div
                  style={{
                    width: 36, height: 20,
                    borderRadius: 10,
                    background: question.required ? 'rgba(255,110,0,0.35)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${question.required ? 'rgba(255,110,0,0.5)' : 'rgba(255,255,255,0.10)'}`,
                    position: 'relative',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: question.required ? 18 : 2,
                      width: 14, height: 14,
                      borderRadius: '50%',
                      background: question.required ? '#fb923c' : 'rgba(255,255,255,0.3)',
                      transition: 'all 0.2s',
                    }}
                  />
                </div>
                Обязательный
              </button>
            </div>
          </div>

          {(question.type === 'text' || question.type === 'textarea') && (
            <div>
              <label className="label text-xs">Подсказка (placeholder)</label>
              <input
                type="text"
                className="input"
                placeholder="Введите подсказку..."
                value={question.placeholder || ''}
                onChange={(e) => onChange({ ...question, placeholder: e.target.value })}
              />
            </div>
          )}

          {needsOptions && (
            <div>
              <label className="label text-xs">Варианты ответа</label>
              <div className="space-y-2 mb-2">
                {(question.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="flex-1 px-3 py-2 rounded-xl text-sm bg-black/30 border border-white/[0.07] text-white/70"
                    >
                      {opt}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="text-red-500/60"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Добавить вариант..."
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="btn-secondary shrink-0 !px-3.5 !py-0"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface QuestionBuilderProps {
  questions: CustomQuestion[];
  onChange: (questions: CustomQuestion[]) => void;
  onSave: () => void;
  saving?: boolean;
}

export default function QuestionBuilder({ questions, onChange, onSave, saving }: QuestionBuilderProps) {
  const addQuestion = (type: CustomQuestion['type'] = 'text') => {
    const newQ: CustomQuestion = {
      id: generateId(),
      type,
      label: '',
      required: false,
    };
    onChange([...questions, newQ]);
  };

  const updateQuestion = (index: number, q: CustomQuestion) => {
    const updated = [...questions];
    updated[index] = q;
    onChange(updated);
  };

  const deleteQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, dir: 'up' | 'down') => {
    const updated = [...questions];
    const target = dir === 'up' ? index - 1 : index + 1;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  return (
    <div>
      <div className="space-y-3 mb-5">
        {questions.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl border-2 border-dashed border-orange-500/[0.12] bg-white/[0.01]"
          >
            <Plus size={28} className="mx-auto mb-3 text-orange-500/30" />
            <p className="text-sm font-semibold text-white mb-1">Нет кастомных вопросов</p>
            <p className="text-xs text-white/30">
              Добавьте вопросы, которые увидят кандидаты при отклике
            </p>
          </div>
        ) : (
          questions.map((q, i) => (
            <QuestionItem
              key={q.id}
              question={q}
              index={i}
              total={questions.length}
              onChange={(updated) => updateQuestion(i, updated)}
              onDelete={() => deleteQuestion(i)}
              onMove={(dir) => moveQuestion(i, dir)}
            />
          ))
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <select
            className="select-premium pr-10 min-w-[180px]"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addQuestion(e.target.value as CustomQuestion['type']);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>+ Добавить вопрос</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn-primary ml-auto"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Сохранение...' : 'Сохранить форму'}
        </button>
      </div>
    </div>
  );
}
