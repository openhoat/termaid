import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ContextService } from './contextService'

function createMockOs(overrides: Record<string, unknown> = {}) {
  return {
    platform: vi.fn(() => 'linux'),
    release: vi.fn(() => '6.8.0-45-generic'),
    arch: vi.fn(() => 'x64'),
    hostname: vi.fn(() => 'host-42'),
    userInfo: vi.fn(() => ({ shell: '/bin/zsh', username: 'alice' })),
    ...overrides,
  }
}

function createMockFs(overrides: Record<string, unknown> = {}) {
  return {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    ...overrides,
  }
}

function createMockExec(result: { stdout?: string; stderr?: string } = {}) {
  return vi.fn(async () => ({
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }))
}

describe('ContextService', () => {
  let mockOs: ReturnType<typeof createMockOs>
  let mockFs: ReturnType<typeof createMockFs>
  let mockExec: ReturnType<typeof createMockExec>

  const createService = (
    overrides: { os?: typeof mockOs; fs?: typeof mockFs; exec?: typeof mockExec; cwd?: string } = {}
  ) =>
    new ContextService({
      osModule: overrides.os ?? (mockOs as unknown as typeof import('node:os')),
      fsModule: overrides.fs ?? (mockFs as unknown as typeof import('node:fs')),
      execFn: overrides.exec ?? mockExec,
      cwd: overrides.cwd ?? '/home/alice/projects/my-app',
    })

  beforeEach(() => {
    mockOs = createMockOs()
    mockFs = createMockFs()
    mockExec = createMockExec()
  })

  describe('getOsInfo', () => {
    test('should return OS information from os module', () => {
      const service = createService()
      const info = service.getOsInfo()

      expect(info).toEqual({
        platform: 'linux',
        distro: undefined,
        release: '6.8.0-45-generic',
        arch: 'x64',
        hostname: 'host-42',
      })
      expect(mockOs.platform).toHaveBeenCalledOnce()
    })

    test('should detect Linux distro from /etc/os-release', () => {
      mockFs = createMockFs({
        readFileSync: vi.fn(() => 'ID=fedora\nVERSION_ID="40"\n'),
      })
      const service = createService()

      const info = service.getOsInfo()

      expect(info.distro).toBe('fedora 40')
    })

    test('should detect Linux distro without version', () => {
      mockFs = createMockFs({
        readFileSync: vi.fn(() => 'ID=arch\n'),
      })
      const service = createService()

      const info = service.getOsInfo()

      expect(info.distro).toBe('arch')
    })

    test('should handle missing /etc/os-release gracefully', () => {
      mockFs = createMockFs({
        readFileSync: vi.fn(() => {
          throw new Error('ENOENT')
        }),
      })
      const service = createService()

      const info = service.getOsInfo()

      expect(info.distro).toBeUndefined()
    })

    test('should handle macOS platform without distro', () => {
      mockOs = createMockOs({ platform: vi.fn(() => 'darwin') })
      const service = createService()

      const info = service.getOsInfo()

      expect(info.platform).toBe('darwin')
      expect(info.distro).toBeUndefined()
    })

    test('should cache OS info after first call', () => {
      mockOs = createMockOs()
      const service = createService()

      const first = service.getOsInfo()
      const second = service.getOsInfo()

      expect(second).toBe(first)
      expect(mockOs.platform).toHaveBeenCalledTimes(1)
    })
  })

  describe('getShell', () => {
    test('should return shell from userInfo', () => {
      mockOs = createMockOs()
      const service = createService()

      const shell = service.getShell()

      expect(shell).toBe('/bin/zsh')
      expect(mockOs.userInfo).toHaveBeenCalledOnce()
    })

    test('should fallback to /bin/sh when userInfo has no shell', () => {
      mockOs = createMockOs({ userInfo: vi.fn(() => ({ shell: '', username: 'bob' })) })
      const service = createService()

      const shell = service.getShell()

      expect(shell).toBe('/bin/sh')
    })

    test('should cache shell after first call', () => {
      mockOs = createMockOs()
      const service = createService()

      service.getShell()
      service.getShell()

      expect(mockOs.userInfo).toHaveBeenCalledTimes(1)
    })
  })

  describe('getGitInfo', () => {
    test('should return git branch and status when in a repo', async () => {
      mockExec = createMockExec()
      mockExec
        .mockResolvedValueOnce({ stdout: '/home/alice/projects/my-app\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: ' M package.json\n', stderr: '' })

      const service = createService()
      const git = await service.getGitInfo()

      expect(git).toEqual({
        isRepo: true,
        branch: 'main',
        status: 'M package.json',
      })
    })

    test('should return isRepo false when not in a git repo', async () => {
      mockExec = createMockExec()
      mockExec.mockRejectedValueOnce(new Error('fatal: not a git repository'))

      const service = createService()
      const git = await service.getGitInfo()

      expect(git).toEqual({ isRepo: false })
    })

    test('should handle git repo with no current branch (detached HEAD)', async () => {
      mockExec = createMockExec()
      mockExec
        .mockResolvedValueOnce({ stdout: '/repo\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })

      const service = createService()
      const git = await service.getGitInfo()

      expect(git).toEqual({ isRepo: true, branch: undefined, status: undefined })
    })

    test('should return no status when working tree is clean', async () => {
      mockExec = createMockExec()
      mockExec
        .mockResolvedValueOnce({ stdout: '/repo\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })

      const service = createService()
      const git = await service.getGitInfo()

      expect(git.status).toBeUndefined()
    })
  })

  describe('detectDockerAvailability', () => {
    test('should return true when docker is available', async () => {
      mockExec = createMockExec()
      mockExec.mockResolvedValueOnce({ stdout: '24.0.7\n', stderr: '' })

      const service = createService()
      const available = await service.detectDockerAvailability()

      expect(available).toBe(true)
    })

    test('should return false when docker is not available', async () => {
      mockExec = createMockExec()
      mockExec.mockRejectedValueOnce(new Error('command not found'))

      const service = createService()
      const available = await service.detectDockerAvailability()

      expect(available).toBe(false)
    })

    test('should return false when docker daemon is not running', async () => {
      mockExec = createMockExec()
      mockExec.mockResolvedValueOnce({ stdout: '', stderr: 'Cannot connect to Docker daemon' })

      const service = createService()
      const available = await service.detectDockerAvailability()

      expect(available).toBe(false)
    })
  })

  describe('detectProjectType', () => {
    test('should detect Node.js project from package.json', () => {
      mockFs = createMockFs({
        existsSync: vi.fn((filePath: string) => filePath.endsWith('package.json')),
      })
      const service = createService()

      const result = service.detectProjectType('/home/alice/projects/my-app')

      expect(result.projectType).toBe('node')
      expect(result.projectFiles).toEqual(['package.json'])
    })

    test('should detect Python project', () => {
      mockFs = createMockFs({
        existsSync: vi.fn((filePath: string) => filePath.endsWith('pyproject.toml')),
      })
      const service = createService()

      const result = service.detectProjectType('/home/alice/projects/my-app')

      expect(result.projectType).toBe('python')
    })

    test('should detect Rust project', () => {
      mockFs = createMockFs({
        existsSync: vi.fn((filePath: string) => filePath.endsWith('Cargo.toml')),
      })
      const service = createService()

      const result = service.detectProjectType('/home/alice/projects/my-app')

      expect(result.projectType).toBe('rust')
    })

    test('should detect Go project', () => {
      mockFs = createMockFs({
        existsSync: vi.fn((filePath: string) => filePath.endsWith('go.mod')),
      })
      const service = createService()

      const result = service.detectProjectType('/home/alice/projects/my-app')

      expect(result.projectType).toBe('go')
    })

    test('should detect Docker project', () => {
      mockFs = createMockFs({
        existsSync: vi.fn((filePath: string) => filePath.endsWith('Dockerfile')),
      })
      const service = createService()

      const result = service.detectProjectType('/home/alice/projects/my-app')

      expect(result.projectType).toBe('docker')
    })

    test('should fallback to generic when no project files found', () => {
      mockFs = createMockFs()
      const service = createService()

      const result = service.detectProjectType('/tmp/empty-dir')

      expect(result.projectType).toBe('generic')
      expect(result.projectFiles).toEqual([])
    })

    test('should return all detected project files', () => {
      mockFs = createMockFs({
        existsSync: vi.fn(
          (filePath: string) => filePath.endsWith('package.json') || filePath.endsWith('Dockerfile')
        ),
      })
      const service = createService()

      const result = service.detectProjectType('/home/alice/projects/my-app')

      expect(result.projectFiles).toContain('package.json')
      expect(result.projectFiles).toContain('Dockerfile')
    })
  })

  describe('getContext', () => {
    test('should return complete system context', async () => {
      mockOs = createMockOs()
      mockFs = createMockFs({
        readFileSync: vi.fn(() => 'ID=ubuntu\nVERSION_ID="22.04"\n'),
        existsSync: vi.fn((filePath: string) => filePath.endsWith('package.json')),
      })
      mockExec = createMockExec()
      mockExec
        .mockResolvedValueOnce({ stdout: '/home/alice/projects/my-app\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '24.0.7\n', stderr: '' })

      const service = createService()
      const context = await service.getContext(['git status', 'npm install'])

      expect(context).toEqual({
        cwd: '/home/alice/projects/my-app',
        os: {
          platform: 'linux',
          distro: 'ubuntu 22.04',
          release: '6.8.0-45-generic',
          arch: 'x64',
          hostname: 'host-42',
        },
        shell: '/bin/zsh',
        git: { isRepo: true, branch: 'main', status: undefined },
        projectType: 'node',
        projectFiles: ['package.json'],
        hasDocker: true,
        recentCommands: ['git status', 'npm install'],
      })
    })

    test('should return context without git when not in repo', async () => {
      mockExec = createMockExec()
      mockExec.mockRejectedValueOnce(new Error('not a repo'))

      const service = createService()
      const context = await service.getContext()

      expect(context.git).toEqual({ isRepo: false })
    })

    test('should return empty recent commands when none provided', async () => {
      mockExec = createMockExec()
      mockExec.mockRejectedValueOnce(new Error('not a repo'))

      const service = createService()
      const context = await service.getContext()

      expect(context.recentCommands).toEqual([])
    })

    test('should use custom cwd when provided', async () => {
      mockExec = createMockExec()
      mockExec.mockRejectedValueOnce(new Error('not a repo'))

      const service = createService({ cwd: '/var/www' })
      const context = await service.getContext()

      expect(context.cwd).toBe('/var/www')
    })
  })

  describe('setCwd', () => {
    test('should update working directory for subsequent calls', async () => {
      mockExec = createMockExec()
      mockExec.mockRejectedValue(new Error('not a repo'))

      const service = createService({ cwd: '/initial' })
      service.setCwd('/updated')

      const context = await service.getContext()
      expect(context.cwd).toBe('/updated')
    })
  })
})
