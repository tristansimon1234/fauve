// Photos of the landing's demo businesses: Unsplash (free licence), served by its CDN at the size asked.

/** Asked at the size shown (CSS pixels) with dpr 2, so they stay sharp on phone and retina screens. */
export const unsplash = (id: string, w: number, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&dpr=2&w=${w}${h ? `&h=${h}` : ""}`;

export const PHOTOS = {
  studioClass: "1518611012118-696072aa579a",
  groupClass: "1518310383802-640c2de311b2",
  yogaSunset: "1544367567-0f2fcb009e0b",
  salon: "1560066984-138dadb4c035",
  salonChair: "1521590832167-7bcbfaa6381f",
  hair: "1522337360788-8b13dee7a37e",
  cafe: "1554118811-1e0d58224f24",
  restaurant: "1517248135467-4c7edcad34c4",
  dish: "1414235077428-338989a2e8c0",
  shop: "1441986300917-64674bd600d8",
  coffee: "1495474472287-4d71bcdd2085",
} as const;
