import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient, s3Client } from "../shared/awsClients.js";
import { config } from "../shared/config.js";
import { jsonResponse } from "../shared/response.js";

const documentClient = DynamoDBDocumentClient.from(dynamoClient);

function parseS3Url(url) {
  const match = url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  return {
    bucket: match[1],
    key: match[2]
  };
}

export async function handler(event) {
  try {
    const candidateId = event.pathParameters?.id;
    if (!candidateId) {
      return jsonResponse(400, { message: "Candidate id is required" });
    }

    const existing = await documentClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: { id: candidateId }
      })
    );

    if (!existing.Item) {
      return jsonResponse(404, { message: "Candidate not found" });
    }

    const location = parseS3Url(existing.Item.resumeUrl);
    if (location) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: location.bucket,
          Key: location.key
        })
      );
    }

    await documentClient.send(
      new DeleteCommand({
        TableName: config.tableName,
        Key: { id: candidateId }
      })
    );

    return jsonResponse(200, {
      message: "Candidate deleted successfully"
    });
  } catch (error) {
    console.error("deleteCandidate error", error);
    return jsonResponse(500, {
      message: "Failed to delete candidate"
    });
  }
}
