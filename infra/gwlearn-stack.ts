import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
  UserPoolGroup,
} from "aws-cdk-lib/aws-cognito";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import { Match as EventMatch, Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import {
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  JsonPath,
  Pass,
  StateMachine,
  Succeed,
  TaskInput,
  Wait,
  WaitTime,
} from "aws-cdk-lib/aws-stepfunctions";
import { CallAwsService, LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import type { Construct } from "constructs";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export interface GWLearnStackProps extends StackProps {
  allowedOrigin: string;
}

export class GWLearnStack extends Stack {
  constructor(scope: Construct, id: string, props: GWLearnStackProps) {
    super(scope, id, props);

    const table = new Table(this, "ApplicationTable", {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
      sortKey: { name: "SK", type: AttributeType.STRING },
    });
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
      sortKey: { name: "GSI1SK", type: AttributeType.STRING },
    });

    const mediaBucket = new Bucket(this, "MediaBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["content-type", "x-amz-checksum-sha256"],
          allowedMethods: [HttpMethods.POST],
          allowedOrigins: [props.allowedOrigin],
          exposedHeaders: ["etag", "x-amz-checksum-sha256"],
          maxAge: 900,
        },
      ],
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPool = new UserPool(this, "UserPool", {
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
    });
    const userPoolClient = new UserPoolClient(this, "WebClient", {
      authFlows: { userSrp: true },
      disableOAuth: true,
      preventUserExistenceErrors: true,
      userPool,
    });
    new UserPoolGroup(this, "StudentsGroup", {
      groupName: "students",
      userPool,
    });
    new UserPoolGroup(this, "FacultyGroup", {
      groupName: "faculty",
      userPool,
    });

    const uploadFunction = new NodejsFunction(this, "CreateUploadFunction", {
      entry: join(currentDirectory, "../services/upload-api/handler.ts"),
      environment: {
        MEDIA_BUCKET_NAME: mediaBucket.bucketName,
        TABLE_NAME: table.tableName,
      },
      handler: "handler",
      memorySize: 512,
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.seconds(10),
    });
    uploadFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:DeleteItem"],
        resources: [table.tableArn],
      }),
    );

    const bedrockModelId = "amazon.nova-lite-v1:0";
    const controlFunction = new NodejsFunction(this, "ProcessingControlFunction", {
      entry: join(currentDirectory, "../services/processing/control-handler.ts"),
      environment: { TABLE_NAME: table.tableName },
      handler: "handler",
      memorySize: 256,
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.seconds(15),
    });
    controlFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [table.tableArn],
      }),
    );

    const generateFunction = new NodejsFunction(this, "GenerateArtifactsFunction", {
      entry: join(currentDirectory, "../services/processing/generate-handler.ts"),
      environment: {
        BEDROCK_MODEL_ID: bedrockModelId,
        TABLE_NAME: table.tableName,
      },
      handler: "handler",
      memorySize: 1024,
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.minutes(10),
    });
    generateFunction.addToRolePolicy(
      new PolicyStatement({ actions: ["dynamodb:UpdateItem"], resources: [table.tableArn] }),
    );
    generateFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [mediaBucket.arnForObjects("private/*/videos/*/*")],
      }),
    );
    generateFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:${this.partition}:bedrock:${this.region}::foundation-model/${bedrockModelId}`,
        ],
      }),
    );

    const transcribeDataRole = new Role(this, "TranscribeDataRole", {
      assumedBy: new ServicePrincipal("transcribe.amazonaws.com", {
        conditions: { StringEquals: { "aws:SourceAccount": this.account } },
      }),
    });
    transcribeDataRole.addToPolicy(
      new PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [mediaBucket.arnForObjects("private/*/videos/*/source.*")],
      }),
    );
    transcribeDataRole.addToPolicy(
      new PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [mediaBucket.arnForObjects("private/*/videos/*/transcript/*")],
      }),
    );
    transcribeDataRole.addToPolicy(
      new PolicyStatement({ actions: ["s3:GetBucketLocation"], resources: [mediaBucket.bucketArn] }),
    );

    const initialize = new LambdaInvoke(this, "InitializeProcessing", {
      lambdaFunction: controlFunction,
      payload: TaskInput.fromObject({ action: "initialize", event: JsonPath.entirePayload }),
      payloadResponseOnly: true,
    });
    const startTranscription = new CallAwsService(this, "StartTranscription", {
      action: "startTranscriptionJob",
      additionalIamStatements: [
        new PolicyStatement({ actions: ["iam:PassRole"], resources: [transcribeDataRole.roleArn] }),
      ],
      iamResources: ["*"],
      parameters: {
        "LanguageCode.$": "$.languageCode",
        Media: { "MediaFileUri.$": "$.mediaUri" },
        "MediaFormat.$": "$.mediaFormat",
        OutputBucketName: mediaBucket.bucketName,
        "OutputKey.$": "$.transcriptKey",
        JobExecutionSettings: { DataAccessRoleArn: transcribeDataRole.roleArn },
        "TranscriptionJobName.$": "$.transcriptionJobName",
      },
      resultPath: "$.started",
      service: "transcribe",
    });
    const waitForTranscription = new Wait(this, "WaitForTranscription", {
      time: WaitTime.duration(Duration.seconds(20)),
    });
    const getTranscription = new CallAwsService(this, "GetTranscription", {
      action: "getTranscriptionJob",
      iamResources: [
        `arn:${this.partition}:transcribe:${this.region}:${this.account}:transcription-job/*`,
      ],
      parameters: { "TranscriptionJobName.$": "$.transcriptionJobName" },
      resultPath: "$.transcription",
      service: "transcribe",
    });
    const generateArtifacts = new LambdaInvoke(this, "GenerateLearningArtifacts", {
      lambdaFunction: generateFunction,
      payload: TaskInput.fromObject({
        bucketName: JsonPath.stringAt("$.bucketName"),
        ownerId: JsonPath.stringAt("$.ownerId"),
        transcriptKey: JsonPath.stringAt("$.transcriptKey"),
        videoId: JsonPath.stringAt("$.videoId"),
      }),
      payloadResponseOnly: true,
    });
    const recordInitializationFailure = new LambdaInvoke(this, "RecordInitializationFailure", {
      lambdaFunction: controlFunction,
      payload: TaskInput.fromObject({
        action: "fail",
        error: JsonPath.objectAt("$.error"),
        event: JsonPath.entirePayload,
      }),
      payloadResponseOnly: true,
    });
    const recordProcessingFailure = new LambdaInvoke(this, "RecordProcessingFailure", {
      lambdaFunction: controlFunction,
      payload: TaskInput.fromObject({
        action: "fail",
        error: JsonPath.objectAt("$.error"),
        videoId: JsonPath.stringAt("$.videoId"),
      }),
      payloadResponseOnly: true,
    });
    const markTranscriptionFailure = new Pass(this, "MarkTranscriptionFailure", {
      parameters: {
        Cause: "Amazon Transcribe reported a failed job",
        Error: "AmazonTranscribeFailed",
      },
      resultPath: "$.error",
    });
    const completed = new Succeed(this, "ProcessingComplete");
    const skipped = new Succeed(this, "DuplicateEventIgnored");
    const failed = new Fail(this, "ProcessingFailed");

    recordInitializationFailure.next(failed);
    recordProcessingFailure.next(failed);

    initialize.addCatch(recordInitializationFailure, { resultPath: "$.error" });
    for (const task of [startTranscription, getTranscription, generateArtifacts]) {
      task.addRetry({ backoffRate: 2, interval: Duration.seconds(2), maxAttempts: 3 });
      task.addCatch(recordProcessingFailure, { resultPath: "$.error" });
    }
    const transcriptionStatus = new Choice(this, "TranscriptionFinished?")
      .when(
        Condition.stringEquals(
          "$.transcription.TranscriptionJob.TranscriptionJobStatus",
          "COMPLETED",
        ),
        generateArtifacts.next(completed),
      )
      .when(
        Condition.stringEquals(
          "$.transcription.TranscriptionJob.TranscriptionJobStatus",
          "FAILED",
        ),
        markTranscriptionFailure.next(recordProcessingFailure),
      )
      .otherwise(waitForTranscription);
    waitForTranscription.next(getTranscription.next(transcriptionStatus));
    const definition = initialize.next(
      new Choice(this, "DuplicateUploadEvent?")
        .when(Condition.booleanEquals("$.skip", true), skipped)
        .otherwise(startTranscription.next(waitForTranscription)),
    );
    const processingStateMachine = new StateMachine(this, "ProcessingStateMachine", {
      definitionBody: DefinitionBody.fromChainable(definition),
      timeout: Duration.hours(12),
    });

    new Rule(this, "SourceVideoCreatedRule", {
      eventPattern: {
        detail: {
          bucket: { name: [mediaBucket.bucketName] },
          object: { key: EventMatch.wildcard("private/*/videos/*/source.*") },
        },
        detailType: ["Object Created"],
        source: ["aws.s3"],
      },
      targets: [
        new SfnStateMachine(processingStateMachine, {
          input: RuleTargetInput.fromEventPath("$"),
        }),
      ],
    });
    uploadFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [mediaBucket.arnForObjects("*")],
      }),
    );

    const api = new HttpApi(this, "ApplicationApi", {
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: [props.allowedOrigin],
        maxAge: Duration.hours(1),
      },
    });
    const authorizer = new HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.${this.urlSuffix}/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );
    api.addRoutes({
      authorizer,
      integration: new HttpLambdaIntegration(
        "CreateUploadIntegration",
        uploadFunction,
      ),
      methods: [HttpMethod.POST],
      path: "/uploads",
    });

    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "BedrockModelId", { value: bedrockModelId });
    new CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "ProcessingStateMachineArn", {
      value: processingStateMachine.stateMachineArn,
    });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
  }
}
