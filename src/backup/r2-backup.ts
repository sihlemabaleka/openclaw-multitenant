/**
 * Cloudflare R2 Backup Module
 * Backs up SQLite databases to Cloudflare R2 object storage
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export interface BackupOptions {
  userId: string;
  dbPath: string;
  config: R2Config;
  metadata?: Record<string, string>;
}

export interface BackupResult {
  success: boolean;
  key?: string;
  error?: string;
  size?: number;
  uploadedAt?: Date;
}

/**
 * Upload SQLite database to Cloudflare R2
 * @param options - Backup configuration options
 * @returns Result of the backup operation
 */
export async function backupToR2(options: BackupOptions): Promise<BackupResult> {
  const { userId, dbPath, config, metadata = {} } = options;

  try {
    // Read the database file
    const fileContent = await readFile(dbPath);
    const fileSize = fileContent.byteLength;

    // Generate timestamped key
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = basename(dbPath);
    const key = `${userId}/${filename}-${timestamp}.db`;

    // Import S3Client dynamically to avoid bundling issues
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    // Create S3 client configured for Cloudflare R2
    const client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: "application/x-sqlite3",
      Metadata: {
        userId,
        originalPath: dbPath,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });

    await client.send(uploadCommand);

    const uploadedAt = new Date();
    console.log(
      `Successfully backed up ${dbPath} to R2: ${key} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
    );

    return {
      success: true,
      key,
      size: fileSize,
      uploadedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to backup ${dbPath} to R2:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Restore SQLite database from Cloudflare R2
 * @param key - R2 object key
 * @param destinationPath - Local path to restore to
 * @param config - R2 configuration
 * @returns Result of the restore operation
 */
export async function restoreFromR2(
  key: string,
  destinationPath: string,
  config: R2Config,
): Promise<BackupResult> {
  try {
    // Import S3Client dynamically
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { writeFile } = await import("node:fs/promises");

    // Create S3 client
    const client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // Download from R2
    const getCommand = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    const response = await client.send(getCommand);

    if (!response.Body) {
      throw new Error("No data returned from R2");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const fileContent = Buffer.concat(chunks);

    // Write to destination
    await writeFile(destinationPath, fileContent);

    console.log(
      `Successfully restored ${key} from R2 to ${destinationPath} (${(fileContent.byteLength / 1024 / 1024).toFixed(2)} MB)`,
    );

    return {
      success: true,
      key,
      size: fileContent.byteLength,
      uploadedAt: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to restore ${key} from R2:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * List backups for a user
 * @param userId - User ID to list backups for
 * @param config - R2 configuration
 * @returns Array of backup keys
 */
export async function listBackups(userId: string, config: R2Config): Promise<string[]> {
  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");

    const client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: `${userId}/`,
    });

    const response = await client.send(listCommand);

    return (response.Contents || []).map((obj) => obj.Key).filter((key): key is string => !!key);
  } catch (error) {
    console.error(`Failed to list backups for user ${userId}:`, error);
    return [];
  }
}

/**
 * Delete a backup from R2
 * @param key - R2 object key to delete
 * @param config - R2 configuration
 * @returns Success status
 */
export async function deleteBackup(key: string, config: R2Config): Promise<boolean> {
  try {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

    const client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    await client.send(deleteCommand);

    console.log(`Successfully deleted backup: ${key}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete backup ${key}:`, error);
    return false;
  }
}

/**
 * Delete all backups for a user
 * @param userId - User ID to delete backups for
 * @param config - R2 configuration
 * @returns Number of backups deleted
 */
export async function deleteAllUserBackups(userId: string, config: R2Config): Promise<number> {
  try {
    const backups = await listBackups(userId, config);

    let deleted = 0;
    for (const key of backups) {
      const success = await deleteBackup(key, config);
      if (success) {
        deleted++;
      }
    }

    console.log(`Deleted ${deleted}/${backups.length} backups for user ${userId}`);
    return deleted;
  } catch (error) {
    console.error(`Failed to delete backups for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Get R2 config from environment variables
 * @returns R2 configuration or null if not configured
 */
export function getR2ConfigFromEnv(): R2Config | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}
