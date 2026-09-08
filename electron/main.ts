import { app, BrowserWindow, ipcMain, shell, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { ExifTool } from 'exiftool-vendored';

const isDev = !app.isPackaged;
const appIcon = path.join(app.getAppPath(), 'build/icon.ico');
const resolvedIcon = fs.existsSync(appIcon) ? appIcon : path.join(app.getAppPath(), 'build/newlogo.png');

const exiftool = new ExifTool({ taskTimeoutMillis: 30000 });

if (!isDev) {
    const exiftoolBin = path.join(process.resourcesPath, 'exiftool', process.platform === 'win32' ? 'exiftool.exe' : 'exiftool');
    if (fs.existsSync(exiftoolBin)) {
        (exiftool as unknown as { options: { exiftoolPath: string } }).options.exiftoolPath = exiftoolBin;
    }
}

function createWindow() {
    const preloadPath = path.join(app.getAppPath(), 'dist-electron', 'preload.js');
    const mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        icon: resolvedIcon,
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,
        },
    });

    mainWindow.setMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.removeMenu();

    if (isDev) {
        mainWindow.loadURL('http://localhost:8080');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        exiftool.end();
        app.quit();
    }
});

ipcMain.handle('read-metadata', async (_event, filePath: string) => {
    try {
        const tags = await exiftool.read(filePath);
        const result: Record<string, string> = {};
        const SKIP_KEYS = new Set(['SourceFile', 'errors', 'warnings', 'ExifToolVersion']);
        for (const [key, value] of Object.entries(tags)) {
            if (SKIP_KEYS.has(key)) continue;
            if (value === null || value === undefined) continue;
            if (typeof value === 'object' && !Array.isArray(value)) {
                const str = String(value);
                if (str && str !== '[object Object]') result[key] = str;
            } else if (Array.isArray(value)) {
                result[key] = value.map(String).join(', ');
            } else {
                result[key] = String(value);
            }
        }
        return { success: true, data: result };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('read-metadata error:', error);
        return { success: false, error: message };
    }
});

ipcMain.handle('write-metadata', async (_event, filePath: string, outputDir: string, metadata: Record<string, string>) => {
    try {
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase().slice(1);
        const baseName = path.basename(fileName, path.extname(fileName));
        const timestamp = Date.now();
        const destFileName = `${baseName}_metadata_${timestamp}.${ext}`;
        const destPath = path.join(outputDir, destFileName);
        fs.copyFileSync(filePath, destPath);
        const tagsToWrite: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            const READONLY_TAGS = new Set([
                'FileSize', 'FileModifyDate', 'FileAccessDate', 'FileCreateDate',
                'FileInodeChangeDate', 'FilePermissions', 'FileType', 'FileTypeExtension',
                'MIMEType', 'ImageWidth', 'ImageHeight', 'ImageSize', 'Megapixels',
                'EncodingProcess', 'BitsPerSample', 'ColorComponents', 'YCbCrSubSampling',
                'Directory', 'FileName',
            ]);
            if (!READONLY_TAGS.has(key)) {
                tagsToWrite[key] = value;
            }
        }
        if (Object.keys(tagsToWrite).length > 0) {
            await exiftool.write(destPath, tagsToWrite as Parameters<typeof exiftool.write>[1], ['-overwrite_original']);
        }
        return { success: true, path: destPath };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('write-metadata error:', error);
        return { success: false, error: message };
    }
});

ipcMain.handle('show-in-folder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    }) as unknown as { canceled: boolean; filePaths: string[] };
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});
