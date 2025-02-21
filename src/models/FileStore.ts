import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'
import matter from 'gray-matter'
import { TreeNode, TreeNodeProperties, Metrics } from './TreeNode'

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
}

export class FileStore {
  constructor(private baseDir: string) { }

  private async ensureBaseDir() {
    try {
      await fs.access(this.baseDir)
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true })
    }
  }

  private getFilePath(title: string | undefined | null, id?: string): string {
    const fileName = (typeof title === 'string' ? title.trim() : '') || 'untitled'
    return path.join(this.baseDir, `${fileName.replace(/[<>:"/\\|?*]/g, '_')}.md`)
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
      ...(metadata.setMetrics && { setMetrics: metadata.setMetrics })
    }

    // If any data was missing, heal the file by writing it back
    if (!metadata.id || !hasTitle || !metadata.childrenIds || metadata.parentId === undefined || !metadata.calculatedMetrics) {
      // If we're healing a file without an ID, rename it to use the ID
      if (!metadata.id) {
        await fs.rename(filePath, this.getFilePath(node.title, node.id))
      }
      await this.writeNodeFile(node)
    }

    return node
  }

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
      title: node.title,
      filename: node.filename,
      parentId: node.parentId,
      childrenIds: node.childrenIds,
      calculatedMetrics: node.calculatedMetrics,
      draft: node.draft,
      ...(node.setMetrics && { setMetrics: node.setMetrics })
    }

    const fileContent = matter.stringify(node.description || '', metadata)
    await fs.writeFile(this.getFilePath(node.title, node.id), fileContent)
  }

  private async findNodeById(nodeId: string): Promise<[TreeNode, string]> {
    const files = await fs.readdir(this.baseDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const filePath = path.join(this.baseDir, file)
      const node = await this.readNodeFile(filePath)

      if (node.id === nodeId) {
        return [node, filePath]
      }
    }
    throw new Error(`Node not found: ${nodeId}`)
  }

  private getChildrenIdsWithInsertion(childrenIds: string[] | undefined, nodeId: string, insertAtIndex?: number | null): string[] {
    const currentIds = childrenIds || []
    // First, remove any existing instances of nodeId to prevent duplicates
    const filteredIds = currentIds.filter(id => id !== nodeId)

    if (insertAtIndex != null && insertAtIndex >= 0) {
      return [...filteredIds.slice(0, insertAtIndex), nodeId, ...filteredIds.slice(insertAtIndex)]
    }
    return [...filteredIds, nodeId]
  }

  private getChildrenIdsWithRemoval(childrenIds: string[], nodeId: string): string[] {
    return childrenIds.filter(id => id !== nodeId)
  }

  private async isParentOf(parentId: string, childId: string): Promise<boolean> {
    try {
      const [child] = await this.findNodeById(childId)
      if (!child) return false
      if (child.parentId === parentId) return true
      if (!child.parentId) return false
      return this.isParentOf(parentId, child.parentId)
    } catch {
      return false
    }
  }

  private calculateReadinessLevel(node: TreeNode, children: TreeNode[]): number {
    // if the node has a manually set readiness level, use that
    if (node.setMetrics?.readinessLevel != null) return node.setMetrics.readinessLevel

    // default
    if (children.length === 0) return 0

    // otherwise, use the minimum readiness level from children
    return children.reduce((min, child) => Math.min(min, child.calculatedMetrics.readinessLevel), Infinity)
  }

  private async calculateMetrics(nodeId: string, allNodes: Record<string, TreeNode>): Promise<Metrics> {
    const node = allNodes[nodeId]
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const children = node.childrenIds.map(childId => allNodes[childId]).filter(child => !child.draft)

    return {
      readinessLevel: this.calculateReadinessLevel(node, children)
    }
  }

  private async updateNodeAndParentMetrics(nodeId: string, allNodes: Record<string, TreeNode>): Promise<void> {
    const node = allNodes[nodeId]
    if (!node) return

    // Calculate new metrics for this node
    const newMetrics = await this.calculateMetrics(nodeId, allNodes)

    // Always update the node's metrics and write it back
    const updatedNode = { ...node, calculatedMetrics: newMetrics }
    await this.writeNodeFile(updatedNode)
    allNodes[nodeId] = updatedNode

    // If parent exists, update parent
    if (node.parentId) {
      await this.updateNodeAndParentMetrics(node.parentId, allNodes)
    }
  }

  async createNode(properties: TreeNodeProperties, parentId: string | null = null, insertAtIndex?: number | null): Promise<TreeNode> {
    await this.ensureBaseDir()

    const node: TreeNode = {
      id: uuid(),
      title: properties.title || '',
      description: properties.description || '',
      filename: `${properties.title || 'untitled'}.md`,
      parentId: parentId || null,
      childrenIds: [],
      calculatedMetrics: { readinessLevel: properties.readinessLevel || 0 },
      draft: properties.draft ?? false,
      ...(properties.readinessLevel && { setMetrics: { readinessLevel: properties.readinessLevel } }),
      ...(properties.setMetrics && { setMetrics: properties.setMetrics })
    }

    // Calculate initial metrics for the new node
    const newMetrics = await this.calculateMetrics(node.id, { [node.id]: node })
    node.calculatedMetrics = newMetrics

    // Write the node first
    await this.writeNodeFile(node)

    // If it has a parent, update parent's childrenIds
    if (node.parentId) {
      const [parentNode] = await this.findNodeById(node.parentId)
      const updatedParent = {
        ...parentNode,
        childrenIds: this.getChildrenIdsWithInsertion(parentNode.childrenIds, node.id, insertAtIndex)
      }

      // Write parent with updated childrenIds
      await this.writeNodeFile(updatedParent)

      // Now get all nodes to calculate metrics accurately
      const allNodes = await this.getAllNodes()
      await this.updateNodeAndParentMetrics(parentNode.id, allNodes)
    }

    return node
  }

  async updateNode(nodeId: string, properties: Partial<TreeNodeProperties>): Promise<TreeNode> {
    const [node] = await this.findNodeById(nodeId)

    // Handle setMetrics updates
    let updatedSetMetrics = node.setMetrics
    if ('setMetrics' in properties) {
      if (!properties.setMetrics || Object.keys(properties.setMetrics).length === 0) {
        updatedSetMetrics = undefined
      } else {
        updatedSetMetrics = properties.setMetrics
      }
    } else if ('readinessLevel' in properties) {
      updatedSetMetrics = { readinessLevel: properties.readinessLevel ?? null }
    }

    const updatedNode = {
      ...node,
      ...properties,
      setMetrics: updatedSetMetrics
    }

    // Handle file rename if title changed
    if (properties.title !== undefined && properties.title !== node.title) {
      const oldPath = this.getFilePath(node.title, node.id)
      const newPath = this.getFilePath(properties.title, node.id)
      await fs.rename(oldPath, newPath)
    }

    // Get all nodes to calculate metrics accurately
    const allNodes = await this.getAllNodes()
    allNodes[nodeId] = updatedNode

    // Calculate new metrics for this node and its ancestors
    await this.updateNodeAndParentMetrics(nodeId, allNodes)

    // Get the final node state after metrics update
    const [finalNode] = await this.findNodeById(nodeId)
    return finalNode
  }

  async setNodeParent(nodeId: string, newParentId: string | null, insertAtIndex?: number | null): Promise<void> {
    const [node] = await this.findNodeById(nodeId)
    const oldParentId = node.parentId

    // If new parent is not null, check for circular reference
    if (newParentId) {
      const [newParent] = await this.findNodeById(newParentId)
      let currentParent = newParent
      while (currentParent.parentId) {
        if (currentParent.parentId === nodeId) {
          throw new Error('Cannot move a node to one of its descendants')
        }
        const [parent] = await this.findNodeById(currentParent.parentId)
        currentParent = parent
      }
    }

    // Update node's parentId
    const updatedNode = { ...node, parentId: newParentId }
    await this.writeNodeFile(updatedNode)

    // Remove from old parent's childrenIds if it had a parent
    if (oldParentId) {
      const [oldParent] = await this.findNodeById(oldParentId)
      const updatedOldParent = {
        ...oldParent,
        childrenIds: this.getChildrenIdsWithRemoval(oldParent.childrenIds, nodeId)
      }
      await this.writeNodeFile(updatedOldParent)
    }

    // Add to new parent's childrenIds if it has a new parent
    if (newParentId) {
      const [newParent] = await this.findNodeById(newParentId)
      const updatedNewParent = {
        ...newParent,
        childrenIds: this.getChildrenIdsWithInsertion(newParent.childrenIds, nodeId, insertAtIndex)
      }
      await this.writeNodeFile(updatedNewParent)
    }

    // Update metrics for both old and new parent chains
    const allNodes = await this.getAllNodes()
    if (oldParentId) {
      await this.updateNodeAndParentMetrics(oldParentId, allNodes)
    }
    if (newParentId) {
      await this.updateNodeAndParentMetrics(newParentId, allNodes)
    }
  }

  async deleteNode(nodeId: string): Promise<void> {
    const [node, filePath] = await this.findNodeById(nodeId)

    // If there's a parent, update its childrenIds first
    if (node.parentId) {
      const [parentNode] = await this.findNodeById(node.parentId)
      const updatedParent = {
        ...parentNode,
        childrenIds: parentNode.childrenIds.filter(id => id !== nodeId)
      }
      await this.writeNodeFile(updatedParent)
    }

    // Delete all descendant nodes recursively
    for (const childId of [...node.childrenIds]) {
      await this.deleteNode(childId)
    }

    // Delete the node file
    await fs.unlink(filePath)

    // Now get all nodes to calculate metrics accurately
    if (node.parentId) {
      const allNodes = await this.getAllNodes()
      await this.updateNodeAndParentMetrics(node.parentId, allNodes)
    }
  }

  private async healParentIds(nodes: Record<string, TreeNode>): Promise<Record<string, TreeNode>> {
    // Find root node (node with no parent)
    const rootNode = Object.values(nodes).find(node => !node.parentId)
    if (!rootNode) return nodes // No root node found, can't heal

    // Check each node's parentId
    let needsHealing = false
    const healedNodes = { ...nodes }

    for (const node of Object.values(healedNodes)) {
      // Skip root node
      if (!node.parentId) continue

      // If parent doesn't exist, attach to root
      if (!healedNodes[node.parentId]) {
        needsHealing = true
        const updatedNode = {
          ...node,
          parentId: rootNode.id
        }
        healedNodes[node.id] = updatedNode
        if (!rootNode.childrenIds.includes(node.id)) {
          rootNode.childrenIds.push(node.id)
        }

        // Update the file with the new parent ID
        await this.writeNodeFile(updatedNode)
      } else {
        // Parent exists, make sure this node is in parent's childrenIds
        const parent = healedNodes[node.parentId]
        if (!parent.childrenIds.includes(node.id)) {
          needsHealing = true
          parent.childrenIds.push(node.id)
          await this.writeNodeFile(parent)
        }
      }
    }

    // If we made changes, write the root node too
    if (needsHealing) {
      await this.writeNodeFile(rootNode)
    }

    return healedNodes
  }

  private getFilename(title: string): string {
    return (title || 'untitled') + '.md'
  }

  private async healChildrenIds(nodes: Record<string, TreeNode>): Promise<Record<string, TreeNode>> {
    const healedNodes = { ...nodes }
    let needsHealing = false

    // First, collect all valid node IDs
    const validNodeIds = new Set(Object.keys(nodes))

    // Then, for each node, remove any childrenIds that don't exist
    for (const node of Object.values(healedNodes)) {
      const validChildren = node.childrenIds.filter(id => validNodeIds.has(id))
      if (validChildren.length !== node.childrenIds.length) {
        needsHealing = true
        healedNodes[node.id] = {
          ...node,
          childrenIds: validChildren
        }
        await this.writeNodeFile(healedNodes[node.id])
      }
    }

    return healedNodes
  }

  async getAllNodes(): Promise<Record<string, TreeNode>> {
    await this.ensureBaseDir()

    const files = await fs.readdir(this.baseDir)
    const nodes: Record<string, TreeNode> = {}

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const filePath = path.join(this.baseDir, file)
      const node = await this.readNodeFile(filePath)
      nodes[node.id] = node
    }

    // Heal any invalid parentIds and childrenIds
    const healedParents = await this.healParentIds(nodes)
    return this.healChildrenIds(healedParents)
  }
}