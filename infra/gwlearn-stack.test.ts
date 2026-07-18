import assert from "node:assert/strict";
import test from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { GWLearnStack } from "./gwlearn-stack.ts";

test("synthesizes a private, authenticated, owner-scoped upload boundary", () => {
  const app = new App({ outdir: ".tmp/cdk-test" });
  const stack = new GWLearnStack(app, "TestStack", {
    allowedOrigin: "https://gwlearn.example.com",
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::DynamoDB::Table", 1);
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({
        IndexName: "GSI1",
        Projection: { ProjectionType: "ALL" },
      }),
    ]),
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
  });
  template.hasResourceProperties("AWS::S3::Bucket", {
    BucketEncryption: Match.anyValue(),
    CorsConfiguration: Match.anyValue(),
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.resourceCountIs("AWS::Cognito::UserPool", 1);
  template.resourceCountIs("AWS::StepFunctions::StateMachine", 1);
  template.resourceCountIs("AWS::Events::Rule", 1);
  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    AllowedOAuthFlows: Match.absent(),
    CallbackURLs: Match.absent(),
    ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
  });
  template.resourceCountIs("AWS::ApiGatewayV2::Authorizer", 1);
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: {
      Variables: {
        MEDIA_BUCKET_NAME: Match.anyValue(),
        TABLE_NAME: Match.anyValue(),
      },
    },
    Runtime: "nodejs24.x",
  });

  const json = JSON.stringify(template.toJSON());
  assert.match(json, /POST \/uploads/);
  assert.match(json, /https:\/\/gwlearn\.example\.com/);
  assert.doesNotMatch(json, /dynamodb:Scan/);
  assert.match(json, /dynamodb:UpdateItem/);
  assert.match(json, /transcribe:startTranscriptionJob/);
  assert.match(json, /transcribe:getTranscriptionJob/);
  assert.match(json, /bedrock:InvokeModel/);
  assert.match(json, /\\\"Media\\\":\{\\\"MediaFileUri\.\$\\\"/);
  assert.match(json, /private\/\*\/videos\/\*\/source\.\*/);
  assert.doesNotMatch(json, /s3:PutObjectTagging/);
});
