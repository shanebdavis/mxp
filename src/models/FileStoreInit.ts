import { createFileStore } from './FileStore'
import fs from 'fs/promises'
import path from 'path'

/**
 * Initialize the FileStore
 *
 * 1. create the "maps" directory
 * 2. initialize the FileStore object
 * 3. use the FileStore object to create the root node
 *
 * @param baseDir - The base directory for the FileStore
 */
export const initFileStore = async (baseDir: string) => {
  return createFileStore(baseDir)
}