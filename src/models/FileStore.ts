import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'
import matter from 'gray-matter'
import {
  TreeNode,
  TreeNodeProperties,
  NodeType,
  UpdateTreeNodeProperties,
  RootNodesByType,
  TreeNodeSet,
  TreeNodeSetDelta,
  createNode,
  vivifyRootNodesByType,
  getTreeNodeSetDeltaForNodeAdded,
  getTreeNodeSetDeltaForNodeUpdated,
  getTreeNodeSetDeltaForNodeParentChanged,
  getTreeNodeSetDeltaForNodeRemoved,
  getTreeNodeSetWithDeltaApplied,
  getHealedChildrenIdsDelta,
  getHealedParentIdsDelta,
  NodeState
} from '../TreeNode'

import { array, formattedInspect } from '../ArtStandardLib'

interface NodeMetadata {
  id?: string
  title?: string
  readinessLevel?: number
  childrenIds?: string[]
  parentId?: string | null
  setMetrics?: Record<string, number>
  calculatedMetrics?: { readinessLevel: number }
  filename?: string  // The name of the file storing this node
  nodeState?: NodeState  // Replacing draft with nodeState
  type?: NodeType
  metadata?: any
}

interface ExpeditionConfig {
  projectTitle?: string
  workUnits?: string
  iconPath?: string
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
  private _allNodes: TreeNodeSet
  private isInitialized = false
  private _rootNodesByType: RootNodesByType
  private _config: ExpeditionConfig = {} // Default empty config

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

  get config() {
    this.ensureInitialized()
    return this._config
  }

