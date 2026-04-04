import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { lambdaClient, s3Client } from "../shared/awsClients.js";
import { config } from "../shared/config.js";

export async function handler(event) {
  const records = event.Records || (event.detail ? [event] : []);

  for (const record of records) {
    const bucket = record.s3?.bucket?.name || record.detail?.bucket?.name;
    const rawKey = record.s3?.object?.key || record.detail?.object?.key || "";
    const key = decodeURIComponent(rawKey.replace(/\+/g, " "));

    if (!bucket || !key || !key.startsWith("resumes/")) {
      continue;
    }

    const headResult = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: config.analysisFunctionName,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({
            bucket,
            key,
            metadata: headResult.Metadata || {},
            contentType: headResult.ContentType || "application/octet-stream"
          })
        )
      })
    );
  }

  return {
    statusCode: 202,
    body: JSON.stringify({ message: "Resume queued for analysis" })
  };
}
