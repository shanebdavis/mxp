import express from 'express'
import swaggerUi from 'swagger-ui-express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { createApiRouter } from './src/api/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Get storage folder from environment variable or use default
const storageFolder = process.env.STORAGE_FOLDER || join(process.cwd(), 'expedition')

const app = express()
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001

app.use(cors())
app.use(express.json())

// Mount API routes
app.use('/api', createApiRouter({ storageFolder }))

// Serve Swagger UI at /api-docs to match OpenAPI spec server URL
const openApiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))
openApiSpec.servers = [{ url: '/api', description: 'Local API server' }]

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

// Redirect root to API docs when accessing the API server directly
app.get('/', (req, res) => {
  res.redirect('/api-docs')
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`API documentation available at http://localhost:${port}/api-docs`)
  console.log(`Using storage folder: ${storageFolder}`)
})