# GWLearn

GWLearn turns lecture video into a connected learning workspace: timestamped transcripts, concise summaries, study guides, flashcards, lesson plans, and AI chat grounded in the selected lecture.

This repository is a staged TypeScript and AWS rebuild of a 2024 classroom project. The goal is not to hide the prototype’s limitations—it is to demonstrate how the system evolves from a synchronous demo into a secure, observable, portfolio-ready application.

## Current stage

**Stage 4: authenticated browser-to-S3 upload**

- Responsive portfolio and product shell in TypeScript and React.
- Student/faculty experience switch with realistic workspace states.
- Architecture and decision records for the AWS migration.
- Environment-variable contract, strict TypeScript, linting, server-render test, and CI workflow.
- Runtime-validated upload contracts, processing-state transitions, and DynamoDB key builders.
- An owner-scoped upload use case with injectable database and object-storage ports.
- DynamoDB and S3 adapters that enforce conditional ownership writes and bounded presigned uploads.
- TypeScript CDK for Cognito, a private media bucket, DynamoDB, API Gateway, and Lambda.
- Cognito sign-up, email confirmation, sign-in, session restoration, and sign-out in the portfolio interface.
- Incremental browser SHA-256 hashing and a direct S3 upload flow with visible preparation and transfer states.
- Unit and infrastructure tests for authentication, validation, isolation, upload constraints, failure compensation, and security configuration.

The portfolio remains honest when AWS has not been deployed: it renders the architecture and activation steps instead of simulating a successful upload. Once the four `NEXT_PUBLIC_*` AWS values are supplied, the same interface activates the real Cognito and private S3 flow. The next vertical slice starts the asynchronous Transcribe and Bedrock workflow after S3 confirms an upload.

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

After deploying the CDK stack, copy its API, user-pool, and client outputs into:

```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_GWLEARN_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_GWLEARN_USER_POOL_ID=us-east-1_example
NEXT_PUBLIC_GWLEARN_USER_POOL_CLIENT_ID=exampleclientid
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run infra:synth
```

To synthesize for a deployed frontend origin:

```bash
GWLEARN_ALLOWED_ORIGIN=https://your-app.example npm run infra:synth
```

## Repository shape

```text
app/                    Product interface
docs/                   Architecture and decisions
packages/contracts/     Shared runtime validation and domain types
packages/browser/       Cognito configuration, hashing, and direct-upload client
services/upload-api/    Cloud-independent upload application logic
infra/                  AWS CDK stack and infrastructure assertions
tests/                  Server-rendered behavior checks
.github/workflows/      Continuous integration
```

The backend and infrastructure packages will be added when the first upload-to-processing vertical slice is implemented. That keeps the repository honest: each package arrives with working behavior and tests instead of speculative scaffolding.

## Roadmap

1. Establish the typed product foundation.
2. Add Cognito, S3, DynamoDB, API Gateway, and Lambda through TypeScript CDK. ✅
3. Connect direct browser uploads and durable processing status. ✅
4. Orchestrate Transcribe and Bedrock through Step Functions.
5. Add transcript-grounded study tools and chat with timestamp citations.
6. Complete accessibility, security, cost, and portfolio release checks.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for verification expectations and the detailed commit-message policy used throughout the rebuild.
