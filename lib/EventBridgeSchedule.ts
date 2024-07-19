import * as cdk from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface EventBridgeScheduleProps {
  readonly func: NodejsFunction;
  readonly intervalInMinutes: number;
}

export class EventBridgeSchedule extends Construct {
  public rule: Rule;

  constructor(scope: Construct, id: string, props: EventBridgeScheduleProps) {
    super(scope, id);

    const { func, intervalInMinutes } = props;

    this.rule = new Rule(this, 'InvokeFunctionEveryXMinutes', {
      schedule: Schedule.rate(cdk.Duration.minutes(intervalInMinutes)),
    });

    this.rule.addTarget(
      new LambdaFunction(func),
    );
  }
}