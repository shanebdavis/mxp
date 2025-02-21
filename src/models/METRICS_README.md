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
  calculatedMetrics: { readinessLevel: 0 }, // Default value
  childrenIds: [], // No children
};
```

## Readiness Level Example

The readiness level metric demonstrates the complete calculation pattern:

```typescript
const calculateReadinessLevel = (node, children) => {
  // If manually set, use that value
  if (node.setMetrics?.readinessLevel != null) {
    return node.setMetrics.readinessLevel;
  }

  // If has children, use min of their calculatedMetrics
  if (children.length > 0) {
    return Math.min(
      ...children.map((child) => child.calculatedMetrics.readinessLevel)
    );
  }

  // Default for leaf nodes
  return 0;
};
```

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
- B: calculatedMetrics.readinessLevel = 2 (min of D and E)
- A: calculatedMetrics.readinessLevel = 2 (min of B and C)
```

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
