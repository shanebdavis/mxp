#!/usr/bin/env node

import { main } from '../dist/mxp.js'

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})