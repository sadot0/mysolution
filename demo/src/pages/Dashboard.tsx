import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { mockVacancies, mockCandidates } from '../mockData';
import { Users, BriefcaseIcon, Star, TrendingUp, ExternalLink, ChevronRight } from 'lucide-react';
import ScoreRing from '../components/ScoreRing';

const categoryData = [
  { name: 'Отличный', value: mockCandidates.filter(c => c.category === 'excellent' && c.overall_score > 0).length, color: '#10b981' },
  { name: 'Хороший', value: mockCandidates.filter(c => c.category === 'good' && c.overall_score > 0).length, color: '#3b82f6' },
  { name: 'Средний', value: mockCandidates.filter(c => c.category === 'average' && c.overall_score > 0).length, color: '#f59e0b' },
  { name: 'Ниже ср.', value: mockCandidates.filter(c => c.category === 'below' && c.overall_score > 0).length, color: '#ef4444' },
];

const analyzed = mockCandidates.filter(c => c.overall_score > 0);
const avgScore = Math.round(analyzed.reduce((s, c) => s + c.overall_score, 0) / analyzed.length);
const topCandidates = [...analyzed].sort((a, b) => b.overall_score - a.overall_score).slice(0, 3);

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Дашборд</h2>
        <p className="text-gray-400 mt-1">Общая аналитика по всем вакансиям</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { icon: <BriefcaseIcon size={20}/>, label: 'Вакансий', value: mockVacancies.length, color: 'indigo' },
          { icon: <Users size={20}/>, label: 'Кандидатов', value: mockCandidates.length, color: 'blue' },
          { icon: <TrendingUp size={20}/>, label: 'Проанализировано', value: analyzed.length, color: 'emerald' },
          { icon: <Star size={20}/>, label: 'Средний скор', value: `${avgScore}%`, color: 'yellow' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="card">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-${color}-500/20 text-${color}-400`}>{icon}</div>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-sm text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Chart */}
        <div className="card">
          <h3 className="font-semibold text-white mb-5">Распределение по категориям</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[6,6,0,0]}>
                {categoryData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top candidates */}
        <div className="card">
          <h3 className="font-semibold text-white mb-5">Топ кандидаты</h3>
          <div className="space-y-3">
            {topCandidates.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => navigate(`/candidate/${c.id}`)}>
                <span className="w-6 h-6 bg-indigo-600/40 text-indigo-300 rounded-full flex items-center justify-center text-xs font-bold">#{i+1}</span>
                <ScoreRing score={c.overall_score} category={c.category} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{c.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <ChevronRight size={16} className="text-gray-600" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vacancies list */}
      <div className="card">
        <h3 className="font-semibold text-white mb-5">Вакансии</h3>
        <div className="space-y-3">
          {mockVacancies.map(v => (
            <div key={v.id} className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => navigate(`/vacancy/${v.id}`)}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{v.title}</p>
                  <span className={`px-2 py-0.5 rounded text-xs ${v.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {v.status === 'active' ? 'Активна' : 'Пауза'}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {v.hard_skills.slice(0,4).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded">{s}</span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-300">{v.candidates_count} кандидатов</p>
                <p className="text-xs text-gray-500">Avg: {v.avg_score}%</p>
              </div>
              <a href={v.google_form_url} onClick={e=>e.stopPropagation()} className="p-2 text-gray-500 hover:text-indigo-400 transition-colors"><ExternalLink size={16}/></a>
              <ChevronRight size={16} className="text-gray-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
