import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../shared/awsClients.js";
import { config } from "../shared/config.js";
import { jsonResponse } from "../shared/response.js";

const documentClient = DynamoDBDocumentClient.from(dynamoClient);

export async function handler(event) {
  try {
    const query = event.queryStringParameters || {};
    const searchTerm = (query.search || "").toLowerCase();
    const minScore = Number(query.minScore || 0);

    const result = await documentClient.send(
      new ScanCommand({
        TableName: config.tableName
      })
    );

    const candidates = (result.Items || [])
      .filter((candidate) => {
        if (candidate.score < minScore) {
          return false;
        }

        if (!searchTerm) {
          return true;
        }

        const searchableText = `${candidate.name} ${(candidate.skills || []).join(" ")} ${candidate.experience}`.toLowerCase();
        return searchableText.includes(searchTerm);
      })
      .sort((left, right) => right.score - left.score)
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1
      }));

    return jsonResponse(200, {
      count: candidates.length,
      candidates
    });
  } catch (error) {
    console.error("getCandidates error", error);
    return jsonResponse(500, {
      message: "Failed to fetch candidates"
    });
  }
}
