import { useParams, useNavigate } from 'react-router-dom';
import { mockCandidates } from '../mockData';
import ScoreRing from '../components/ScoreRing';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowLeft, CheckCircle, XCircle, Mail, Phone, Linkedin, BrainCircuit } from 'lucide-react';

const catLabel: Record<string, string> = { excellent: 'Отличный', good: 'Хороший', average: 'Средний', below: 'Ниже среднего' };
const catColor: Record<string, string> = { excellent: 'text-emerald-400', good: 'text-blue-400', average: 'text-yellow-400', below: 'text-red-400' };
const scoreLabels: Record<string, string> = { hard_skills: 'Hard Skills', experience: 'Опыт', education: 'Образование', soft_skills: 'Soft Skills', languages: 'Языки', culture_fit: 'Культура' };

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const c = mockCandidates.find(x => x.id === id);

  if (!c) return <div className="p-8 text-gray-400">Кандидат не найден</div>;

  const hasAnalysis = c.overall_score > 0;
  const radarData = Object.entries(c.scores).map(([key, value]) => ({
    subject: scoreLabels[key] || key, value, fullMark: 100,
  }));

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{c.full_name}</h2>
          <p className="text-gray-400 text-sm">Senior Backend Developer</p>
        </div>
        {hasAnalysis && (
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
              <CheckCircle size={16}/>Пригласить на интервью
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 rounded-lg text-sm font-medium transition-colors">
              <XCircle size={16}/>Отклонить
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left */}
        <div className="col-span-1 space-y-5">
          <div className="card">
            <h3 className="font-semibold text-white mb-4">Контакты</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-300"><Mail size={14} className="text-gray-500"/><a href={`mailto:${c.email}`} className="hover:text-indigo-400 transition-colors">{c.email}</a></div>
              {c.phone && <div className="flex items-center gap-2 text-sm text-gray-300"><Phone size={14} className="text-gray-500"/>{c.phone}</div>}
              {c.linkedin_url && <div className="flex items-center gap-2 text-sm"><Linkedin size={14} className="text-gray-500"/><a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">LinkedIn профиль</a></div>}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
              {Object.entries(c.form_responses).map(([k, v]) => (
                typeof v === 'string' && k !== 'Ожидаемая зарплата (USD в месяц)' ? null : (
                  <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="text-xs text-gray-300">{Array.isArray(v) ? v.join(', ') : String(v)}</p></div>
                )
              ))}
              <p className="text-xs text-gray-500">Ожидаемая зарплата: <span className="text-gray-300">{c.form_responses['Ожидаемая зарплата (USD в месяц)'] as string} USD</span></p>
            </div>
          </div>

          {hasAnalysis && (
            <div className="card text-center">
              <ScoreRing score={c.overall_score} category={c.category} size="lg"/>
              <p className={`text-lg font-semibold mt-3 ${catColor[c.category]}`}>{catLabel[c.category]}</p>
              <p className="text-xs text-gray-500 mt-1">Анализ выполнен Claude AI</p>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="col-span-2 space-y-5">
          {hasAnalysis ? (
            <>
              {/* Radar + scores */}
              <div className="card">
                <h3 className="font-semibold text-white mb-4">Оценки по критериям</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="#374151"/>
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }}/>
                    <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3}/>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={(v: number) => [`${v}%`, 'Оценка']}/>
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(c.scores).map(([key, value]) => (
                    <div key={key} className="bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{scoreLabels[key]}</p>
                      <p className="text-lg font-bold text-white">{value}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="card">
                <h3 className="font-semibold text-white mb-3">Резюме AI</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{c.summary}</p>
              </div>

              {/* Strengths / Weaknesses */}
              <div className="grid grid-cols-2 gap-5">
                <div className="card">
                  <h3 className="font-semibold text-emerald-400 mb-3">Сильные стороны</h3>
                  <ul className="space-y-2">
                    {c.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <CheckCircle size={15} className="text-emerald-500 flex-shrink-0 mt-0.5"/>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-red-400 mb-3">Слабые стороны</h3>
                  <ul className="space-y-2">
                    {c.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5"/>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div className="card">
                <h3 className="font-semibold text-white mb-3">Рекомендации для интервью</h3>
                <ul className="space-y-2">
                  {c.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="w-5 h-5 bg-indigo-600/30 text-indigo-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">{i+1}</span>{r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Insights */}
              <div className="card">
                <h3 className="font-semibold text-white mb-3">AI Инсайты</h3>
                <div className="grid grid-cols-2 gap-4">
                  {c.green_flags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-emerald-400 mb-2">✅ Green Flags</p>
                      <div className="flex flex-wrap gap-1">
                        {c.green_flags.map((f, i) => <span key={i} className="bg-emerald-500/10 text-emerald-300 text-xs px-2 py-0.5 rounded">{f}</span>)}
                      </div>
                    </div>
                  )}
                  {c.red_flags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-400 mb-2">🚩 Red Flags</p>
                      <div className="flex flex-wrap gap-1">
                        {c.red_flags.map((f, i) => <span key={i} className="bg-red-500/10 text-red-300 text-xs px-2 py-0.5 rounded">{f}</span>)}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  Потенциал роста: <span className={c.growth_potential === 'high' ? 'text-emerald-400' : 'text-yellow-400'}>{c.growth_potential === 'high' ? 'Высокий' : 'Средний'}</span>
                </p>
              </div>
            </>
          ) : (
            <div className="card text-center py-16">
              <BrainCircuit size={48} className="text-gray-700 mx-auto mb-4"/>
              <p className="text-gray-400 mb-2">Анализ ещё не выполнен</p>
              <p className="text-gray-600 text-sm">Вернитесь на страницу вакансии и нажмите "Анализировать всех"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
