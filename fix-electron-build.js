import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dest = path.resolve(__dirname, 'dist-electron');
if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
}
fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2));
console.log('Created dist-electron/package.json with type: commonjs');
