/** Scores never decrease. A zero-point round must not move the moment a total was reached. */
export const REACHED_TOTAL_SQL = "MAX(CASE WHEN r.score>0 THEN r.completed_at END)";
export const RANK_ORDER_SQL = `SUM(r.score) DESC,${REACHED_TOTAL_SQL} ASC,p.id ASC`;
