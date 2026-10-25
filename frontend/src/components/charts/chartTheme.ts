export const chartColors = {
  actual: "#e8eaee",
  forecast: "#9984d8",
  positive: "#3fcb7f",
  negative: "#9984d8",
  signed: "#9984d8",
  absolute: "#3fcb7f",
  mae: "#e8eaee",
  neutral: "#808080",
  eligible: "#3fcb7f",
  selected: "#9984d8",
  ineligible: "#808080",
  path: "#808080",
  grid: "#262626",
  axis: "#333333",
  tick: "#b3b3b3",
  cutoff: "#b3b3b3",
  tooltipBorder: "#333333",
  tooltipSurface: "#050607",
} as const;

export const axisTick = {
  fill: chartColors.tick,
  fontSize: 11,
};

export const axisLabel = {
  fill: chartColors.neutral,
  fontSize: 10,
};

export const legendStyle = {
  fontSize: 11,
  color: chartColors.tick,
  paddingBottom: 10,
};

export const lineCursor = {
  stroke: chartColors.neutral,
  strokeDasharray: "3 3",
};
