import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { useTempDir } from './helpers/tempDir'
import { createFileStore } from '../models/FileStore'
import { ROOT_NODE_DEFAULT_PROPERTIES } from '../models/TreeNode'
import { log, objectKeyCount } from '../ArtStandardLib'
import { initFileStore } from '../models/FileStoreInit'

describe('FileStoreInit', () => {
  const { useTemp } = useTempDir({ prefix: 'filestore-init-test-' })

  it('creates maps directory and root node in empty directory', async () => {
    const { path: testDir } = useTemp()

    // Initialize FileStore
    const fileStore = await createFileStore(testDir)

    // Verify maps directory was created
    const mapsDir = path.join(testDir, 'maps')
    const mapsExists = await fs.access(mapsDir).then(() => true).catch(() => false)
    expect(mapsExists).toBe(true)

    // Verify root node was created
    const nodes = fileStore.allNodes
    expect(objectKeyCount(nodes)).toEqual(3)

    const rootNode = Object.values(nodes).find(node => node.title == ROOT_NODE_DEFAULT_PROPERTIES.map.title)
    expect(rootNode!).toMatchObject({
      ...ROOT_NODE_DEFAULT_PROPERTIES.map,
      parentId: null,
      childrenIds: [],
      type: "map"
    })
  })

  it('preserves existing root node if present', async () => {
    const { path: testDir } = useTemp()

    // Create maps directory and a root node manually first
    const mapsDir = path.join(testDir, 'maps')
    await fs.mkdir(mapsDir, { recursive: true })

    // Initialize FileStore first time to create initial root
    const fileStore1 = await createFileStore(testDir)
    const nodes1 = fileStore1.allNodes
    const rootNode1 = Object.values(nodes1)[0]

    // Initialize FileStore second time
    const fileStore2 = await createFileStore(testDir)
    const nodes2 = fileStore2.allNodes

    // Verify we still have just one root node with the same ID
    expect(Object.keys(nodes2)).toHaveLength(3)
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