# Metrics System

The metrics system follows a consistent pattern for all metrics (current and future). Each metric has two potential sources of truth: manually set values (`setMetrics`) and calculated values (`calculatedMetrics`).

## Core Principles

1. **Single Display Value**: Always use `calculatedMetrics` for display. It will always have the correct logical value.
2. **Manual Override**: `setMetrics` acts as an override when present.
3. **Automatic Calculation**: When `setMetrics` is absent, values are calculated from children or defaults.

## How It Works

For any metric (e.g. readinessLevel):

1. If `setMetrics.readinessLevel` exists:

   - `calculatedMetrics.readinessLevel` will exactly match this value
   - This is considered "manual mode"
   - UI shows no auto indicator

2. If `setMetrics.readinessLevel` is absent:
   - `calculatedMetrics.readinessLevel` is calculated from children
   - For leaf nodes (no children), uses defined defaults
   - This is considered "auto mode"
   - UI shows auto indicator (e.g. circle-A icon)

## Example

```typescript
// Manual mode (setMetrics present)
node = {
  setMetrics: { readinessLevel: 7 },
  calculatedMetrics: { readinessLevel: 7 }, // Matches setMetrics
  childrenIds: [child1, child2], // Children ignored
};

// Auto mode (no setMetrics)
node = {
  setMetrics: undefined,
  calculatedMetrics: { readinessLevel: 3 }, // Calculated from children
  childrenIds: [child1, child2], // Min of children's readinessLevels
};

// Auto mode (leaf node)
node = {
  setMetrics: undefined,
  calculatedMetrics: {}, // Default value
  childrenIds: [], // No children
};
```

## Readiness Level Example

The readiness level metric demonstrates a key principle in problem decomposition: **a problem can only be as solved as its least-solved sub-problem**. However, we also want to quantify continuous progress between integral readiness levels. This leads to our fractional readiness level calculation:

1. Find the minimum readiness level (baseLevel) among active children
2. Bound all active children's readiness levels to [baseLevel, baseLevel + 1]
3. Take the average of these bounded values

The result will always be in the range [baseLevel, baseLevel + 1), meaning it will be greater than or equal to baseLevel but strictly less than baseLevel + 1. This ensures the readiness level accurately reflects that we haven't fully achieved the next level until all sub-problems reach it.

Note that we ignore how far ahead some sub-problems may be (2+ levels) - all that matters is how many sub-problems are at the next level and how many still need to be advanced. We take the average to incorporate some information about nested readiness levels, though the weighting is necessarily arbitrary. This approach focuses on the critical path to the next level while still acknowledging progress in other areas.

This approach ensures:

- The overall readiness level is bounded by the minimum sub-problem's readiness level
- Progress in other sub-problems above the minimum is still reflected in the final value
- The calculation provides smooth, continuous feedback as sub-problems progress

Example tree calculation:

```
       A(auto)
      /       \
  B(auto)    C(5)
   /   \       \
D(2)   E(3)    F(auto)

Results:
- F: calculatedMetrics.readinessLevel = 0 (leaf default)
- C: calculatedMetrics.readinessLevel = 5 (setMetrics override)
- D: calculatedMetrics.readinessLevel = 2 (setMetrics override)
- E: calculatedMetrics.readinessLevel = 3 (setMetrics override)
- B: calculatedMetrics.readinessLevel = 2.5 (average of D and E bounded to [2,3])
- A: calculatedMetrics.readinessLevel = 2.5 (average of B and C bounded to [2,3])
```

This calculation method provides several benefits:

1. It maintains the core principle that a problem's readiness level is fundamentally limited by its least-ready sub-problem
2. It provides more granular feedback about progress within each readiness level
3. It encourages balanced progress across sub-problems
4. It makes progress visible even when some sub-problems are stuck at lower levels

## Efficient Updates

When a node's metrics change (either `setMetrics` or children), we only need to update a subset of nodes:

1. Update the changed node's `calculatedMetrics`
2. Walk up the tree, updating each parent's `calculatedMetrics`
3. Stop when either:
   - We reach the root node
   - OR a parent's `calculatedMetrics` doesn't change

Example update propagation:

```
       A(auto)
      /       \
  B(auto)    C(5)
   /   \       \
D(2)   E(3)    F(auto)

If E changes to E(7):
1. E.calculatedMetrics updates to 7
2. B.calculatedMetrics updates to 2 (min of 2 and 7)
3. A.calculatedMetrics updates to 2 (min of 2 and 5)

If D changes to D(1):
1. D.calculatedMetrics updates to 1
2. B.calculatedMetrics updates to 1 (min of 1 and 7)
3. A.calculatedMetrics updates to 1 (min of 1 and 5)

If C changes to C(auto):
1. C.calculatedMetrics updates to 0 (min of children, F=0)
2. A.calculatedMetrics updates to 0 (min of 1 and 0)
```

This efficient update pattern means we don't need to recalculate the entire tree when a single node changes.

## UI Guidelines

1. Always display `calculatedMetrics` values
2. Use `setMetrics` only to determine if a metric is in auto or manual mode
3. Show auto-mode indicator (e.g. circle-A icon) when `setMetrics` is absent for that metric
4. When editing, switching to auto mode should set `setMetrics` to null/undefined
5. When editing, setting a manual value should update `setMetrics`

## Adding New Metrics

When adding new metrics, follow this pattern:

1. Add the metric to both `setMetrics` and `calculatedMetrics` types
2. Implement calculation logic for when `setMetrics` is absent
3. Define sensible defaults for leaf nodes
4. Update UI to show auto/manual indicators appropriately

## Benefits

- **Consistency**: All metrics behave the same way
- **Simplicity**: UI always uses `calculatedMetrics` for display
- **Flexibility**: Easy to switch between manual and automatic modes
- **Clarity**: Clear distinction between user-set and calculated values
