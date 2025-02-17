
const levels = [
  'RL0 Planned',
  'RL1 Spiked',
  'RL2 Prototyped',
  'RL3 Alpha',
  'RL4 Beta',
  'RL5 Released',
  'RL6 Industry-leading',
  'RL7 World-leading',
  'RL8 World-changing',
  'RL9 Epic',
]

export const formatReadinessLevel = (level: number) => levels[level] || `RL${level}`