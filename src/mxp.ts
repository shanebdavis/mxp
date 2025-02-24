import fs from 'fs/promises'
import path from 'path'
import { startServer } from './server.js'
import { FileStore } from './models/FileStore.js'
import { execSync } from 'child_process'
import { createInterface } from 'readline'

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

const createRootProblem = async (mapsDir: string) => {
  const content = `---
id: ${crypto.randomUUID()}
title: Root Problem
filename: root-problem.md
parentId: null
childrenIds: []
calculatedMetrics:
  readinessLevel: 0
draft: false
type: map
---
# Why?

What problem are you trying to solve? What human needs are you fulfilling? Who does it impact? Why does it matter?

# Strategy

Break down your root problem into smaller, more manageable sub-problems. Each sub-problem should:
1. Have a clear connection to solving the root problem
2. Be specific and actionable
3. Be measurable in terms of progress

Remember: "All problems are solvable with enough knowledge."
`
  await fs.writeFile(path.join(mapsDir, 'root-problem.md'), content)
}

export const main = async (startDir: string = process.cwd()) => {
  // Check if expedition directory exists
  const expeditionDir = path.join(startDir, 'expedition')
  const mapsDir = path.join(expeditionDir, 'maps')

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
    await fs.mkdir(mapsDir, { recursive: true })
  }

  // Check if maps directory exists
  try {
    await fs.access(mapsDir)
  } catch {
    await fs.mkdir(mapsDir, { recursive: true })
  }

  // Check if there are any files in maps directory
  const files = await fs.readdir(mapsDir)
  if (files.length === 0) {
    await createRootProblem(mapsDir)
  }

  // Initialize FileStore and start server
  const fileStore = new FileStore(mapsDir)
  await fileStore.getAllNodes() // This will heal any issues with the files

  // Start the server
  const { server } = startServer({
    storageFolder: expeditionDir
  })

  return { server }
}
