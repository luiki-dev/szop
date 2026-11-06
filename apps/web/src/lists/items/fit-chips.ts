// How many chips fit in one row of `available` px: all of them when they do,
// otherwise as many as leave room for the "+N more" button.
export function fitChips(
  widths: readonly number[],
  available: number,
  moreWidth: number,
  gap: number,
): number {
  const used = (count: number) =>
    widths.slice(0, count).reduce((sum, w) => sum + w + gap, 0) - gap;
  if (used(widths.length) <= available) return widths.length;
  let fit = 0;
  // Stryker disable next-line EqualityOperator,ConditionalExpression: the loop stops before `fit` reaches widths.length, since the all-fit case returned above
  while (fit < widths.length && used(fit + 1) + gap + moreWidth <= available)
    fit++;
  return fit;
}
