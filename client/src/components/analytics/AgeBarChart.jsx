/* Use in dashboard and analytics page */
import { BAR_COLORS, CHART_COLORS } from '../../utils/chartColors';
import './AgeBarChart.css';

const AGE_BRACKETS = ['0-18','19-29','30-39','40-49','50-59','60+'];

const AGE_BAR_MALE   = CHART_COLORS.blue;
const AGE_BAR_FEMALE = CHART_COLORS.green;

const AgeBarChart = ({ data, height }) => {
  const chartStyle = height ? { height: `${height}px` } : undefined;
  // data may be plain counts or gender-split [{bracket, gender, count}]
  const hasSplit = data.some(d => d.Gender != null || d.gender != null);

  if (hasSplit) {
    // Group by bracket, accumulate male / female
    const buckets = {};
    for (const d of data) {
      const b = d.bracket;
      if (!buckets[b]) buckets[b] = { male: 0, female: 0 };
      const g = (d.Gender ?? d.gender ?? '').toLowerCase();
      if (g === 'male')   buckets[b].male   += Number(d.count);
      if (g === 'female') buckets[b].female += Number(d.count);
    }
    const max = Math.max(...AGE_BRACKETS.map(b => (buckets[b]?.male ?? 0) + (buckets[b]?.female ?? 0)), 1);
    return (
      <div className="bar-chart bar-chart--split" style={chartStyle}>
        {AGE_BRACKETS.map(bracket => {
          const male   = buckets[bracket]?.male   ?? 0;
          const female = buckets[bracket]?.female ?? 0;
          const total  = male + female;
          const pct    = Math.round((total / max) * 100);
          const malePct   = total > 0 ? Math.round((male   / total) * 100) : 0;
          const femalePct = 100 - malePct;
          return (
            <div key={bracket} className="bar-chart__col">
              <div className="bar-chart__bar bar-chart__bar--split"
                style={{ height: `${Math.max(pct, 2)}%` }}
                data-value={total.toLocaleString()}
              >
                <div style={{ flex: femalePct, background: AGE_BAR_FEMALE }} />
                <div style={{ flex: malePct,   background: AGE_BAR_MALE   }} />
              </div>
              <span className="bar-chart__label">{bracket}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: plain totals — use the shared analytics bar palette
  const byBracket = Object.fromEntries(data.map(d => [d.bracket, Number(d.count)]));
  const max = Math.max(...AGE_BRACKETS.map(b => byBracket[b] ?? 0), 1);
  return (
    <div className="bar-chart" style={chartStyle}>
      {AGE_BRACKETS.map((bracket, index) => {
        const count = byBracket[bracket] ?? 0;
        const pct   = Math.round((count / max) * 100);
        return (
          <div key={bracket} className="bar-chart__col">
            <div className="bar-chart__bar"
              style={{
                height: `${Math.max(pct, 2)}%`,
                background: BAR_COLORS[index % BAR_COLORS.length],
              }}
              data-value={count.toLocaleString()}
            />
            <span className="bar-chart__label">{bracket}</span>
          </div>
        );
      })}
    </div>
  );
};


export default AgeBarChart;
