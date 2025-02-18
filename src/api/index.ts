import express, { Request, Response } from 'express'
import swaggerUi from 'swagger-ui-express'
import openApiSpec from '../../openapi.json'

const router = express.Router()

// Serve Swagger UI
router.use('/docs', swaggerUi.serve)
router.get('/docs', swaggerUi.setup(openApiSpec))

// API endpoints will go here
router.get('/tree', (req: Request, res: Response) => {
  // TODO: Implement
  res.json({})
})

router.post('/nodes', (req: Request, res: Response) => {
  // TODO: Implement
  res.status(201).json({})
})

router.patch('/nodes/:nodeId', (req: Request, res: Response) => {
  // TODO: Implement
  res.json({})
})

router.delete('/nodes/:nodeId', (req: Request, res: Response) => {
  // TODO: Implement
  res.status(204).send()
})

router.put('/nodes/:nodeId/parent', (req: Request, res: Response) => {
  // TODO: Implement
  res.json({})
})

export default router