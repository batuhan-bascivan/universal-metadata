import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    readMetadata: (filePath: string) =>
        ipcRenderer.invoke('read-metadata', filePath),
    writeMetadata: (filePath: string, outputDir: string, metadata: Record<string, string>) =>
        ipcRenderer.invoke('write-metadata', filePath, outputDir, metadata),
    showInFolder: (filePath: string) =>
        ipcRenderer.invoke('show-in-folder', filePath),
    selectDirectory: () =>
        ipcRenderer.invoke('select-directory'),
    getFilePath: (file: File) => {
        try {
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
                return webUtils.getPathForFile(file);
            }
        } catch (e) {
            console.error('Error accessing webUtils:', e);
        }
        return (file as File & { path?: string }).path || '';
    },
});
