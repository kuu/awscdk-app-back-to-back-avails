import * as fs from 'fs';
import * as path from 'path';
import { Duration, aws_logs as logs } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface LambdaProps {
  readonly channelId: string;
  readonly backToBackAvailsNum: number;
  readonly availDurationInSeconds: number;
  readonly maxOverlapInSeconds: number;
}

export class Lambda extends Construct {
  public readonly func: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const {
      channelId,
      backToBackAvailsNum,
      availDurationInSeconds,
      maxOverlapInSeconds,
    } = props;

    const TS_ENTRY = path.resolve(__dirname, 'code', 'index.ts');
    const JS_ENTRY = path.resolve(__dirname, 'code', 'index.js');

    this.func = new NodejsFunction(scope, 'ScheduleSCTE', {
      runtime: Runtime.NODEJS_18_X,
      entry: fs.existsSync(TS_ENTRY) ? TS_ENTRY : JS_ENTRY,
      // projectRoot: path.resolve(__dirname, '..'),
      // depsLockFilePath: path.resolve(__dirname, '..', 'package-lock.json'),
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        REGION: process.env.CDK_DEFAULT_REGION as string,
        CHANNEL_ID: channelId,
        BACK_TO_BACK_AVAILS_NUM: backToBackAvailsNum.toString(10),
        AVAIL_DURATION_IN_SECONDS: availDurationInSeconds.toString(10),
        MAX_OVERLAP_IN_SECONDS: maxOverlapInSeconds.toString(10),
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });
    // Add a statement to call MediaLive schedule API
    this.func.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'medialive:*',
        Resource: '*',
      }),
    );
  }
}