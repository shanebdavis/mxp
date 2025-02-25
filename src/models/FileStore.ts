import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'
import matter from 'gray-matter'
import { TreeNode, TreeNodeProperties, NodeType, UpdateTreeNodeProperties, RootNodesByType } from './TreeNodeTypes'
import { calculateAllMetricsFromNodeId } from './TreeNodeMetrics'
import { nodesAreEqual, getDefaultFilename, ROOT_NODE_DEFAULT_PROPERTIES } from './TreeNodeLib'
import { createNode, getUpdatedNode, getRootNodesByType, getTreeWithNodeParentChanged, getTreeWithNodeAdded, getTreeWithNodeRemoved } from './TreeNode'

const { eq } = require('art-standard-lib')
import { array, formattedInspect, log } from '../ArtStandardLib'

interface NodeMetadata {
  id?: string
  title?: string
  readinessLevel?: number
  childrenIds?: string[]
  parentId?: string | null
  setMetrics?: Record<string, number>
  calculatedMetrics?: { readinessLevel: number }
  filename?: string  // The name of the file storing this node
  draft?: boolean
  type?: NodeType
}

const FILESTORE_SUB_DIRS_BY_TYPE: Record<NodeType, string> = {
  map: "maps",
  waypoint: "waypoints",
  user: "users"
}

const vivifyDirectory = async (dir: string) => {
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
  return dir
}

class FileStore {
  // private baseDir: string
  private _baseDirsByType: Record<NodeType, string>
  private _allNodes: Record<string, TreeNode>
  private isInitialized = false
  private _rootNodesByType: RootNodesByType


  get baseDirsByType() {
    this.ensureInitialized()
    return this._baseDirsByType
  }

  get allNodes() {
    this.ensureInitialized()
    return this._allNodes
  }

  get rootNodesByType() {
    this.ensureInitialized()
    return this._rootNodesByType
  }

  private set allNodes(nodes: Record<string, TreeNode>) {
    this._allNodes = nodes
  }

  constructor(baseDir: string) {
    // this.baseDir = path.join(baseDir, 'maps')
    this._baseDirsByType = Object.fromEntries(Object.entries(FILESTORE_SUB_DIRS_BY_TYPE).map(([type, dir]) => [type, path.join(baseDir, dir)])) as Record<NodeType, string>
    this._allNodes = {}
    this._rootNodesByType = {} as RootNodesByType // not initialized yet
  }

