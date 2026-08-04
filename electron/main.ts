import { app, BrowserWindow, ipcMain, shell, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { ExifTool } from 'exiftool-vendored';

const isDev = !app.isPackaged;
const appIcon = path.join(__dirname, '../build/icon.ico');

// Initialize ExifTool — one instance shared for the app's lifetime
const exiftool = new ExifTool({ taskTimeoutMillis: 30000 });

// On packaged builds, ExifTool binary is placed in resources/exiftool/
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
        icon: appIcon,
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,
        },
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// IPC: read-metadata
// Returns a flat key→value record of all readable tags for a given file path.
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('read-metadata', async (_event, filePath: string) => {
    try {
        const tags = await exiftool.read(filePath);

        // Flatten the ExifTool tags object into a simple Record<string, string>
        const result: Record<string, string> = {};
        const SKIP_KEYS = new Set(['SourceFile', 'errors', 'warnings', 'ExifToolVersion']);

        for (const [key, value] of Object.entries(tags)) {
            if (SKIP_KEYS.has(key)) continue;
            if (value === null || value === undefined) continue;

            if (typeof value === 'object' && !Array.isArray(value)) {
                // Handle ExifDateTime and similar objects that have a toString
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

// ─────────────────────────────────────────────────────────────────────────────
// IPC: write-metadata
// Copies the original file to outputDir, then writes the new tags in-place
// on the copy.  The original file is NEVER modified.
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('write-metadata', async (_event, filePath: string, outputDir: string, metadata: Record<string, string>) => {
    try {
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase().slice(1);

        // Build a unique destination path so we never silently overwrite
        const baseName = path.basename(fileName, path.extname(fileName));
        const timestamp = Date.now();
        const destFileName = `${baseName}_metadata_${timestamp}.${ext}`;
        const destPath = path.join(outputDir, destFileName);

        // 1. Copy original file to destination
        fs.copyFileSync(filePath, destPath);

        // 2. Write metadata tags on the copy
        const tagsToWrite: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            // Skip read-only / structural tags that ExifTool won't let us override
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

// ─────────────────────────────────────────────────────────────────────────────
// IPC helpers
// ─────────────────────────────────────────────────────────────────────────────
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
