// The Zcash pools this wallet can hold funds in, as the engine reports
// them. Shown under Settings › About; nothing here is stored.

export interface PoolBalance {
  total: string;
  /** Usable right now (the rest is still confirming). */
  available: string;
}

export interface PoolBalances {
  orchard: PoolBalance;
  sapling: PoolBalance;
  transparent: PoolBalance;
  ironwood: PoolBalance;
}

export const POOLS: {
  key: keyof PoolBalances;
  name: string;
  about: string;
}[] = [
  {
    key: 'ironwood',
    name: 'Ironwood',
    about:
      'The current shielded pool, since NU6.3 (July 2026). New Zcash locks in here.',
  },
  {
    key: 'orchard',
    name: 'Orchard',
    about: 'The previous shielded pool. Since NU6.3 Zcash can only leave it.',
  },
  {
    key: 'sapling',
    name: 'Sapling',
    about: 'An older shielded pool, still private.',
  },
  {
    key: 'transparent',
    name: 'Transparent',
    about: 'Your public address: visible to everyone until locked in.',
  },
];
