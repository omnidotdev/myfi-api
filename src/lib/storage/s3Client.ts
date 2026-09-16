import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION ?? "auto";
const ENDPOINT = process.env.S3_ENDPOINT;
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

if (!BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.warn(
    "S3_BUCKET, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY not set, attachments disabled",
  );
}

const client =
  BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY
    ? new S3Client({
        region: REGION,
        ...(ENDPOINT ? { endpoint: ENDPOINT } : {}),
        credentials: {
          accessKeyId: ACCESS_KEY_ID,
          secretAccessKey: SECRET_ACCESS_KEY,
        },
      })
    : null;

const PRESIGN_EXPIRY = 3600;

export const generateUploadUrl = async (
  key: string,
  contentType: string,
  maxBytes: number,
): Promise<string> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: maxBytes,
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY });
};

export const generateDownloadUrl = async (key: string): Promise<string> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });

  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY });
};

export const headObject = async (
  key: string,
): Promise<{ exists: boolean; contentLength?: number }> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    return { exists: true, contentLength: result.ContentLength };
  } catch {
    return { exists: false };
  }
};

export const deleteObject = async (key: string): Promise<void> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const isStorageConfigured = () => client !== null;
