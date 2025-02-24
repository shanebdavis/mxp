import express from 'express'
import swaggerUi from 'swagger-ui-express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { join } from 'path'
import { readFileSync } from 'fs'
import { createApiRouter } from './api/index.js'
import path from 'path'

interface ServerOptions {
  port?: number
  storageFolder?: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PACKAGE_ROOT = path.join(__dirname, '..')

export const startServer = ({
  port = process.env.PORT ? parseInt(process.env.PORT) : 3001,
  storageFolder = process.env.STORAGE_FOLDER || join(process.cwd(), 'expedition')
}: ServerOptions = {}) => {

  const app = express()

  app.use(cors())
  app.use(express.json())

  // Mount API routes
  app.use('/api', createApiRouter({ storageFolder }))

  // Serve Swagger UI at /api-docs to match OpenAPI spec server URL
  const openApiSpec = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'openapi.json'), 'utf8'))
  openApiSpec.servers = [{ url: '/api', description: 'Local API server' }]

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

  // Always serve Vite static assets from the 'dist' folder
  const dist = path.join(PACKAGE_ROOT, 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))

  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
    console.log(`API documentation available at http://localhost:${port}/api-docs`)
    console.log(`Using storage folder: ${storageFolder}`)
  })

  return { app, server }
}
