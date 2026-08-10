import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import toml from 'toml'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('No TOML files were provided.')
  process.exit(2)
}

let failed = false
for (const file of files) {
  try {
    const parsed = toml.parse(fs.readFileSync(file, 'utf8'))
    const normalized = file.replaceAll('\\', '/')
    if (normalized.endsWith('/.codex/config.toml')) {
      if (parsed.agents?.enabled !== true) throw new Error('agents.enabled must be true')
      if (!Number.isInteger(parsed.agents?.max_concurrent_threads_per_session) || parsed.agents.max_concurrent_threads_per_session < 1) {
        throw new Error('agents.max_concurrent_threads_per_session must be a positive integer')
      }
      if (typeof parsed.agents?.interrupt_message !== 'boolean') throw new Error('agents.interrupt_message must be boolean')
    } else if (normalized.includes('/.codex/agents/')) {
      for (const key of ['name', 'description', 'developer_instructions']) {
        if (typeof parsed[key] !== 'string' || parsed[key].trim() === '') throw new Error(`${key} must be a non-empty string`)
      }
      if (!['read-only', 'workspace-write'].includes(parsed.sandbox_mode)) {
        throw new Error('sandbox_mode must be read-only or workspace-write')
      }
      const fileName = path.basename(file, '.toml').replaceAll('-', '_')
      if (parsed.name !== fileName) throw new Error(`name must match file name: expected ${fileName}`)
    }
  } catch (error) {
    failed = true
    console.error(`${file}: ${error.message}`)
  }
}

if (failed) process.exit(1)
console.log(`TOML validation passed: ${files.length} files.`)
