interface ScoreRingProps {
  score: number;
  category: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { outer: 56, stroke: 5, fontSize: '0.875rem' },
  md: { outer: 80, stroke: 7, fontSize: '1.25rem' },
  lg: { outer: 112, stroke: 9, fontSize: '1.875rem' },
};

const colorMap: Record<string, { stroke: string; glow: string }> = {
  excellent: { stroke: '#10b981', glow: 'rgba(16,185,129,0.5)' },
  good:      { stroke: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
  average:   { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
  below:     { stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)'  },
};

export default function ScoreRing({ score, category, size = 'md' }: ScoreRingProps) {
  const { outer, stroke, fontSize } = sizes[size];
  const radius = (outer - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colors = colorMap[category] || { stroke: '#6b7280', glow: 'rgba(107,114,128,0.3)' };
  const isExcellent = category === 'excellent';

  return (
    <div
      className="relative inline-flex items-center justify-center score-ring-enter"
      style={{
        width: outer,
        height: outer,
        filter: isExcellent ? undefined : undefined,
        animation: isExcellent ? 'pulseGlow 2s ease-in-out infinite, scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Glow behind ring */}
      <div
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${colors.glow} 0%, transparent 70%)`,
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      <svg width={outer} height={outer} className="-rotate-90 relative z-[1]">
        {/* Track */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 ${size === 'lg' ? 6 : 4}px ${colors.glow})`,
          }}
        />
      </svg>

      <span
        className="absolute font-black"
        style={{ color: colors.stroke, fontSize, zIndex: 2 }}
      >
        {score}
      </span>
    </div>
  );
}
