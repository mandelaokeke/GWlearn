# GWLearn

GWLearn turns lecture video into a connected learning workspace: timestamped transcripts, concise summaries, study guides, flashcards, lesson plans, and AI chat grounded in the selected lecture.

This repository is a staged TypeScript and AWS rebuild of a 2024 classroom project. The goal is not to hide the prototype’s limitations—it is to demonstrate how the system evolves from a synchronous demo into a secure, observable, portfolio-ready application.

## Current stage

**Stage 2: owner-scoped upload foundation**

- Responsive portfolio and product shell in TypeScript and React.
- Student/faculty experience switch with realistic workspace states.
- Architecture and decision records for the AWS migration.
- Environment-variable contract, strict TypeScript, linting, server-render test, and CI workflow.
- Runtime-validated upload contracts, processing-state transitions, and DynamoDB key builders.
- An owner-scoped upload use case with injectable database and object-storage ports.
- Unit tests for authentication, validation, isolation, presigned-upload constraints, and failure compensation.

The interface currently uses representative data. The upload domain is implemented and tested without cloud dependencies; the next adapter commit wires it to DynamoDB, S3, Cognito, API Gateway, and TypeScript CDK.

## Target architecture

| Responsibility | AWS service |
|---|---|
| Authentication and roles | Amazon Cognito |
| Application API | Amazon API Gateway and AWS Lambda |
| Videos, transcripts, and exports | Amazon S3 |
| Metadata, workflow state, and chat history | Amazon DynamoDB |
| Long-running orchestration | AWS Step Functions Standard Workflows |
| Speech-to-text | Amazon Transcribe |
| Summaries, study tools, and grounded chat | Amazon Bedrock Converse API |
| Infrastructure as code | AWS CDK in TypeScript |

Read [the architecture overview](docs/architecture.md) and [ADR 0001](docs/adr/0001-aws-serverless-rebuild.md) for the reasoning and boundaries.

## Local development

Requirements:

- Node.js 22.13 or later
- npm 10 or later

```bash
cp .env.example .env.local
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
```

## Repository shape

```text
app/                    Product interface
docs/                   Architecture and decisions
packages/contracts/     Shared runtime validation and domain types
services/upload-api/    Cloud-independent upload application logic
tests/                  Server-rendered behavior checks
.github/workflows/      Continuous integration
```

The backend and infrastructure packages will be added when the first upload-to-processing vertical slice is implemented. That keeps the repository honest: each package arrives with working behavior and tests instead of speculative scaffolding.

## Roadmap

1. Establish the typed product foundation.
2. Add Cognito, S3, DynamoDB, API Gateway, and Lambda through TypeScript CDK.
3. Implement direct uploads and durable processing status.
4. Orchestrate Transcribe and Bedrock through Step Functions.
5. Add transcript-grounded study tools and chat with timestamp citations.
6. Complete accessibility, security, cost, and portfolio release checks.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for verification expectations and the detailed commit-message policy used throughout the rebuild.
