import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { OsInfo, ProjectType, SystemContext } from '@shared/types'
import { Logger } from '../utils/logger'

const execAsync = promisify(exec)

const logger = new Logger('ContextService')

const PROJECT_DETECTORS: Array<{ file: string; type: ProjectType }> = [
  { file: 'package.json', type: 'node' },
  { file: 'requirements.txt', type: 'python' },
  { file: 'pyproject.toml', type: 'python' },
  { file: 'Cargo.toml', type: 'rust' },
  { file: 'go.mod', type: 'go' },
  { file: 'Dockerfile', type: 'docker' },
  { file: 'compose.yaml', type: 'docker' },
  { file: 'docker-compose.yml', type: 'docker' },
]

export interface ContextServiceOptions {
  osModule?: typeof os
  fsModule?: typeof fs
  execFn?: (command: string) => Promise<{ stdout: string; stderr: string }>
  cwd?: string
}

export class ContextService {
  #osModule: typeof os
  #fsModule: typeof fs
  #execFn: (command: string) => Promise<{ stdout: string; stderr: string }>
  #cwd: string
  #osInfo: OsInfo | null = null
  #shell: string | null = null
  #projectCache: { projectType: ProjectType; projectFiles: string[] } | null = null
  #hasDocker: boolean | null = null

  constructor(options: ContextServiceOptions = {}) {
    this.#osModule = options.osModule ?? os
    this.#fsModule = options.fsModule ?? fs
    this.#execFn = options.execFn ?? (cmd => execAsync(cmd, { timeout: 3000 }))
    this.#cwd = options.cwd ?? process.cwd()
  }

  getOsInfo(): OsInfo {
    if (this.#osInfo) {
      return this.#osInfo
    }

    const platform = this.#osModule.platform()
    const release = this.#osModule.release()
    const arch = this.#osModule.arch()
    const hostname = this.#osModule.hostname()

    let distro: string | undefined
    if (platform === 'linux') {
      distro = this.#detectLinuxDistro()
    }

    this.#osInfo = { platform, distro, release, arch, hostname }
    return this.#osInfo
  }

  #detectLinuxDistro(): string | undefined {
    try {
      const content = this.#fsModule.readFileSync('/etc/os-release', 'utf-8')
      const idMatch = content.match(/^ID=(.+)$/m)
      const versionMatch = content.match(/^VERSION_ID=(.+)$/m)
      if (idMatch) {
        const id = idMatch[1].replace(/"/g, '')
        const version = versionMatch ? versionMatch[1].replace(/"/g, '') : ''
        return version ? `${id} ${version}` : id
      }
    } catch {
      logger.debug('Could not read /etc/os-release')
    }
    return undefined
  }

  getShell(): string {
    if (this.#shell) {
      return this.#shell
    }
    this.#shell = this.#osModule.userInfo().shell || '/bin/sh'
    return this.#shell
  }

  setCwd(dir: string): void {
    this.#cwd = dir
    this.#projectCache = null
  }

  async getGitInfo(): Promise<{ isRepo: boolean; branch?: string; status?: string }> {
    try {
      const { stdout: toplevel } = await this.#execFn('git rev-parse --show-toplevel 2>/dev/null')
      if (!toplevel.trim()) {
        return { isRepo: false }
      }

      const { stdout: branch } = await this.#execFn('git branch --show-current 2>/dev/null')
      const { stdout: status } = await this.#execFn('git status --porcelain 2>/dev/null')

      return {
        isRepo: true,
        branch: branch.trim() || undefined,
        status: status.trim() ? status.trim() : undefined,
      }
    } catch {
      return { isRepo: false }
    }
  }

  async detectDockerAvailability(): Promise<boolean> {
    if (this.#hasDocker !== null) return this.#hasDocker
    try {
      const { stdout } = await this.#execFn('docker info --format "{{.ServerVersion}}" 2>/dev/null')
      this.#hasDocker = stdout.trim().length > 0
      return this.#hasDocker
    } catch {
      this.#hasDocker = false
      return false
    }
  }

  detectProjectType(dir: string): { projectType: ProjectType; projectFiles: string[] } {
    if (this.#projectCache) return this.#projectCache

    const found: string[] = []
    for (const { file: fileName } of PROJECT_DETECTORS) {
      const filePath = path.join(dir, fileName)
      if (this.#fsModule.existsSync(filePath)) {
        found.push(fileName)
      }
    }

    const types = PROJECT_DETECTORS.filter(d => found.includes(d.file))
    const uniqueTypes = [...new Set(types.map(t => t.type))]

    this.#projectCache = {
      projectType: uniqueTypes[0] || 'generic',
      projectFiles: found,
    }
    return this.#projectCache
  }

  async getContext(recentCommands: string[] = []): Promise<SystemContext> {
    const osInfo = this.getOsInfo()
    const shell = this.getShell()
    const git = await this.getGitInfo()
    const { projectType, projectFiles } = this.detectProjectType(this.#cwd)
    const hasDocker = await this.detectDockerAvailability()

    return {
      cwd: this.#cwd,
      os: osInfo,
      shell,
      git,
      projectType,
      projectFiles,
      hasDocker,
      recentCommands,
    }
  }
}

export const contextService = new ContextService()
