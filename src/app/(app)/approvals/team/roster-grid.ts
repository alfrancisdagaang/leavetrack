/**
 * The grid of person cards: one column on a phone, two from `sm`, three from `xl`. It wraps and every
 * cell grows, so the last row always fills the width (a lone last card is as wide as the row, with no
 * hole beside it). The basis subtracts the gaps so full rows are exactly 1, 2 or 3 equal cards.
 */
export const ROSTER_GRID = "flex flex-wrap gap-4";
export const ROSTER_CELL =
  "flex min-w-0 grow basis-full sm:basis-[calc(50%-0.5rem)] xl:basis-[calc(33.333%-0.667rem)]";
