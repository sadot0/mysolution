import { useParams, useNavigate } from 'react-router-dom';
import { mockVacancies, mockCandidates } from '../mockData';
import ScoreRing from '../components/ScoreRing';
import { ArrowLeft, ExternalLink, BrainCircuit, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

const catLabel: Record<string, string> = { excellent: 'Отличный', good: 'Хороший', average: 'Средний', below: 'Ниже среднего' };
const catColor: Record<string, string> = { excellent: 'text-emerald-400', good: 'text-blue-400', average: 'text-yellow-400', below: 'text-red-400' };
const statusLabel: Record<string, string> = { new: 'Новый', analyzing: 'Анализ...', analyzed: 'Проанализирован', invited: 'Приглашён', rejected: 'Отклонён' };
const statusColor: Record<string, string> = { new: 'text-gray-400', analyzed: 'text-emerald-400', invited: 'text-purple-400', rejected: 'text-red-400', analyzing: 'text-blue-400' };

export default function VacancyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vacancy = mockVacancies.find(v => v.id === id);
  const candidates = mockCandidates.filter(c => c.vacancy_id === id);
  const [analyzing, setAnalyzing] = useState(false);
  const [demoAnalyzed, setDemoAnalyzed] = useState(false);

  const runDemoAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setDemoAnalyzed(true); }, 3000);
  };

  if (!vacancy) return <div className="p-8 text-gray-400">Вакансия не найдена</div>;

  const analyzed = candidates.filter(c => c.overall_score > 0 || demoAnalyzed);
  const avgScore = analyzed.length ? Math.round(analyzed.filter(c=>c.overall_score>0).reduce((s,c)=>s+c.overall_score,0) / Math.max(analyzed.filter(c=>c.overall_score>0).length,1)) : 0;

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{vacancy.title}</h2>
          <p className="text-gray-400 text-sm">{candidates.length} кандидатов · {vacancy.location} · {vacancy.salary_range.min}–{vacancy.salary_range.max} {vacancy.salary_range.currency}</p>
        </div>
        <div className="flex gap-3">
          <a href={vacancy.google_form_url} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors">
            <ExternalLink size={16}/>Google Form
          </a>
          <button
            onClick={runDemoAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <BrainCircuit size={16} className={analyzing ? 'animate-spin' : ''}/>
            {analyzing ? 'AI анализирует...' : 'Анализировать всех'}
          </button>
        </div>
      </div>

      {analyzing && (
        <div className="mb-6 p-4 bg-indigo-600/10 border border-indigo-500/30 rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"/>
          <p className="text-indigo-300 text-sm">Claude AI анализирует кандидатов... Это займёт несколько секунд.</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Всего кандидатов', value: candidates.length },
          { label: 'Проанализировано', value: candidates.filter(c=>c.overall_score>0).length },
          { label: 'Средний скор', value: `${avgScore}%` },
          { label: 'Приглашено', value: candidates.filter(c=>c.status==='invited').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Skills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {vacancy.hard_skills.map(s => (
          <span key={s} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-full">{s}</span>
        ))}
      </div>

      {/* Candidates table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">Кандидат</th>
              <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase text-center">Скор</th>
              <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">Категория</th>
              <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">Hard Skills</th>
              <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {candidates.map(c => (
              <tr key={c.id} className="hover:bg-gray-800/50 cursor-pointer transition-colors" onClick={() => c.overall_score > 0 && navigate(`/candidate/${c.id}`)}>
                <td className="px-6 py-4">
                  <p className="font-medium text-white">{c.full_name}</p>
                  <p className="text-sm text-gray-500">{c.email}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  {c.overall_score > 0
                    ? <div className="flex justify-center"><ScoreRing score={c.overall_score} category={c.category} size="sm"/></div>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-6 py-4">
                  {c.overall_score > 0
                    ? <span className={`text-sm font-medium ${catColor[c.category]}`}>{catLabel[c.category]}</span>
                    : '—'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(c.form_responses['Технические навыки'] as string[] || []).slice(0,3).map((s:string) => (
                      <span key={s} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm ${statusColor[c.status]}`}>{statusLabel[c.status]}</span>
                </td>
                <td className="px-6 py-4" onClick={e=>e.stopPropagation()}>
                  {c.overall_score > 0 && c.status !== 'invited' && c.status !== 'rejected' && (
                    <div className="flex gap-2">
                      <button className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 transition-colors"><CheckCircle size={14}/></button>
                      <button className="p-1.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"><XCircle size={14}/></button>
                    </div>
                  )}
                  {c.overall_score > 0 && (
                    <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors ml-1" onClick={() => navigate(`/candidate/${c.id}`)}>Подробнее →</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
