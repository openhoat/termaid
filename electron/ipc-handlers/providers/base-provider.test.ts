import type { SystemContext } from '@shared/types'
import { describe, expect, test } from 'vitest'
import { extractRecentCommands, formatContextBlock } from './base-provider'

describe('extractRecentCommands', () => {
  test('should return empty array for undefined history', () => {
    expect(extractRecentCommands(undefined)).toEqual([])
  })

  test('should return empty array for empty history', () => {
    expect(extractRecentCommands([])).toEqual([])
  })

  test('should extract command from assistant messages with command', () => {
    const history = [
      { role: 'user' as const, content: 'list files', timestamp: new Date() },
      { role: 'assistant' as const, content: '', command: 'ls -la', timestamp: new Date() },
    ]
    expect(extractRecentCommands(history)).toEqual(['ls -la'])
  })

  test('should skip assistant messages without command', () => {
    const history = [
      { role: 'assistant' as const, content: 'Hello', timestamp: new Date() },
      {
        role: 'assistant' as const,
        content: '',
        command: 'find . -name "*.ts"',
        timestamp: new Date(),
      },
    ]
    expect(extractRecentCommands(history)).toEqual(['find . -name "*.ts"'])
  })

  test('should return at most 5 recent commands', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: 'assistant' as const,
      content: '',
      command: `cmd-${i}`,
      timestamp: new Date(),
    }))
    expect(extractRecentCommands(history)).toHaveLength(5)
    expect(extractRecentCommands(history)).toEqual(['cmd-3', 'cmd-4', 'cmd-5', 'cmd-6', 'cmd-7'])
  })
})

describe('formatContextBlock', () => {
  const baseContext: SystemContext = {
    cwd: '/home/user/project',
    os: {
      platform: 'linux',
      distro: 'Ubuntu',
      release: '22.04',
      arch: 'x64',
      hostname: 'my-machine',
    },
    shell: '/bin/bash',
    git: {
      isRepo: false,
    },
    projectType: 'node',
    projectFiles: ['package.json', 'tsconfig.json'],
    hasDocker: true,
    recentCommands: [],
  }

  test('should include working directory', () => {
    const block = formatContextBlock(baseContext)
    expect(block).toContain('/home/user/project')
  })

  test('should include OS info with distro', () => {
    const block = formatContextBlock(baseContext)
    expect(block).toContain('linux (Ubuntu)')
    expect(block).toContain('22.04')
    expect(block).toContain('x64')
  })

  test('should include hostname and shell', () => {
    const block = formatContextBlock(baseContext)
    expect(block).toContain('my-machine')
    expect(block).toContain('/bin/bash')
  })

  test('should indicate non-git repository', () => {
    const block = formatContextBlock(baseContext)
    expect(block).toContain('not a git repository')
  })

  test('should include git info when in a repo', () => {
    const context: SystemContext = {
      ...baseContext,
      git: {
        isRepo: true,
        branch: 'main',
        status: '',
      },
    }
    const block = formatContextBlock(context)
    expect(block).toContain('Git:')
    expect(block).toContain('main')
    expect(block).toContain('clean working tree')
  })

  test('should include modified files count in git status', () => {
    const context: SystemContext = {
      ...baseContext,
      git: {
        isRepo: true,
        branch: 'feature',
        status: 'M src/index.ts\nA src/new.ts',
      },
    }
    const block = formatContextBlock(context)
    expect(block).toContain('2 file(s) modified')
  })

  test('should include project type and detected files', () => {
    const block = formatContextBlock(baseContext)
    expect(block).toContain('Project type: node')
    expect(block).toContain('package.json, tsconfig.json')
  })

  test('should indicate Docker availability', () => {
    const block = formatContextBlock(baseContext)
    expect(block).toContain('Docker: available')
  })

  test('should indicate Docker not available', () => {
    const context: SystemContext = { ...baseContext, hasDocker: false }
    const block = formatContextBlock(context)
    expect(block).toContain('Docker: not available')
  })

  test('should include recent commands when present', () => {
    const context: SystemContext = {
      ...baseContext,
      recentCommands: ['ls -la', 'cat package.json'],
    }
    const block = formatContextBlock(context)
    expect(block).toContain('ls -la')
    expect(block).toContain('cat package.json')
  })

  test('should omit recent commands section when empty', () => {
    const block = formatContextBlock(baseContext)
    expect(block).not.toContain('Recent commands:')
  })

  test('should format OS info without distro gracefully', () => {
    const context: SystemContext = {
      ...baseContext,
      os: {
        platform: 'darwin',
        distro: undefined,
        release: '24.0',
        arch: 'arm64',
        hostname: 'mbp',
      },
    }
    const block = formatContextBlock(context)
    expect(block).toContain('darwin')
    expect(block).toContain('24.0')
    expect(block).toContain('arm64')
  })
})
