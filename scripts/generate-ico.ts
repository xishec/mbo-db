import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const iconPath = path.join(publicDir, 'icon.ico');

// Sizes to include in ICO
const sizes = [16, 32, 48, 64, 128, 256];

async function generateICO() {
  const pngBuffers: Buffer[] = [];
  
  // Generate PNG buffers for each size
  for (const size of sizes) {
    const buffer = await sharp(path.join(publicDir, 'icon-1024.png'))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(buffer);
  }

  // Manually construct ICO file
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved (must be 0)
  header.writeUInt16LE(1, 2); // Type (1 = ICO)
  header.writeUInt16LE(sizes.length, 4); // Number of images

  // Calculate total size
  const directorySize = 16 * sizes.length; // 16 bytes per directory entry
  let dataOffset = 6 + directorySize;

  // Build directory entries
  const directories: Buffer[] = [];
  const imageDataParts: Buffer[] = [];

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const pngBuffer = pngBuffers[i];

    const directory = Buffer.alloc(16);
    directory.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 means 256)
    directory.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 means 256)
    directory.writeUInt8(0, 2); // Color palette (0 = no palette)
    directory.writeUInt8(0, 3); // Reserved (must be 0)
    directory.writeUInt16LE(1, 4); // Color planes (1)
    directory.writeUInt16LE(32, 6); // Bits per pixel (32)
    directory.writeUInt32LE(pngBuffer.length, 8); // Image data size
    directory.writeUInt32LE(dataOffset, 12); // Offset to image data

    directories.push(directory);
    imageDataParts.push(pngBuffer);
    dataOffset += pngBuffer.length;
  }

  // Combine all parts
  const icoBuffer = Buffer.concat([
    header,
    ...directories,
    ...imageDataParts
  ]);

  // Write to file
  fs.writeFileSync(iconPath, icoBuffer);
  console.log('✓ Generated icon.ico');
}

generateICO().catch(console.error);
