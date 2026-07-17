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
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
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
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPool = new UserPool(this, "UserPool", {
      accountRecovery: AccountRecovery.EMAIL_ONLY,
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
    new CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
  }
}
