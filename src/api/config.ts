import { Router } from 'express'
import { fileStore } from '../models'

export const configRouter = Router()

configRouter.get('/', (req, res) => {
  res.json(fileStore.config)
})