
const levels = [
  'RL0 Planned',
  'RL1 Spiked',
  'RL2 Prototyped',
  'RL3 Alpha',
  'RL4 Beta',
  'RL5 Released',
  'RL6 Industry-leading',
]

export const formatReadinessLevel = (level: number) => levels[level] || `RL${level}`