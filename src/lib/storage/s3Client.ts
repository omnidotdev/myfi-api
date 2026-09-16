import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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
        // Path-style addressing works against both S3 and S3-compatible
        // gateways (Garage) without per-bucket DNS
        forcePathStyle: true,
        ...(ENDPOINT ? { endpoint: ENDPOINT } : {}),
        credentials: {
          accessKeyId: ACCESS_KEY_ID,
          secretAccessKey: SECRET_ACCESS_KEY,
        },
      })
    : null;

/**
 * Store an object. The bucket is private, so every read and write is proxied
 * through the API (never a presigned URL): the S3 endpoint is cluster-internal
 * and these are financial records that must stay behind book-level auth.
 */
export const putObject = async (
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    }),
  );
};

/** Fetch an object as a web stream for API-proxied download (no full buffering). */
export const getObject = async (
  key: string,
): Promise<{
  body: ReadableStream;
  contentType?: string;
  contentLength?: number;
}> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  const result = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );

  if (!result.Body) throw new Error("Object has no body");

  return {
    body: result.Body.transformToWebStream(),
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
};

export const deleteObject = async (key: string): Promise<void> => {
  if (!client || !BUCKET) throw new Error("Storage not configured");

  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const isStorageConfigured = () => client !== null;
