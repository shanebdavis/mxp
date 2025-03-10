import express from 'express'
import swaggerUi from 'swagger-ui-express'
import cors from 'cors'
import { join } from 'path'
import { readFileSync, realpathSync } from 'fs'
import { createApiRouter } from './api/index.js'
import path from 'path'
import open from 'open'
interface ServerOptions {
  port?: number
  storageFolder?: string
  autoOpenInBrowser?: boolean
}

// use process.args to determine the source directory
// resolve symlinks on process.arv[1] first
const START_SCRIPT = realpathSync(process.argv[1])
const PACKAGE_ROOT = path.join(START_SCRIPT, '..')

const loadOpenApiSpec = () => {
  const openApiSpec = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'openapi.json'), 'utf8'))
  openApiSpec.servers = [{ url: '/api', description: 'Local API server' }]
  return openApiSpec
}

export const startServer = async ({
  port = process.env.PORT != null ? parseInt(process.env.PORT) : 3001,
  storageFolder = process.env.STORAGE_FOLDER || join(process.cwd(), 'expedition'),
  autoOpenInBrowser = false
}: ServerOptions = {}) => {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.use('/images', express.static(join(storageFolder, 'images')))

  app.use('/api', await createApiRouter({ storageFolder }))

  // Serve Swagger UI at /api-docs to match OpenAPI spec server URL
  const openApiSpec = loadOpenApiSpec()

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

  // Always serve Vite static assets from the 'dist' folder
  const dist = path.join(PACKAGE_ROOT, 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))

  const server = app.listen(port, () => {
    const actualPort = (server.address() as { port: number }).port
    console.log(`Server running at http://localhost:${actualPort}`)
    console.log(`API documentation available at http://localhost:${actualPort}/api-docs`)
    console.log(`Using storage folder: ${storageFolder}`)
    if (autoOpenInBrowser) {
      open(`http://localhost:${actualPort}`)
    }
  })

  return { app, server }
}
