import {
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "node:https";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function createR2Client(): S3Client {
  const accountId = env.R2_ACCOUNT_ID;
  const endpoint = env.R2_S3_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  const requestHandler = new NodeHttpHandler({
    connectionTimeout: env.R2_CONNECT_TIMEOUT_MS,
    requestTimeout: env.R2_REQUEST_TIMEOUT_MS,
    httpsAgent: new HttpsAgent({
      keepAlive: true,
      maxSockets: 50,
    }),
  });

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID || "mock-access-key",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || "mock-secret-key",
    },
    maxAttempts: env.R2_MAX_ATTEMPTS,
    requestHandler,
  });
}

export const r2Client = createR2Client();

export async function testR2Connection(client: S3Client = r2Client, bucketName: string = env.R2_BUCKET_NAME): Promise<boolean> {
  // If in test or development without R2 credentials, skip or log cleanly
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    logger.warn("[R2Client] R2 credentials not provided in environment. Storage operations will run in mock mode.");
    return true;
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (err) {
    logger.error(`[R2Client] HeadBucket failed for bucket "${bucketName}"`, { error: err });
    return false;
  }
}
