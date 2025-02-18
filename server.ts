import express from 'express'
import swaggerUi from 'swagger-ui-express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import apiRouter from './src/api/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

// Mount API routes
app.use('/api', apiRouter)

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(
  JSON.parse(
    readFileSync(join(__dirname, 'openapi.json'), 'utf8')
  )
))

// Redirect root to API docs when accessing the API server directly
app.get('/', (req, res) => {
  res.redirect('/api-docs')
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`API documentation available at http://localhost:${port}/api-docs`)
})