  /**
   * Initialize the file store - must be called exactly once; we do it here because it's async
   */
  async init() {
    if (this.isInitialized) {
      throw new Error('FileStore already initialized')
    }
    await this.ensureBaseDirs()
    await this.vivifyAllSubDirs()
    await this.loadAllNodes()
    const { nodes, rootNodesByType } = getRootNodesByType(this._allNodes)
    this.setAllNodesAndSaveAnyChanges(nodes)
    this._rootNodesByType = rootNodesByType

    for (const [type, dir] of Object.entries(FILESTORE_SUB_DIRS_BY_TYPE)) {
      const nodeType = type as NodeType
      let rootNode = this._rootNodesByType[nodeType]
      if (!rootNode) await this.vivifyRootNode(nodeType)
    }
    this.isInitialized = true
    return this;
  }

  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('FileStore not initialized')
    }
  }

  getNode(nodeId: string): TreeNode {
    this.ensureInitialized()
    const node = this._allNodes[nodeId]
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`)
    }
    return node
  }

  private async vivifyRootNode(nodeType: NodeType): Promise<TreeNode> {
    const rootNodesByType = this._rootNodesByType[nodeType]
    if (rootNodesByType) return rootNodesByType
    const newNode = createNode(nodeType, ROOT_NODE_DEFAULT_PROPERTIES[nodeType], null)
    const newAllNodes = { ...this._allNodes, [newNode.id]: newNode }
    await this.setAllNodesAndSaveAnyChanges(newAllNodes)
    this._rootNodesByType[nodeType] = newNode
    return newNode
  }

  getRootNode(nodeType: NodeType): TreeNode {
    this.ensureInitialized()
    if (!this.rootNodesByType[nodeType]) {
      throw new Error(`Root node not found for type: ${formattedInspect(nodeType)}`)
    }
    return this.rootNodesByType[nodeType]
  }

  async createNode(nodeType: NodeType, properties: TreeNodeProperties, parentId?: string | null, insertAtIndex?: number | null): Promise<TreeNode> {
    // Write the getFilename first
    parentId = parentId ?? this.getRootNode(nodeType).id
    const newNode = createNode(nodeType, properties, parentId)
    const newAllNodes = getTreeWithNodeAdded(this._allNodes, newNode, parentId, insertAtIndex)
    await this.setAllNodesAndSaveAnyChanges(newAllNodes)

    await this.saveNode(newAllNodes[newNode.id])
    await this.saveNode(newAllNodes[parentId])

    await this.updateNodeAndParentMetrics(parentId)
    return newNode
  }

  async updateNode(nodeId: string, properties: UpdateTreeNodeProperties): Promise<TreeNode> {
    // Get all nodes to calculate metrics accurately
    await this.saveNode(getUpdatedNode(this.getNode(nodeId), properties))

    // Calculate new metrics for this node and its ancestors
    await this.updateNodeAndParentMetrics(nodeId, true)

    // Get the final node state after metrics update
    return this.getNode(nodeId)
  }

  async setNodeParent(nodeId: string, newParentId: string, insertAtIndex?: number | null): Promise<void> {
    if (!this.getNode(nodeId).parentId) throw new Error('Cannot move a root node')
    await this.setAllNodesAndSaveAnyChanges(getTreeWithNodeParentChanged(this._allNodes, nodeId, newParentId, insertAtIndex))
  }

  async deleteNode(nodeId: string): Promise<void> {
    if (!this.getNode(nodeId).parentId) throw new Error('Cannot delete a root node')
    await this.setAllNodesAndSaveAnyChanges(getTreeWithNodeRemoved(this._allNodes, nodeId))
  }

  //**************************************************
  // PRIVATE METHODS
  //**************************************************

  private getNodesWithHealedParentIds(): Record<string, TreeNode> {
    // Find root node (node with no parent)
    const rootNode = Object.values(this._allNodes).find(node => !node.parentId)
    if (!rootNode) return this._allNodes // No root node found, can't heal

    // Check each node's parentId
    const healedNodes = { ...this._allNodes }

    for (const node of Object.values(healedNodes)) {
      // Skip root node
      if (!node.parentId) continue

      // If parent doesn't exist, attach to root
      if (!healedNodes[node.parentId]) {
        const updatedNode = {
          ...node,
          parentId: rootNode.id
        }
        healedNodes[node.id] = updatedNode
        if (!rootNode.childrenIds.includes(node.id)) {
          rootNode.childrenIds.push(node.id)
        }

      } else {
        // Parent exists, make sure this node is in parent's childrenIds
        const parent = healedNodes[node.parentId]
        if (!parent.childrenIds.includes(node.id)) {
          parent.childrenIds.push(node.id)
        }
      }
    }

    return healedNodes
  }



  private getNodesWithHealedChildrenIds(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
    const healedNodes = { ...nodes }

    // First, collect all valid node IDs
    const validNodeIds = new Set(Object.keys(nodes))

    // Then, for each node, remove any childrenIds that don't exist
    for (const node of Object.values(healedNodes)) {
      const validChildren = node.childrenIds.filter(id => validNodeIds.has(id))
      if (validChildren.length !== node.childrenIds.length) {
        healedNodes[node.id] = {
          ...node,
          childrenIds: validChildren
        }
      }
    }

    return healedNodes
  }

  private async setAllNodesAndSaveAnyChanges(updatedNodes: Record<string, TreeNode>) {
    // iterate through all nodes and save the ones that have changed
    const allOldNodes = this._allNodes

    await Promise.all(Object.keys(updatedNodes).map(async id => {
      if (!nodesAreEqual(allOldNodes[id], updatedNodes[id])) {
        await this.writeNodeFile(updatedNodes[id])
      }
    }))
    // update any deleted nodes
    await Promise.all(Object.keys(allOldNodes).map(async id => {
      if (!updatedNodes[id]) {
        await fs.unlink(this.getFilePath(allOldNodes[id]))
      }
    }))
    this._allNodes = updatedNodes
  }

  private async loadAllNodes() {
    for (const [type, dir] of Object.entries(this._baseDirsByType)) {
      const files = await fs.readdir(dir)
      for (const file of files) {
        const node = await this.readNodeFile(path.join(dir, file))
        this._allNodes[node.id] = node
      }
    }
    await this.setAllNodesAndSaveAnyChanges(this.getNodesWithHealedChildrenIds(this.getNodesWithHealedParentIds()))
  }

  private async ensureBaseDirs() {
    for (const dir of Object.values(this._baseDirsByType)) {
      try {
        await fs.access(dir)
      } catch {
        await fs.mkdir(dir, { recursive: true })
      }
    }
  }

  getFilePath({ type, filename }: TreeNode): string {
    return path.join(this._baseDirsByType[type], filename)
  }

  private async readNodeFile(filePath: string): Promise<TreeNode> {
    const content = await fs.readFile(filePath, 'utf-8')
    const { data: metadata = {}, content: description = '' } = matter(content)

    // Only use filename as fallback if title field is not present in yaml
    const fallbackTitle = path.basename(filePath, '.md')
    const hasTitle = 'title' in metadata
    const title = hasTitle ? (metadata.title ?? '') : fallbackTitle

    const id = metadata.id || uuid() // generate a new id if missing
    const filename = metadata.filename || (title.trim() || 'untitled') + '.md'
    const node = {
      id,
      title,
      filename,
      description: description.trim(),
      childrenIds: Array.isArray(metadata.childrenIds) ? metadata.childrenIds : [],
      parentId: metadata.parentId || null,
      calculatedMetrics: metadata.calculatedMetrics || { readinessLevel: 0 },
      draft: metadata.draft ?? false,
      type: metadata.type ?? "map",
      ...(metadata.setMetrics && { setMetrics: metadata.setMetrics })
    }

    // If any data was missing, heal the file by writing it back
    if (!metadata.id || !hasTitle || !metadata.childrenIds || metadata.parentId === undefined || !metadata.calculatedMetrics || !metadata.type) {
      // If we're healing a file without an ID, rename it to use the ID
      if (!metadata.id) {
        await fs.rename(filePath, this.getFilePath(node))
      }
      await this.writeNodeFile(node)
    }

    return node
  }

  private async updateNodeAndParentMetrics(nodeId: string, forceCheckParent = false): Promise<void> {
    const node = this.getNode(nodeId)

    // Calculate new metrics for this node
    const calculatedMetrics = calculateAllMetricsFromNodeId(nodeId, this._allNodes)

    if (!eq(node.calculatedMetrics, calculatedMetrics) || forceCheckParent) {
      await this.saveNode({ ...node, calculatedMetrics })
      // If parent exists, update parent
      if (node.parentId) {
        await this.updateNodeAndParentMetrics(node.parentId)
      }
    }
  }

  /**
   * Writes a node to the file system
   *
   * only saveNode should call this; everything else should call saveNode
   * @param node - The node to write
   * @returns The node that was written
   */
  private async writeNodeFile(node: TreeNode) {
    // Remove null/undefined values and empty objects recursively
    const cleanObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Keep empty strings (don't skip them)
        if (value === null || value === undefined) continue
        if (typeof value === 'object') {
          const cleaned = cleanObject(value)
          if (cleaned && (Array.isArray(cleaned) || Object.keys(cleaned).length > 0)) {
            result[key] = cleaned
          }
        } else {
          result[key] = value
        }
      }
      return result
    }

    // Prepare metadata, omitting description and null/empty values
    const metadata = {
      id: node.id,
      title: node.title === '' ? '' : node.title,
      filename: node.filename,
      parentId: node.parentId,
      childrenIds: node.childrenIds,
      calculatedMetrics: node.calculatedMetrics,
      draft: node.draft,
      type: node.type,
      ...(node.setMetrics && { setMetrics: node.setMetrics })
    }

    // Format the content with frontmatter and description
    const yamlContent = yaml.dump(metadata, { noRefs: true, quotingType: '"' })
      .replace(/^title: ''$/m, 'title: ""')
    const fileContent = `---\n${yamlContent}---\n${node.description || ''}`
    await fs.writeFile(this.getFilePath(node), fileContent)
    return node
  }

  private async saveNode(node: TreeNode) {
    this.ensureInitialized()
    const oldNode = this._allNodes[node.id]
    if (!nodesAreEqual(oldNode, node)) {
      node = { ...node, filename: getDefaultFilename(node) }
      const oldPath = this.getFilePath(oldNode)
      const newPath = this.getFilePath(node)
      if (oldPath !== newPath) await fs.rename(oldPath, newPath)

      this._allNodes[node.id] = node
      await this.writeNodeFile(node)
    }
    return this._allNodes[node.id]
  }

  private async vivifyAllSubDirs() {
    await Promise.all(
      array(FILESTORE_SUB_DIRS_BY_TYPE, vivifyDirectory)
    )

  }
}

export const createFileStore = async (baseDir: string) => (new FileStore(baseDir)).init()

export type { FileStore }