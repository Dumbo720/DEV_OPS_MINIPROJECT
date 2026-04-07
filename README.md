# AI-Powered Resume Screening System using AWS Serverless Architecture

This project is a production-style serverless web application that lets recruiters upload resumes, automatically extracts candidate data, scores candidates against job requirements, and displays a ranked leaderboard.

## Project Folder Structure

```text
.
|-- docs/
|   |-- iam-policies.json
|   |-- sample-candidate-output.json
|   `-- sample-resume-input.json
|-- frontend/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- scripts/
|   `-- run-sample-tests.js
|-- src/
|   |-- functions/
|   |   |-- deleteCandidate.js
|   |   |-- extractAndAnalyzeText.js
|   |   |-- generateUploadUrl.js
|   |   |-- getCandidates.js
|   |   `-- processResume.js
|   `-- shared/
|       |-- awsClients.js
|       |-- config.js
|       |-- response.js
|       |-- resumeParser.js
|       `-- validators.js
|-- package.json
|-- README.md
`-- template.yaml
```

## Architecture Explanation

```text
Frontend -> API Gateway -> Lambda(generateUploadUrl) -> S3
S3 object created -> Lambda(processResume) -> Lambda(extractAndAnalyzeText)
Lambda(extractAndAnalyzeText) -> Textract -> Comprehend(optional) -> DynamoDB
Frontend -> API Gateway -> Lambda(getCandidates/deleteCandidate) -> DynamoDB/S3
```

### Viva Summary

- The frontend calls API Gateway to request a secure pre-signed URL.
- The browser uploads the resume directly to S3, which avoids routing large files through Lambda.
- S3 emits an event when a resume is stored.
- `processResume` receives the event and asynchronously invokes `extractAndAnalyzeText`.
- `extractAndAnalyzeText` uses Textract for OCR-based extraction, optionally enriches results with Comprehend, calculates the skill-match score, and stores structured candidate data in DynamoDB.
- The dashboard fetches ranked candidates through API Gateway.

## AWS Services Used

- Amazon S3 for secure resume storage
- AWS Lambda for upload, processing, retrieval, and delete operations
- Amazon Textract for OCR/text extraction
- Amazon DynamoDB for candidate records
- Amazon API Gateway for REST APIs
- Amazon Comprehend for optional NLP enrichment
- Amazon Cognito is recommended for recruiter authentication in production

## Features Implemented

- Upload resume through a pre-signed S3 URL
- Extract text from PDF, DOCX, PNG, JPG, and JPEG files
- Parse candidate name, skills, and experience
- Calculate score using required skills
- Show ranked candidates on a dashboard
- Search/filter candidates
- Delete candidate records and resume files

## Lambda Functions

### 1. `generateUploadUrl`

- Validates input file type
- Creates `candidateId`
- Stores required skills in S3 metadata
- Returns a 5-minute pre-signed upload URL

### 2. `processResume`

- Triggered after S3 object creation
- Reads metadata with `HeadObject`
- Asynchronously invokes the analysis function

### 3. `extractAndAnalyzeText`

- Downloads the file from S3
- Uses Textract async OCR for PDFs
- Uses Textract sync OCR for images
- Uses Mammoth to read DOCX content
- Extracts name, skills, and experience
- Computes `score = (matched_skills / required_skills) * 100`
- Stores structured JSON in DynamoDB

### 4. `getCandidates`

- Reads all candidates
- Filters by `search` and `minScore`
- Sorts by highest score
- Returns rank for leaderboard display

### 5. `deleteCandidate`

- Deletes the candidate entry from DynamoDB
- Deletes the original resume from S3

## API Gateway Endpoint Setup

The included [template.yaml](/C:/Users/aksha/Documents/New%20project/template.yaml) provisions the API automatically.

### REST Endpoints

- `POST /uploads/presign`
- `GET /candidates`
- `DELETE /candidates/{id}`

### Sample Request for Upload URL

