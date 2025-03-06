export type NodeType = "map" | "waypoint" | "user"

/**
 * Node state type, replacing the boolean draft field
 * This allows for more states beyond just draft and active
 */
export type NodeState = "draft" | "active"

type MetricsBase = {
  readinessLevel: number
  targetReadinessLevel: number
}

export type Metrics = Partial<MetricsBase>

export type UpdateMetrics = {
  [Property in keyof Metrics]?: Metrics[Property] | null;
}

export type Metadata = {
  referenceMapNodeId?: string
}

export interface TreeNodeProperties {
  title: string
  description?: string
  metadata?: Metadata
  setMetrics?: Metrics
  nodeState?: NodeState  // Replacing draft with nodeState
}

export type UpdateTreeNodeProperties = Omit<Partial<TreeNodeProperties>, 'setMetrics'> & {
  setMetrics?: UpdateMetrics;
};

export interface TreeNode extends TreeNodeProperties {
  id: string
  type: NodeType
  parentId: string | null
  childrenIds: string[]
  calculatedMetrics: Metrics
  filename: string  // The name of the file storing this node
  nodeState: NodeState  // Required in TreeNode, replaces draft
}

export type TreeNodeSet = Record<string, TreeNode>
export type RootNodesByType = Record<NodeType, TreeNode>

export type TreeNodeWithChildren = TreeNode & {
  children: TreeNodeWithChildren[]
}

export type TreeNodeSetDelta = {
  updated: TreeNodeSet // added or updated nodes with their latest values
  removed: TreeNodeSet // removed nodes with their last values
}