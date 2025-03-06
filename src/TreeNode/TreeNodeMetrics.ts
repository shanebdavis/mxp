import { Metrics, UpdateMetrics, TreeNode, TreeNodeSet } from './TreeNodeTypes'
import { getActiveChildren } from './TreeNodeLib'
import { compact, eq } from '../ArtStandardLib'

type CalculatableMetric = {
  default?: number | undefined
  calculate: (setMetrics: Metrics, childValues: Metrics[], referencedMapMetrics: Metrics | undefined) => number | undefined
}

const calculatableMetrics: Record<keyof Metrics, CalculatableMetric> = {
  readinessLevel: {
    default: 0,
    calculate: (setMetrics, childValues, referencedMapMetrics) => {
      const childrenReadinessLevels = compact(childValues.map(child => child?.readinessLevel))

      return setMetrics.readinessLevel != null ? setMetrics.readinessLevel
        : referencedMapMetrics?.readinessLevel != null ? referencedMapMetrics.readinessLevel
          : childrenReadinessLevels.length > 0 ? Math.min(...childrenReadinessLevels) : 0
    }
  },
  targetReadinessLevel: {
    calculate: (setMetrics, childValues) => {
      return setMetrics.targetReadinessLevel != null ? setMetrics.targetReadinessLevel : undefined
    }
  },
  workRemaining: {
    default: 0,
    calculate: (setMetrics, childValues, referencedMapMetrics) => {
      const targetAchieved = referencedMapMetrics?.readinessLevel != null && setMetrics.targetReadinessLevel != null
        ? referencedMapMetrics.readinessLevel >= setMetrics.targetReadinessLevel
        : false

      const childrenWorkRemaining = compact(childValues.map(child => child?.workRemaining))
      const workRemaining = setMetrics.workRemaining != null
        ? setMetrics.workRemaining
        : childrenWorkRemaining.length > 0 ? Math.min(...childrenWorkRemaining) : 0

      return targetAchieved ? 0 : workRemaining
    }
  }
}

const metricKeys = Object.keys(calculatableMetrics) as (keyof Metrics)[]

/**
 * Merge two metrics objects, with m2 having top priority
 * 1. null values indicates intensionally erasing the value
 * 2. undefined values are ignored
 * @param m1 - The first metrics object
 * @param m2 - The second metrics object
 * @returns A new metrics object that is the result of merging m2 into m1
 */
export const mergeMetrics = (m1: UpdateMetrics | undefined | null, m2: UpdateMetrics | undefined | null): Metrics => {
  const ret: any = {}
  if (!m1) m1 = {}
  if (!m2) m2 = {}
  metricKeys.forEach(metric => ret[metric] =
    m2[metric] === null ? null // m2 null means erase the value
      : m2[metric] ?? // m2 has a non-null, non-undefined value, use it
      (m1[metric] === null ? null // m1 null means erase the value
        : m1[metric]) // m1 has a non-null, use its value, undefined or not
  )
  return ret
}

/**
 * Compact a metrics object, removing null and undefined values
 * @param m - The metrics object to compact
 * @returns A new metrics object with null and undefined values removed
   */
export const compactMetrics = (m: UpdateMetrics): Metrics => {
  return Object.fromEntries(Object.entries(m).filter(([_, value]) => value != null))
}

export const compactMergeMetrics = (m1: UpdateMetrics | undefined | null, m2: UpdateMetrics | undefined | null): Metrics => {
  return compactMetrics(mergeMetrics(m1, m2))
}

export const calculateMetric = (metric: keyof Metrics, setValues: Metrics, childValues: Metrics[], referencedMapValue?: Metrics): number | undefined => {
  const calculator = calculatableMetrics[metric]
  return calculator.calculate(setValues, childValues, referencedMapValue) as number | undefined
}

export const calculateAllMetricsFromSetMetricsAndChildrenMetrics = (setMetrics: Metrics, childrenMetrics: Metrics[], referencedMapMetrics?: Metrics): Metrics => {
  // @ts-ignore
  return Object.fromEntries(Object.keys(calculatableMetrics).map(metric => [
    metric,
    // @ts-ignore
    calculateMetric(metric, setMetrics, childrenMetrics, referencedMapMetrics)
  ]))
}

export const calculateAllMetricsFromNode = (node: TreeNode, children: TreeNode[], referencedMapNode?: TreeNode): Metrics => {
  if (!node) return {};
  return calculateAllMetricsFromSetMetricsAndChildrenMetrics(
    node.setMetrics ?? {},
    children.filter(Boolean).map(child => child.calculatedMetrics),
    referencedMapNode?.calculatedMetrics
  )
}

export const calculateAllMetricsFromNodeId = (nodeId: string, allNodes: TreeNodeSet): Metrics => {
  const node = allNodes[nodeId]
  if (!node) {
    console.warn(`Node not found: ${nodeId}`)
    return {}
  }

  const referencedMapNode = node.metadata?.referenceMapNodeId ? allNodes[node.metadata.referenceMapNodeId] : undefined
  return calculateAllMetricsFromNode(node, getActiveChildren(allNodes, nodeId), referencedMapNode)
}

export const metricsAreSame = (a: Metrics, b: Metrics): boolean => eq(a, b)

