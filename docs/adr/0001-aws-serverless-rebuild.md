# ADR 0001: Rebuild GWLearn on a TypeScript AWS serverless architecture

- **Status:** Accepted
- **Date:** 2026-07-15

## Context

The original prototype connected browser JavaScript, Node.js, FFmpeg, OpenAI/Whisper, Azure Blob Storage, Cosmos DB, and cloud containers. The project report records CORS and permission troubleshooting, dependency failures, provider-credit exhaustion, slow transcription, and difficult cloud deployment. The original public deployment is no longer available.

The portfolio rebuild needs a reliable media pipeline, explicit data ownership, visible processing state, bounded AI usage, and infrastructure that can be recreated from source.

## Decision

Use TypeScript across the interface, API, shared contracts, tests, and AWS CDK infrastructure.

- S3 stores video and large generated objects.
- DynamoDB stores metadata and workflow state.
- Amazon Transcribe performs batch speech-to-text from S3 media.
- Amazon Bedrock Converse generates learning artifacts and transcript-grounded chat.
- Step Functions Standard Workflows orchestrate long-running processing.
- Cognito authenticates users and carries student/faculty roles.
- API Gateway and Lambda expose owner-scoped application operations.

Migrate in vertical slices. Preserve a usable interface while replacing one end-to-end capability at a time.

## Consequences

Positive:

- Long-running work is durable, observable, and recoverable.
- Large media bypasses the application API.
- Identity and authorization are enforced server-side.
- Infrastructure and application contracts can be tested in TypeScript.
- Bedrock model selection can change behind the Converse API boundary.

Tradeoffs:

- The system uses more managed services and requires careful IAM design.
- DynamoDB schema design must follow known access patterns.
- Local integration testing needs service emulators or deployed development resources.
- Asynchronous state introduces more interface states than a single synchronous request.

## Rejected alternatives

**Only replace Cosmos DB with DynamoDB and OpenAI with Bedrock.** Rejected because it preserves the fragile synchronous processing and deployment model.

**Store videos or full transcripts in DynamoDB.** Rejected because S3 is the appropriate object boundary and DynamoDB items have size and cost constraints.

**Rewrite every page before restoring a vertical slice.** Rejected because it delays evidence that the upload, processing, and learning workflow is reliable.
