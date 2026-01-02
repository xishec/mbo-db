import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '../src/assets/wbg-icon.svg');
const publicDir = path.join(__dirname, '../public');

// Read the SVG file
const svgContent = fs.readFileSync(svgPath, 'utf-8');

// Generate PNG files at different sizes
async function generatePNGs() {
  // Create 1024x1024 PNG
  await sharp(Buffer.from(svgContent))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(publicDir, 'icon-1024.png'));
  
  console.log('✓ Generated icon-1024.png');

  // Create 256x256 PNG
  await sharp(Buffer.from(svgContent))
    .resize(256, 256)
    .png()
    .toFile(path.join(publicDir, 'icon-256.png'));
  
  console.log('✓ Generated icon-256.png');

  // Copy the SVG to public directory
  fs.copyFileSync(svgPath, path.join(publicDir, 'icon-1024.svg'));
  console.log('✓ Copied icon-1024.svg');
}

generatePNGs().catch(console.error);
