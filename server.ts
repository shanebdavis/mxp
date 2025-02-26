import { startServer } from './src/server.js'

// Use an immediately invoked async function to handle the async startServer
(async () => {
  try {
    await startServer()
    console.log('Server started successfully')
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
})()
