export type NodeType = "map" | "waypoint" | "user"

export type Metrics = {
  readinessLevel: number
}

export type PartialMetrics = Partial<Metrics>
export type UpdateMetrics = {
  [Property in keyof Metrics]?: Metrics[Property] | null;
}

export interface TreeNodeProperties {
  title: string
  description?: string
  metadata?: Record<string, string | number | boolean | Date>
  setMetrics?: PartialMetrics
  draft?: boolean
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