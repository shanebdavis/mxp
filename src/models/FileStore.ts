import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'
import type { TreeNode, TreeNodeProperties } from './TreeNode'

interface NodeMetadata {
  id?: string
  title?: string
  readinessLevel?: number
  childrenIds?: string[]
  parentId?: string | null
  setMetrics?: Record<string, number>
  calculatedMetrics?: { readinessLevel: number }
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

  private getFilePath(title: string): string {
    return path.join(this.baseDir, `${title}.md`)
  }

  private async readNodeFile(filePath: string): Promise<TreeNode> {
    const content = await fs.readFile(filePath, 'utf-8')
    const [, frontMatter = '', description = ''] = content.split('---\n')
    const metadata = yaml.load(frontMatter) as Partial<NodeMetadata> || {}

    // Extract the filename without extension as a fallback title
    const fallbackTitle = path.basename(filePath, '.md')

    const node = {
      id: metadata.id || uuid(), // generate a new id if missing
      title: metadata.title || fallbackTitle,
      description: description.trim(),
      childrenIds: Array.isArray(metadata.childrenIds) ? metadata.childrenIds : [],
      parentId: metadata.parentId || null,
      calculatedMetrics: metadata.calculatedMetrics || { readinessLevel: 0 },
      ...(metadata.setMetrics && { setMetrics: metadata.setMetrics })
    }

    // If any data was missing, heal the file by writing it back
    if (!metadata.id || !metadata.title || !metadata.childrenIds || metadata.parentId === undefined || !metadata.calculatedMetrics) {
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
    const metadata = cleanObject({
      id: node.id,
      title: node.title,
      childrenIds: node.childrenIds,
      parentId: node.parentId || undefined,
      setMetrics: node.setMetrics,
      calculatedMetrics: node.calculatedMetrics
    })

    const content = [
      '---',
      yaml.dump(metadata),
      '---',
      node.description || ''
    ].join('\n')

    await fs.writeFile(this.getFilePath(node.title), content)
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
    if (insertAtIndex != null && insertAtIndex >= 0) {
      return [...currentIds.slice(0, insertAtIndex), nodeId, ...currentIds.slice(insertAtIndex)]
    }
    return [...currentIds, nodeId]
  }

  private getChildrenIdsWithRemoval(childrenIds: string[] | undefined, nodeId: string): string[] {
    return (childrenIds || []).filter(id => id !== nodeId)
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

  private async calculateMetrics(node: TreeNode, nodes?: Record<string, TreeNode>): Promise<{ readinessLevel: number }> {
    // If this node has a manually set value, use it
    if (node.setMetrics?.readinessLevel != null) {
      return { readinessLevel: node.setMetrics.readinessLevel }
    }

    // Otherwise calculate from children
    if (node.childrenIds.length > 0) {
      const childNodes = nodes
        ? node.childrenIds.map(id => nodes[id])
        : await Promise.all(
          node.childrenIds.map(id => this.findNodeById(id).then(([node]) => node))
        )
      return {
        readinessLevel: Math.min(...childNodes.map(child => child.calculatedMetrics.readinessLevel))
      }
    }

    return { readinessLevel: 0 }
  }

  async createNode(properties: TreeNodeProperties, parentId: string | null, insertAtIndex?: number | null): Promise<TreeNode> {
    await this.ensureBaseDir()

    const node: TreeNode = {
      id: uuid(),
      title: properties.title,
      description: properties.description || '',
      childrenIds: [],
      parentId: parentId || null,
      calculatedMetrics: { readinessLevel: 0 },
      ...(properties.readinessLevel && { setMetrics: { readinessLevel: properties.readinessLevel } }),
      ...(properties.setMetrics && { setMetrics: properties.setMetrics })
    }

    // Calculate initial metrics for the new node
    node.calculatedMetrics = await this.calculateMetrics(node)

    // Write the node first
    await this.writeNodeFile(node)

    // If there's a parent, update its childrenIds and metrics
    if (parentId) {
      const [parentNode] = await this.findNodeById(parentId)
      const updatedParent = {
        ...parentNode,
        childrenIds: this.getChildrenIdsWithInsertion(parentNode.childrenIds, node.id, insertAtIndex)
      }

      // Write parent with updated childrenIds
      await this.writeNodeFile(updatedParent)

      // Now get all nodes to calculate metrics accurately
      const allNodes = await this.getAllNodes()
      updatedParent.calculatedMetrics = await this.calculateMetrics(updatedParent, allNodes)
      await this.writeNodeFile(updatedParent)
    }

    return node
  }

  async updateNode(nodeId: string, properties: Partial<TreeNodeProperties>): Promise<TreeNode> {
    const [node, filePath] = await this.findNodeById(nodeId)

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

    // Write the node first
    if (properties.title && properties.title !== node.title) {
      await fs.unlink(filePath)
    }
    await this.writeNodeFile(updatedNode)

    // Now calculate and update metrics
    updatedNode.calculatedMetrics = await this.calculateMetrics(updatedNode)
    await this.writeNodeFile(updatedNode)

    // Update parent's metrics if it exists
    if (updatedNode.parentId) {
      const [parentNode] = await this.findNodeById(updatedNode.parentId)
      const updatedParent = {
        ...parentNode,
        calculatedMetrics: await this.calculateMetrics(parentNode)
      }
      await this.writeNodeFile(updatedParent)
    }

    return updatedNode
  }

  async setNodeParent(nodeId: string, newParentId: string, insertAtIndex?: number | null): Promise<TreeNode> {
    // Validate the move
    if (await this.isParentOf(nodeId, newParentId)) {
      throw new Error('Cannot move a node to one of its descendants')
    }

    const [node] = await this.findNodeById(nodeId)
    const [newParent] = await this.findNodeById(newParentId)

    // Remove from old parent if it exists
    if (node.parentId) {
      const [oldParent] = await this.findNodeById(node.parentId)
      const updatedOldParent = {
        ...oldParent,
        childrenIds: this.getChildrenIdsWithRemoval(oldParent.childrenIds, nodeId)
      }
      await this.writeNodeFile(updatedOldParent)
    }

    // Add to new parent
    const updatedNewParent = {
      ...newParent,
      childrenIds: this.getChildrenIdsWithInsertion(newParent.childrenIds, nodeId, insertAtIndex)
    }
    await this.writeNodeFile(updatedNewParent)

    // Update node's parent reference
    const updatedNode = {
      ...node,
      parentId: newParentId
    }
    await this.writeNodeFile(updatedNode)

    return updatedNode
  }

  async deleteNode(nodeId: string): Promise<void> {
    const [node, filePath] = await this.findNodeById(nodeId)

    // Remove from parent's childrenIds if it has a parent
    if (node.parentId) {
      const [parentNode] = await this.findNodeById(node.parentId)
      const updatedParent = {
        ...parentNode,
        childrenIds: this.getChildrenIdsWithRemoval(parentNode.childrenIds, nodeId)
      }
      await this.writeNodeFile(updatedParent)
    }

    // Delete all descendant nodes recursively
    for (const childId of node.childrenIds) {
      await this.deleteNode(childId)
    }

    // Delete the node file
    await fs.unlink(filePath)
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

    return nodes
  }
}