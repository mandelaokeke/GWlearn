# Contributing to GWLearn

## Working agreement

- Keep changes aligned to one testable product or architecture outcome.
- Do not commit credentials, private lecture material, generated dependency folders, or local environment files.
- Add or update tests when behavior changes.
- Run formatting, linting, type checking, tests, and a production build before publishing a branch.
- Document infrastructure, data-model, security, or provider changes in an architecture decision record.

## Commit messages

Every commit must identify the affected subsystem and the concrete behavior or outcome. Use a body when the reason, migration detail, verification, or operational effect is not obvious from the subject.

```text
<type>(<scope>): <specific behavior or outcome>

<why the change is needed>
<important implementation or migration details>
<tests, verification, or operational notes>
```

Example:

```text
feat(upload-api): issue owner-scoped S3 upload URLs with checksum validation

Generate video identifiers and object keys on the server so clients cannot
select another user's prefix. Require the declared media type and checksum,
then persist the initial UPLOADING record with a conditional DynamoDB write.

Verified with API contract and local integration tests.
```

Avoid subjects such as `updates`, `fix bugs`, `cleanup`, `changes`, or `work in progress`.

## Pull requests

Describe:

1. The user-visible or operational outcome.
2. The main design decision and important tradeoffs.
3. How the change was verified.
4. Follow-up work intentionally left out of scope.
