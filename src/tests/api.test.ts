import { describe, it, expect } from 'vitest'
import { useTempDir } from './helpers/tempDir'
import { startTestServer, TestServer } from './helpers/testServer'

describe('API', () => {
  const { useTemp } = useTempDir({ prefix: 'api-test-' })

  it('starts with an empty node list', async () => {
    // Setup: Create temp dir and start server
    const { path: storageFolder } = useTemp()
    const server = await startTestServer({ storageFolder })

    try {
      // Test: Get all nodes
      const response = await fetch(`${server.baseUrl}/api/nodes`)
      expect(response.status).toBe(200)

      const nodes = await response.json()
      expect(nodes).toEqual({})
    } finally {
      // Cleanup: Stop server
      await server.stop()
    }
  })
})