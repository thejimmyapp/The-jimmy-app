import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Database, Target, Trophy, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { api } from "../api";

interface Props { username: string }

const pct = (value: number | null | undefined) => value == null ? "N/A" : `${value.toFixed(1)}%`;

export function StatsDashboard({ username }: Props) {
  const query = useQuery({ queryKey: ["player-stats", username], queryFn: () => api.playerStats(username), enabled: Boolean(username) });
  if (!username) return <main className="stats-empty"><BarChart3 /><strong>Connect a Chess.com username</strong><span>Your performance profile will appear here.</span></main>;
  if (query.isPending) return <main className="stats-empty"><Activity className="spin" /><strong>Building {username}'s profile</strong><span>Reading games, partners and coaching labels.</span></main>;
  if (query.error || !query.data) return <main className="stats-empty error"><AlertTriangle /><strong>Statistics unavailable</strong><span>{query.error?.message}</span></main>;

  const stats = query.data;
  const summary = stats.summary;
  const eligiblePartners = stats.partners.filter((item) => item.partner !== "Unknown" && item.games >= 5);
  const bestPartner = [...eligiblePartners].sort((a, b) => (b.winrate ?? 0) - (a.winrate ?? 0))[0];
  const nemesis = stats.opponents.filter((item) => item.opponent !== "Unknown" && item.games >= 3).sort((a, b) => (a.winrate ?? 100) - (b.winrate ?? 100))[0];
  const maxMonthGames = Math.max(1, ...stats.monthly.map((item) => item.games));
  const maxMistakes = Math.max(1, ...stats.mistake_categories.map((item) => item.count));

  return (
    <main className="stats-dashboard">
      <header className="stats-hero">
        <div><span>PLAYER PERFORMANCE</span><h1>{stats.username}</h1><p>A practical view of results, recurring leaks and the opponents that shape your game.</p></div>
        <div className="coverage-ring" style={{ "--coverage": `${summary.total_games ? Math.round(summary.partner_boards / summary.total_games * 100) : 0}%` } as CSSProperties}>
          <strong>{summary.total_games ? Math.round(summary.partner_boards / summary.total_games * 100) : 0}%</strong><small>two-board data</small>
        </div>
      </header>

      <section className="stats-kpis" aria-label="Key statistics">
        <Metric icon={<Trophy />} label="Win rate" value={pct(summary.winrate)} detail={`${summary.wins} wins · ${summary.losses} losses`} tone="green" />
        <Metric icon={<Database />} label="Games" value={summary.total_games.toLocaleString()} detail={`${summary.partner_boards.toLocaleString()} complete reviews`} />
        <Metric icon={<Users />} label="Best partner" value={bestPartner?.partner ?? "Not enough data"} detail={bestPartner ? `${pct(bestPartner.winrate)} · ${bestPartner.games} games` : "Minimum 5 games"} tone="cyan" />
        <Metric icon={<Target />} label="Toughest opponent" value={nemesis?.opponent ?? "Not enough data"} detail={nemesis ? `${pct(nemesis.winrate)} · ${nemesis.games} games` : "Minimum 3 games"} tone="coral" />
      </section>

      <section className="stats-grid">
        <div className="stats-section trend-section">
          <SectionTitle eyebrow="FORM" title="Last 12 months" detail="Volume and win rate over time" />
          <div className="month-chart">
            {stats.monthly.map((item) => <div className="month-column" key={item.month} title={`${item.month}: ${item.games} games, ${pct(item.winrate)}`}><span>{pct(item.winrate)}</span><i style={{ height: `${Math.max(8, item.games / maxMonthGames * 100)}%` }}><b style={{ height: `${item.winrate ?? 0}%` }} /></i><small>{item.month.slice(5)}</small></div>)}
          </div>
        </div>
        <div className="stats-section color-section">
          <SectionTitle eyebrow="SIDE" title="White vs black" detail="Your results by starting color" />
          <div className="color-comparison">
            {stats.colors.filter((item) => item.color !== "unknown").map((item) => <div key={item.color}><header><strong>{item.color}</strong><span>{item.games} games</span></header><b>{pct(item.winrate)}</b><div className="progress"><i style={{ width: `${item.winrate ?? 0}%` }} /></div></div>)}
          </div>
        </div>
      </section>

      <section className="stats-grid three">
        <div className="stats-section">
          <SectionTitle eyebrow="MATCHUPS" title="By opponent rating" detail="Where results change with opposition strength" />
          <div className="rating-bands">{stats.rating_bands.map((item) => <div key={item.label}><span>{item.label}<small>{item.games} games</small></span><div className="progress"><i style={{ width: `${item.winrate ?? 0}%` }} /></div><b>{pct(item.winrate)}</b></div>)}</div>
        </div>
        <div className="stats-section leaks-section">
          <SectionTitle eyebrow="COACHING" title="Recurring leaks" detail={`${summary.mistakes} stored positions · ${summary.blunders} blunders`} />
          {stats.mistake_categories.length ? <div className="leak-list">{stats.mistake_categories.slice(0, 6).map((item) => <div key={item.category}><span>{item.category}<small>{item.avg_loss.toFixed(0)} avg cp loss</small></span><i><b style={{ width: `${item.count / maxMistakes * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div> : <div className="stats-no-data"><CheckCircle2 />Run coach analysis to build your leak map.</div>}
        </div>
      </section>

      <section className="stats-grid tables">
        <Ranking title="Partner chemistry" nameKey="partner" rows={stats.partners} />
        <Ranking title="Opponent history" nameKey="opponent" rows={stats.opponents} />
      </section>
    </main>
  );
}

function Metric({ icon, label, value, detail, tone = "default" }: { icon: ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <article className={`stat-metric ${tone}`}><span>{icon}{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <header className="stats-section-title"><span>{eyebrow}</span><div><h2>{title}</h2><p>{detail}</p></div></header>;
}

function Ranking({ title, nameKey, rows }: { title: string; nameKey: "partner" | "opponent"; rows: Array<{ partner?: string; opponent?: string; games: number; winrate: number | null }> }) {
  return <div className="stats-section ranking"><SectionTitle eyebrow="TOP SAMPLE" title={title} detail="Sorted by number of shared games" /><div className="ranking-list">{rows.slice(0, 8).map((item, index) => <div key={`${item[nameKey]}-${index}`}><b>{index + 1}</b><span><strong>{String(item[nameKey])}</strong><small>{item.games} games</small></span><em>{pct(item.winrate as number | null)}</em></div>)}</div></div>;
}
