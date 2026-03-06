export default function ScoreRing({ score, category, size = 'md' }: { score: number; category: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { w: 56, stroke: 5, fs: 'text-sm' }, md: { w: 80, stroke: 7, fs: 'text-xl' }, lg: { w: 112, stroke: 9, fs: 'text-3xl' } };
  const { w, stroke, fs } = sizes[size];
  const r = (w - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const colors: Record<string, string> = { excellent: '#10b981', good: '#3b82f6', average: '#f59e0b', below: '#ef4444' };
  const color = colors[category] || '#6b7280';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: w, height: w }}>
      <svg width={w} height={w} className="-rotate-90">
        <circle cx={w/2} cy={w/2} r={r} fill="none" stroke="#1f2937" strokeWidth={stroke} />
        <circle cx={w/2} cy={w/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className={`absolute font-bold ${fs}`} style={{ color }}>{score}</span>
    </div>
  );
}
