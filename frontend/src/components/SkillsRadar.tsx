import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AIScores } from '../types';

interface SkillsRadarProps {
  scores: AIScores;
}

const labels: Record<keyof AIScores, string> = {
  hard_skills: 'Hard Skills',
  experience: 'Опыт',
  education: 'Образование',
  soft_skills: 'Soft Skills',
  languages: 'Языки',
  culture_fit: 'Культура',
};

export default function SkillsRadar({ scores }: SkillsRadarProps) {
  const data = (Object.keys(scores) as Array<keyof AIScores>).map((key) => ({
    subject: labels[key],
    value: scores[key],
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(255,110,0,0.12)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#fb923c"
          fill="#f97316"
          fillOpacity={0.18}
          strokeWidth={2}
          dot={{ fill: '#fb923c', r: 4, strokeWidth: 0 }}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(10,8,5,0.95)',
            border: '1px solid rgba(255,110,0,0.25)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          labelStyle={{ color: '#fff', fontWeight: 700 }}
          itemStyle={{ color: '#fb923c' }}
          formatter={(value: number) => [`${value}%`, 'Оценка']}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
