import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'
import type { TreeNode, TreeNodeProperties } from './TreeNode'

interface NodeMetadata {
  id: string
  title: string
  readinessLevel?: number
  childrenIds: string[]
  parentId: string | null
  setMetrics?: Record<string, number>
  calculatedMetrics: { readinessLevel: number }
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
    const [, frontMatter, description = ''] = content.split('---\n')
    const metadata = yaml.load(frontMatter) as NodeMetadata

    return {
      ...metadata,
      description: description.trim(),
      childrenIds: metadata.childrenIds || [],
      calculatedMetrics: metadata.calculatedMetrics || { readinessLevel: 0 }
    }
  }

  private async writeNodeFile(node: TreeNode) {
    const { description, ...metadata } = node
    const content = [
      '---',
      yaml.dump(metadata),
      '---',
      description
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

  private getChildrenIdsWithInsertion(childrenIds: string[], nodeId: string, insertAtIndex?: number | null): string[] {
    if (insertAtIndex != null && insertAtIndex >= 0) {
      return [...childrenIds.slice(0, insertAtIndex), nodeId, ...childrenIds.slice(insertAtIndex)]
    }
    return [...childrenIds, nodeId]
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

  async createNode(properties: TreeNodeProperties, parentId: string | null, insertAtIndex?: number | null): Promise<TreeNode> {
    await this.ensureBaseDir()

    const node: TreeNode = {
      id: uuid(),
      childrenIds: [],
      parentId,
      calculatedMetrics: { readinessLevel: 0 },
      ...properties
    }

    // If there's a parent, update its childrenIds
    if (parentId) {
      const [parentNode] = await this.findNodeById(parentId)
      const updatedParent = {
        ...parentNode,
        childrenIds: this.getChildrenIdsWithInsertion(parentNode.childrenIds, node.id, insertAtIndex)
      }
      await this.writeNodeFile(updatedParent)
    }

    await this.writeNodeFile(node)
    return node
  }

  async updateNode(nodeId: string, properties: Partial<TreeNodeProperties>): Promise<TreeNode> {
    const [node, filePath] = await this.findNodeById(nodeId)
    const updatedNode = { ...node, ...properties }

    // If title changed, delete old file
    if (properties.title && properties.title !== node.title) {
      await fs.unlink(filePath)
    }

    await this.writeNodeFile(updatedNode)
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