import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface TempDirOptions {
  /** Prefix for the temp directory name. Defaults to 'test-' */
  prefix?: string
  /** Whether to keep the directory after tests (for debugging). Defaults to false */
  preserve?: boolean
  /** Base directory to create temp dirs in. Defaults to os.tmpdir() */
  baseDir?: string
}

export interface TempDir {
  /** Absolute path to the temporary directory */
  path: string
  /** Clean up the temporary directory */
  cleanup: () => Promise<void>
}

/**
 * Creates a temporary directory for tests
 * @returns Object with path and cleanup function
 */
export const createTempDir = async (options: TempDirOptions = {}): Promise<TempDir> => {
  const {
    prefix = 'test-',
    preserve = false,
    baseDir = os.tmpdir()
  } = options

  const uniqueSuffix = Math.random().toString(36).slice(2)
  const tempPath = path.join(baseDir, `${prefix}${uniqueSuffix}`)

  await fs.mkdir(tempPath, { recursive: true })

  return {
    path: tempPath,
    cleanup: async () => {
      if (!preserve) {
        try {
          await fs.rm(tempPath, { recursive: true, force: true })
        } catch (error) {
          console.warn(`Failed to clean up temp directory ${tempPath}:`, error)
        }
      }
    }
  }
}

/**
 * Use in beforeEach/afterEach to manage a temp directory for each test
 * @example
 * ```ts
 * describe('MyTests', () => {
 *   const { useTemp } = useTempDir()
 *
 *   it('my test', () => {
 *     const tempDir = useTemp()
 *     // use tempDir.path
 *   })
 * })
 * ```
 */
export const useTempDir = (options: TempDirOptions = {}) => {
  let currentTemp: TempDir | null = null

  beforeEach(async () => {
    currentTemp = await createTempDir(options)
  })

  afterEach(async () => {
    if (currentTemp) {
      await currentTemp.cleanup()
      currentTemp = null
    }
  })

  return {
    useTemp: () => {
      if (!currentTemp) throw new Error('No temp directory available. Did you forget to call useTempDir()?')
      return currentTemp
    }
  }
}

/**
 * Creates a temp directory for an entire test suite
 * @example
 * ```ts
 * describe('MyTests', () => {
 *   const { tempDir } = useSuiteTempDir()
 *
 *   it('test1', () => {
 *     // use tempDir.path
 *   })
 *
 *   it('test2', () => {
 *     // same tempDir.path
 *   })
 * })
 * ```
 */
export const useSuiteTempDir = (options: TempDirOptions = {}) => {
  let tempDir: TempDir

  beforeAll(async () => {
    tempDir = await createTempDir(options)
  })

  afterAll(async () => {
    await tempDir.cleanup()
  })

  return { tempDir: () => tempDir }
}