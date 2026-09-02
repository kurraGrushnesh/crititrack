/**
 * The four-cell stat table from the portfolio reference: a bordered grid
 * of KEY / value pairs. Used on the profile header.
 */
export default function StatTable({
  stats,
}: {
  stats: { k: string; v: string | number }[];
}) {
  return (
    <div className="stat-table" role="table" aria-label="Profile stats">
      <div className="stat-table-row" role="row">
        {stats.map((s) => (
          <div className="stat-cell k" role="columnheader" key={s.k}>
            {s.k}
          </div>
        ))}
      </div>
      <div className="stat-table-row" role="row">
        {stats.map((s) => (
          <div className="stat-cell v" role="cell" key={s.k}>
            {s.v}
          </div>
        ))}
      </div>
    </div>
  );
}