```json
{
  "fileName": "Rahul-Sharma.pdf",
  "contentType": "application/pdf",
  "requiredSkills": ["AWS", "Node.js", "JavaScript", "Lambda", "DynamoDB"]
}
```

### Frontend `fetch()` Example

```js
const response = await fetch(`${apiBaseUrl}/uploads/presign`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fileName: "candidate.pdf",
    contentType: "application/pdf",
    requiredSkills: ["AWS", "Lambda", "Node.js"]
  })
});
```

## DynamoDB Design

### Table: `Candidates`

- `id` (Primary Key)
- `name`
- `skills` (array)
- `experience`
- `score`
- `resumeUrl`
- `uploadTime`

Additional useful attributes included in this implementation:

- `textPreview`
- `requiredSkills`
- `sourceFileName`

## Frontend

The dashboard lives in [frontend/index.html](/C:/Users/aksha/Documents/New%20project/frontend/index.html) and includes:

- Upload resume button
- API base URL input
- Required skills input
- Candidate list
- Score and ranking UI
- Search box

## Security Requirements Addressed

- S3 remains private
- Uploads use pre-signed URLs
- Inputs are validated before URL generation
- Bucket encryption is enabled
- IAM uses least-privilege examples
- Errors are returned gracefully

## IAM Role Policies

Reference policies are included in [docs/iam-policies.json](/C:/Users/aksha/Documents/New%20project/docs/iam-policies.json).

Recommended separation:

- One IAM role per Lambda function
- Textract permissions only for analysis Lambda
- DynamoDB read-only for `getCandidates`
- S3 delete permissions only for `deleteCandidate`

## Deployment Steps

### Prerequisites

1. Install AWS CLI
2. Install AWS SAM CLI
3. Install Node.js 20+
4. Configure credentials with `aws configure`

### Deploy

1. Install dependencies:

```bash
npm install
```

2. Build:

```bash
sam build
```

3. Deploy:

```bash
sam deploy --guided
```

4. Provide stack configuration:
   - Stack name: `resume-screening-system`
   - Region: `ap-south-1`
   - Allowed origin: your frontend domain
   - Default required skills: baseline recruiter keywords

5. Copy the `ApiBaseUrl` CloudFormation output into the frontend.

## Step-by-Step AWS Setup Guide

1. Create the S3 bucket and keep public access blocked.
2. Create the DynamoDB `Candidates` table.
3. Create the Lambda functions using Node.js 20.
4. Configure Lambda environment variables:
   - `RESUME_BUCKET`
   - `CANDIDATES_TABLE`
   - `ANALYSIS_FUNCTION_NAME`
   - `ALLOWED_ORIGIN`
   - `REQUIRED_SKILLS_DEFAULT`
   - `ENABLE_COMPREHEND`
5. Configure API Gateway routes.
6. Add the S3 object-created trigger to `processResume`.
7. Host the frontend on S3 static hosting, Amplify, or CloudFront.

## Sample Test Cases

1. Upload a valid PDF resume
   - Expected result: candidate stored and scored
2. Upload a DOCX resume
   - Expected result: text extracted using DOCX parser
3. Upload a `.txt` file
   - Expected result: upload URL request rejected
4. Search for `AWS`
   - Expected result: only AWS candidates appear
5. Delete a candidate
   - Expected result: candidate removed from DynamoDB and S3

Run a simple local validation test with:

```bash
npm run test:sample
```

## Example Resume Input/Output JSON

- Input: [docs/sample-resume-input.json](/C:/Users/aksha/Documents/New%20project/docs/sample-resume-input.json)
- Output: [docs/sample-candidate-output.json](/C:/Users/aksha/Documents/New%20project/docs/sample-candidate-output.json)

## Production Enhancements

- Add Amazon Cognito for authentication
- Use Step Functions for very large batch workflows
- Add CloudWatch alarms and DLQs
- Replace full table scans with access-pattern-specific GSIs
- Add per-job scoring and job description storage
- Add CloudFront and AWS WAF
Jenkins pipeline validation test.

