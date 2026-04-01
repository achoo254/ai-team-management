/** Resolve CSS custom property to computed value */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Pre-resolved chart palette from --chart-1..5 CSS vars */
export function getChartColors(): string[] {
  return [1, 2, 3, 4, 5].map((i) => cssVar(`--chart-${i}`));
}

/** Resolve team color from --color-team-{key} or fallback to chart palette */
export function getTeamColor(teamKey: string, index: number): string {
  const team = cssVar(`--color-team-${teamKey}`);
  return team || getChartColors()[index % 5];
}
