import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

// Export file storage configuration
const EXPORTS_DIR = '/tmp/exports';
const MANIFEST_FILE = '/tmp/exports/manifest.json';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface ExportManifestEntry {
  filename: string;
  path: string;
  createdAt: number;
}

/**
 * Initialize the exports directory
 */
async function ensureExportsDir(): Promise<void> {
  try {
    await fs.access(EXPORTS_DIR);
  } catch {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  }
}

/**
 * Load the export manifest
 */
async function loadManifest(): Promise<ExportManifestEntry[]> {
  try {
    const data = await fs.readFile(MANIFEST_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // File doesn't exist or is invalid, return empty manifest
    return [];
  }
}

/**
 * Save the export manifest
 */
async function saveManifest(manifest: ExportManifestEntry[]): Promise<void> {
  await ensureExportsDir();
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Save an export file to temporary storage
 * Returns the full file path
 */
export async function saveExportFile(buffer: Buffer, filename: string): Promise<string> {
  await ensureExportsDir();
  
  const filePath = path.join(EXPORTS_DIR, filename);
  await fs.writeFile(filePath, buffer);
  
  // Update manifest
  const manifest = await loadManifest();
  manifest.push({
    filename,
    path: filePath,
    createdAt: Date.now()
  });
  await saveManifest(manifest);
  
  return filePath;
}

/**
 * Get the file path for an export file
 */
export function getExportFilePath(filename: string): string {
  return path.join(EXPORTS_DIR, filename);
}

/**
 * Clean up expired export files (older than TTL)
 * Returns the number of files deleted
 */
export async function cleanupExpiredExports(): Promise<{ deleted: number; errors: string[] }> {
  const manifest = await loadManifest();
  const now = Date.now();
  const errors: string[] = [];
  let deleted = 0;
  
  const remainingEntries: ExportManifestEntry[] = [];
  
  for (const entry of manifest) {
    const age = now - entry.createdAt;
    
    if (age > TTL_MS) {
      // File is expired, delete it
      try {
        await fs.unlink(entry.path);
        deleted++;
        logger.debug({ filename: entry.filename, age }, 'Export file deleted');
      } catch (error) {
        // File might already be deleted or inaccessible
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode !== 'ENOENT') {
          // Only log if it's NOT a "file not found" error
          logger.warn({ error, filename: entry.filename }, '...to delete export file');
          errors.push(`Failed to delete ${entry.filename}: ${error}`);
        }
      }
    } else {
      // File is still valid, keep in manifest
      remainingEntries.push(entry);
    }
  }
  
  // Save updated manifest
  await saveManifest(remainingEntries);
  
  return { deleted, errors };
}

/**
 * Delete a specific export file
 */
export async function deleteExportFile(filename: string): Promise<void> {
  const filePath = path.join(EXPORTS_DIR, filename);
  
  try {
    await fs.unlink(filePath);
    logger.debug({ filename }, 'Export file deleted');
  } catch (error) {
    // Only log if it's NOT a "file not found" error
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode !== 'ENOENT') {
      logger.warn({ error, filename }, 'Failed to delete export file');
    }
  }
  
  // Update manifest
  const manifest = await loadManifest();
  const updatedManifest = manifest.filter(entry => entry.filename !== filename);
  await saveManifest(updatedManifest);
}
