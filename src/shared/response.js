import { config } from "./config.js";

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": config.allowedOrigin,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST,DELETE"
    },
    body: JSON.stringify(body)
  };
}
