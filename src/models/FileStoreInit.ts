/**
 * Initialize the FileStore
 *
 * 1. create the "maps" directory
 * 2. initialize the FileStore object
 * 3. use the FileStore object to create the root node
 *
 * @param baseDir - The base directory for the FileStore
 */
export const initFileStore = async (baseDir: string) => {
  // Create maps directory if it doesn't exist
  const fs = await import('fs/promises')
  const path = await import('path')
  const { FileStore } = await import('./FileStore')
  const { NodeType } = await import('./TreeNode')

  const mapsDir = path.join(baseDir, 'maps')
  await fs.mkdir(mapsDir, { recursive: true })

  // Initialize FileStore
  const fileStore = new FileStore(baseDir)

  // Get all nodes to check if we need to create a root node
  const nodes = await fileStore.getAllNodes()
  const hasRootNode = Object.values(nodes).some(node => !node.parentId)

  // Create root node if none exists
  if (!hasRootNode) {
    await fileStore.createNode({
      title: 'Root Problem',
      description: 'What is the root problem you are trying to solve?',
      type: NodeType.Map
    }, null)
  }

  return fileStore
}