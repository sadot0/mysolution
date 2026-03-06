import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from '../components/Layout';
import { analyticsApi } from '../utils/api';
import { TrendingUp, Users, BriefcaseIcon, Star } from 'lucide-react';

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsApi.overview().then((r) => r.data),
  });

  const categoryData = data?.by_category
    ? [
        { name: 'Отличный', value: data.by_category.excellent || 0, color: '#10b981' },
        { name: 'Хороший', value: data.by_category.good || 0, color: '#3b82f6' },
        { name: 'Средний', value: data.by_category.average || 0, color: '#f59e0b' },
        { name: 'Ниже ср.', value: data.by_category.below || 0, color: '#ef4444' },
      ]
    : [];

  return (
    <Layout>
      <div className="p-8 page-content">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-white mb-1">Аналитика</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Общая статистика по всем вакансиям
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <StatCard
                icon={<BriefcaseIcon size={22} />}
                label="Вакансий"
                value={data?.total_vacancies || 0}
                iconColor="rgba(255,110,0,0.6)"
                iconBg="rgba(255,110,0,0.10)"
                iconBorder="rgba(255,110,0,0.20)"
              />
              <StatCard
                icon={<Users size={22} />}
                label="Кандидатов"
                value={data?.total_candidates || 0}
                iconColor="#60a5fa"
                iconBg="rgba(59,130,246,0.10)"
                iconBorder="rgba(59,130,246,0.20)"
              />
              <StatCard
                icon={<TrendingUp size={22} />}
                label="Проанализировано"
                value={data?.analyzed || 0}
                iconColor="#10b981"
                iconBg="rgba(16,185,129,0.10)"
                iconBorder="rgba(16,185,129,0.20)"
              />
              <StatCard
                icon={<Star size={22} />}
                label="Средний скор"
                value={`${data?.avg_score || 0}%`}
                iconColor="#fbbf24"
                iconBg="rgba(245,158,11,0.10)"
                iconBorder="rgba(245,158,11,0.20)"
              />
            </div>

            {/* Category breakdown */}
            {categoryData.some((d) => d.value > 0) && (
              <div className="card mb-6">
                <h3 className="font-bold text-white mb-6">Распределение по категориям</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={categoryData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(10,8,5,0.95)',
                        border: '1px solid rgba(255,110,0,0.25)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      }}
                      labelStyle={{ color: '#fff', fontWeight: 700 }}
                      itemStyle={{ color: '#FF9A3C' }}
                      cursor={{ fill: 'rgba(255,110,0,0.05)' }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {!data?.total_candidates && (
              <div className="text-center py-20 card">
                <div
                  className="inline-flex items-center justify-center mb-4"
                  style={{
                    width: 64, height: 64,
                    background: 'rgba(255,110,0,0.08)',
                    border: '1px solid rgba(255,110,0,0.15)',
                    borderRadius: 18,
                    animation: 'float 3s ease-in-out infinite',
                  }}
                >
                  <TrendingUp size={28} style={{ color: 'rgba(255,110,0,0.5)' }} />
                </div>
                <p className="font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Нет данных для отображения
                </p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Добавьте кандидатов и запустите анализ
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function StatCard({
  icon,
  label,
  value,
  iconColor,
  iconBg,
  iconBorder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
}) {
  return (
    <div className="card card-hover stagger-item" style={{ padding: '1.5rem' }}>
      <div
        className="flex items-center justify-center mb-4 transition-transform"
        style={{
          width: 52, height: 52,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          borderRadius: 14,
          color: iconColor,
        }}
      >
        {icon}
      </div>
      <p
        className="text-3xl font-black mb-1"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.8) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </p>
      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}
      </p>
    </div>
  );
}
