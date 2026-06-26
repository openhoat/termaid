import { ipcMain } from 'electron'
import { contextService } from '../services/contextService'

export function createContextHandlers(): void {
  ipcMain.handle('context:get', async (_event, recentCommands?: string[]) => {
    return contextService.getContext(recentCommands)
  })

  ipcMain.handle('context:set-cwd', async (_event, cwd: string) => {
    contextService.setCwd(cwd)
  })

  ipcMain.handle('context:refresh', async (_event, recentCommands?: string[]) => {
    return contextService.getContext(recentCommands)
  })
}
