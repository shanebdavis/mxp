import express from 'express'
import { Server } from 'http'
import { createApiRouter, ApiConfig } from '../../api'

export interface TestServer {
  /** Base URL of the server (e.g. http://localhost:3000) */
  baseUrl: string
  /** Stop the server */
  stop: () => Promise<void>
}

/**
 * Start a test server with the given configuration
 * @param config API configuration
 * @returns Server info including URL and stop function
 */
export const startTestServer = (config: ApiConfig): Promise<TestServer> => {
  const app = express()
  app.use(express.json())
  app.use('/api', createApiRouter(config))

  return new Promise((resolve) => {
    // Start server on a random port
    const server = app.listen(0, 'localhost', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to start server')
      }

      const baseUrl = `http://localhost:${address.port}`

      resolve({
        baseUrl,
        stop: () => new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      })
    })
  })
}