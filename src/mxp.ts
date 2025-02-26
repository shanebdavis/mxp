import fs from 'fs/promises'
import path from 'path'
import { startServer } from './server.js'
import { FileStore } from './models/FileStore.js'
import { execSync } from 'child_process'
import { createInterface } from 'readline'
import { initFileStore } from './models/FileStoreInit.js'

const isGitRepo = (dir: string) => {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const askQuestion = async (query: string): Promise<string> => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

export const main = async (startDir: string = process.cwd()) => {
  // Check if expedition directory exists
  const expeditionDir = path.join(startDir, 'expedition')

  try {
    await fs.access(expeditionDir)
  } catch {
    // Directory doesn't exist, check if we're in a git repo
    const isGit = isGitRepo(startDir)
    if (!isGit) {
      console.warn('Warning: MXP is intended to be used within a git repository.')
    }

    const answer = await askQuestion('expedition directory not found. Create it? (y/N) ')
    if (answer.toLowerCase() !== 'y') {
      console.log('Exiting...')
      process.exit(0)
    }

    // Create expedition directory and maps subdirectory
    await fs.mkdir(expeditionDir, { recursive: true })
  }

  // Initialize FileStore and start server
  await initFileStore(expeditionDir)

  // Start the server
  const { server } = startServer({
    storageFolder: expeditionDir,
    port: 0, // let the OS assign a port
    autoOpenInBrowser: true
  })

  return { server }
}
