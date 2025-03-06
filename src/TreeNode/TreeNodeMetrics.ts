import { Metrics, UpdateMetrics, TreeNode, TreeNodeSet } from './TreeNodeTypes'
import { getActiveChildren } from './TreeNodeLib'
import { compact, eq } from '../ArtStandardLib'

type CalculatableMetric<T> = {
  default?: T | undefined
  calculate: (setValue: T | undefined, childValues: T[], referencedMapValue: T | undefined) => T
}

const calculatableMetrics: Record<keyof Metrics, CalculatableMetric<number | undefined>> = {
  readinessLevel: {
    default: 0,
    calculate: (setValue, childValues, referencedMapValue) =>
      setValue != null ? setValue
        : referencedMapValue != null ? referencedMapValue
          : compact(childValues).length > 0 ? Math.min(...compact(childValues)) : 0
  },
  targetReadinessLevel: {
    calculate: (setValue, childValues) => setValue != null ? setValue : undefined
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

export const calculateMetric = (metric: keyof Metrics, setValues: Metrics, childValues: number[], referencedMapValue: number | undefined): number => {
  const calculator = calculatableMetrics[metric]
  const setValue = setValues[metric]
  return calculator.calculate(setValue, childValues as any[], referencedMapValue) as number
}

export const calculateAllMetricsFromSetMetricsAndChildrenMetrics = (setMetrics: Metrics, childrenMetrics: Metrics[], referencedMapMetrics: Metrics | undefined): Metrics => {
  // @ts-ignore
  const result: Metrics = Object.fromEntries(Object.keys(calculatableMetrics).map(metric => [
    metric,
    // @ts-ignore
    calculateMetric(metric, setMetrics, childrenMetrics.map(child => child[metric]), referencedMapMetrics?.[metric])
  ]))
  return result
}

export const calculateAllMetricsFromNode = (node: TreeNode, children: TreeNode[], referencedMapNode: TreeNode | undefined): Metrics => {
  return calculateAllMetricsFromSetMetricsAndChildrenMetrics(node.setMetrics ?? {}, children.map(child => child.calculatedMetrics), referencedMapNode?.calculatedMetrics)
}

export const calculateAllMetricsFromNodeId = (nodeId: string, allNodes: TreeNodeSet): Metrics => {
  const node = allNodes[nodeId]
  if (!node) throw new Error(`Node not found: ${nodeId}`)
  return calculateAllMetricsFromNode(node, getActiveChildren(allNodes, nodeId), node.metadata?.referenceMapNodeId != null ? allNodes[node.metadata?.referenceMapNodeId] : undefined)
}

export const metricsAreSame = (a: Metrics, b: Metrics): boolean => eq(a, b)

