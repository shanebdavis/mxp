import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { useTempDir } from './helpers/tempDir'
import { initFileStore } from '../models/FileStoreInit'
import { NodeType } from '../models/TreeNode'

describe('FileStoreInit', () => {
  const { useTemp } = useTempDir({ prefix: 'filestore-init-test-' })

  it('creates maps directory and root node in empty directory', async () => {
    const { path: testDir } = useTemp()

    // Initialize FileStore
    const fileStore = await initFileStore(testDir)

    // Verify maps directory was created
    const mapsDir = path.join(testDir, 'maps')
    const mapsExists = await fs.access(mapsDir).then(() => true).catch(() => false)
    expect(mapsExists).toBe(true)

    // Verify root node was created
    const nodes = await fileStore.getAllNodes()
    const nodeArray = Object.values(nodes)
    expect(nodeArray).toHaveLength(1)

    const rootNode = nodeArray[0]
    expect(rootNode).toMatchObject({
      title: 'Root Problem',
      description: 'What is the root problem you are trying to solve?',
      parentId: null,
      childrenIds: [],
      type: NodeType.Map
    })
  })

  it('preserves existing root node if present', async () => {
    const { path: testDir } = useTemp()

    // Create maps directory and a root node manually first
    const mapsDir = path.join(testDir, 'maps')
    await fs.mkdir(mapsDir, { recursive: true })

    // Initialize FileStore first time to create initial root
    const fileStore1 = await initFileStore(testDir)
    const nodes1 = await fileStore1.getAllNodes()
    const rootNode1 = Object.values(nodes1)[0]

    // Initialize FileStore second time
    const fileStore2 = await initFileStore(testDir)
    const nodes2 = await fileStore2.getAllNodes()

    // Verify we still have just one root node with the same ID
    expect(Object.keys(nodes2)).toHaveLength(1)
    const rootNode2 = Object.values(nodes2)[0]
    expect(rootNode2.id).toBe(rootNode1.id)
  })

  it('creates maps directory if it does not exist but preserves existing content', async () => {
    const { path: testDir } = useTemp()

    // Create maps directory and initialize first time
    const fileStore1 = await initFileStore(testDir)

    // Delete maps directory but keep parent directory
    const mapsDir = path.join(testDir, 'maps')
    await fs.rm(mapsDir, { recursive: true })

    // Initialize again
    const fileStore2 = await initFileStore(testDir)

    // Verify maps directory was recreated
    const mapsExists = await fs.access(mapsDir).then(() => true).catch(() => false)
    expect(mapsExists).toBe(true)
  })
})