  private set allNodes(nodes: TreeNodeSet) {
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

    // Get base directory from first type's directory by removing the type-specific part
    const baseDir = path.dirname(this._baseDirsByType[Object.keys(this._baseDirsByType)[0] as NodeType])

    await this.loadConfig(baseDir)
    await this.ensureBaseDirs()
    await this.vivifyAllSubDirs()
    await this.loadAllNodes()

    const { delta, rootNodesByType } = vivifyRootNodesByType(this._allNodes)
    await this.setAllNodesAndSaveAnyChanges(delta)
    this._rootNodesByType = rootNodesByType

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

  getRootNode(nodeType: NodeType): TreeNode {
    this.ensureInitialized()
    if (!this.rootNodesByType[nodeType]) {
      throw new Error(`Root node not found for type: ${formattedInspect(nodeType)}`)
    }
    return this.rootNodesByType[nodeType]
  }

  async createNode(nodeType: NodeType, properties: TreeNodeProperties, parentId?: string | null, insertAtIndex?: number | null): Promise<{ node: TreeNode, delta: TreeNodeSetDelta }> {
    parentId = parentId ?? this.getRootNode(nodeType).id
    const node = createNode(nodeType, properties, parentId)

    // Override the filename to use the node ID instead of title
    node.filename = this.getFilenameFromId(node.id)

    // Return the node from the updated nodes
    return {
      node,
      delta: await this.setAllNodesAndSaveAnyChanges(getTreeNodeSetDeltaForNodeAdded(
        this._allNodes,
        node,
        parentId,
        insertAtIndex
      ))
    };
  }

  async updateNode(nodeId: string, properties: UpdateTreeNodeProperties): Promise<TreeNodeSetDelta> {
    return this.setAllNodesAndSaveAnyChanges(getTreeNodeSetDeltaForNodeUpdated(
      this._allNodes,
      nodeId,
      properties
    ))
  }

  async setNodeParent(nodeId: string, newParentId: string, insertAtIndex?: number | null): Promise<TreeNodeSetDelta> {
    if (!this.getNode(nodeId).parentId) throw new Error('Cannot move a root node')

    // Create delta for changing the parent
    return this.setAllNodesAndSaveAnyChanges(getTreeNodeSetDeltaForNodeParentChanged(
      this._allNodes,
      nodeId,
      newParentId,
      insertAtIndex
    ))
  }

  async deleteNode(nodeId: string): Promise<TreeNodeSetDelta> {
    if (!this.getNode(nodeId).parentId) throw new Error('Cannot delete a root node')

    // Create delta for removing the node
    return this.setAllNodesAndSaveAnyChanges(getTreeNodeSetDeltaForNodeRemoved(this._allNodes, nodeId))
  }

  //**************************************************
  // PRIVATE METHODS
  //**************************************************


  /**
   * Applies healing to all nodes and saves changes to disk.
   * Uses the delta pattern internally for efficient updates.
   */
  private async healNodesAndSave() {
    // First heal parent ids
    const parentDelta = getHealedParentIdsDelta(this._allNodes);

    // Apply the parent healing
    this._allNodes = getTreeNodeSetWithDeltaApplied(this._allNodes, parentDelta);

    // Then heal children ids
    const childrenDelta = getHealedChildrenIdsDelta(this._allNodes);

    // Save all changes
    await this.setAllNodesAndSaveAnyChanges({
      updated: { ...parentDelta.updated, ...childrenDelta.updated },
      removed: { ...parentDelta.removed, ...childrenDelta.removed }
    });
  }

  private async setAllNodesAndSaveAnyChanges(delta: TreeNodeSetDelta) {
    await Promise.all([
      ...Object.keys(delta.updated).map(id => this.writeNodeFile(delta.updated[id])),
      ...Object.keys(delta.removed).map(id => fs.unlink(this.getFilePath(delta.removed[id])))
    ])

    this._allNodes = getTreeNodeSetWithDeltaApplied(this._allNodes, delta)
    return delta
  }

  private async loadAllNodes() {
    for (const [type, dir] of Object.entries(this._baseDirsByType)) {
      const files = await fs.readdir(dir)
      for (const file of files) {
        const filePath = path.join(dir, file)

        // Check if it's actually a file, not a directory
        try {
          const stats = await fs.stat(filePath)
          if (stats.isDirectory()) {
            console.warn(`Skipping directory: ${filePath}`)
            continue
          }

          // Only process markdown files
          if (!file.endsWith('.md')) {
            console.warn(`Skipping non-markdown file: ${filePath}`)
            continue
          }

          const node = await this.readNodeFile(filePath)
          this._allNodes[node.id] = node
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
          // Continue with other files even if this one fails
        }
      }
    }
    // Use the new healing method
    await this.healNodesAndSave()
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
    const node = {
      id: metadata.id || uuid(),
      title: metadata.title || path.basename(filePath, '.md'),
      filename: path.basename(filePath),
      description: description.trim(),
      childrenIds: Array.isArray(metadata.childrenIds) ? metadata.childrenIds : [],
      parentId: metadata.parentId || null,
      calculatedMetrics: metadata.calculatedMetrics || {},
      nodeState: metadata.nodeState ?? (metadata.draft ? "draft" : "active"),  // Convert legacy draft to nodeState
      type: metadata.type ?? "map",
      ...(metadata.setMetrics && { setMetrics: metadata.setMetrics }),
      ...(metadata.metadata && { metadata: metadata.metadata })
    }

    // If any data was missing, heal the file by writing it back
    if (!metadata.id || !metadata.title || !metadata.childrenIds || metadata.parentId === undefined || !metadata.calculatedMetrics || !metadata.type) {
      // If we're healing a file without an ID, rename it to use the ID
      if (!metadata.id) {
        await fs.rename(filePath, this.getFilePath(node))
      }
      // Use writeNodeFile directly as we're initializing the store
      await this.writeNodeFile(node)
    }

    return node
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
      parentId: node.parentId,
      childrenIds: node.childrenIds,
      calculatedMetrics: node.calculatedMetrics,
      nodeState: node.nodeState,
      type: node.type,
      ...(node.setMetrics && { setMetrics: node.setMetrics }),
      ...(node.metadata && { metadata: cleanObject(node.metadata) })
    }

    // Format the content with frontmatter and description
    const yamlContent = yaml.dump(metadata, { noRefs: true, quotingType: '"' })
      .replace(/^title: ''$/m, 'title: ""')
    const fileContent = `---\n${yamlContent}---\n${node.description || ''}`
    await fs.writeFile(this.getFilePath(node), fileContent)
    return node
  }

  private async vivifyAllSubDirs() {
    await Promise.all(
      array(Object.values(this._baseDirsByType), vivifyDirectory)
    )
  }

  getFilenameFromId(id: string): string {
    return `${id}.md`
  }

  /**
   * Load config file if it exists, return empty config if it doesn't
   */
  private async loadConfig(baseDir: string) {
    const configPath = path.join(baseDir, 'mxp-config.yml')

    try {
      const content = await fs.readFile(configPath, 'utf-8')
      const config = yaml.load(content) as unknown
      console.log({ config })

      // Validate config structure
      if (typeof config === 'object' && config !== null) {
        const validatedConfig: ExpeditionConfig = {}

        const { projectTitle, workUnits, iconPath } = config as Record<string, unknown>

        if (projectTitle !== undefined && typeof projectTitle === 'string') {
          validatedConfig.projectTitle = projectTitle
        }

        if (workUnits !== undefined && typeof workUnits === 'string') {
          validatedConfig.workUnits = workUnits
        }

        if (iconPath !== undefined && typeof iconPath === 'string') {
          validatedConfig.iconPath = iconPath
        }

        this._config = validatedConfig
      }
    } catch (error) {
      // If file doesn't exist, just use empty config
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Error loading config file:', error)
      }
      // Continue with empty config in all error cases
    }
  }
}

export const createFileStore = async (baseDir: string) => (new FileStore(baseDir)).init()

export type { FileStore }