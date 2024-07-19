import { Aws, Stack, StackProps, CfnOutput, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FilePublisher } from 'awscdk-construct-file-publisher';
import { LiveChannelFromMp4 } from 'awscdk-construct-live-channel-from-mp4-file';
import { MediaTailorWithCloudFront } from 'awscdk-mediatailor-cloudfront-construct';
import { AdDecisionServer } from 'awscdk-construct-ad-decision-server';
import { Lambda } from './Lambda';
import { EventBridgeSchedule } from './EventBridgeSchedule';

const INTERVAL_IN_MINUTES = 3;
const BACK_TO_BACK_AVAILS_NUM = 3;
const AVAIL_DURATION_IN_SECONDS = 30;
const MAX_OVERLAP_IN_SECONDS = 0.5;

export class AwscdkAppBackToBackAvailsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Upload all the files in the local folder (./upload) to S3
    const publicFolder = new FilePublisher(this, 'FilePublisher', {
      path: './upload',
    });

    // Create a MediaLive channel with MediaPackage V1/V2 endpoints
    const { eml, empv1: emp } = new LiveChannelFromMp4(this, 'LiveChannelFromMp4', {
      source: `${publicFolder.url}/dog.mp4`, // required
      channelClass: 'STANDARD', // optional: default = 'SINGLE_PIPELINE'
      encoderSpec: {
        gopLengthInSeconds: 2, // optional: default = 3
        timecodeBurninPrefix: 'Ch1', // optional: default = no timecode overlay
      },
      mediaPackageVersionSpec: 'V1_ONLY', // optional: default = 'V1_AND_V2'
      packagerSpec: {
        segmentDurationSeconds: 4, // optional: default = 6
        manifestWindowSeconds: 120, // optional: default = 60
        startoverWindowSeconds: 300, // optional: default = 60
      },
    });

    // Create Lambda function to insert SCTE message using the MediaLive schedule API
    const scteLambda = new Lambda(this, 'ScteLambdaFunction', {
      channelId: eml.channel.ref,
      backToBackAvailsNum: BACK_TO_BACK_AVAILS_NUM,
      availDurationInSeconds: AVAIL_DURATION_IN_SECONDS,
      maxOverlapInSeconds: MAX_OVERLAP_IN_SECONDS,
    });

    // Create EventBridge rule to invoke the Lambda function every N minutes
    const scteSchedule = new EventBridgeSchedule(this, 'ScteEventBridgeSchedule', {
      func: scteLambda.func,
      intervalInMinutes: INTERVAL_IN_MINUTES,
    });

    // Build an Ad Decision Server (ADS) that returns 3x creatives
    const ads = new AdDecisionServer(this, 'AdDecisionServer', {
      creatives: [
        {
          duration: 30,
          url: `${publicFolder.url}/30sec.mp4`,
          delivery: 'progressive',
          mimeType: 'video/mp4',
          width: 1280,
          height: 720,
        },
        /*
        {
          duration: 60,
          url: `${publicFolder.url}/60sec.mp4`,
          delivery: 'progressive',
          mimeType: 'video/mp4',
          width: 1280,
          height: 720,
        },
        */
      ],
      clearanceRule: 'SEQUENCIAL', // Specify how ADS clear inventory: LONGEST_FIRST (defalut) or SEQUENCIAL
    });

    if (!emp?.endpoints.hls?.attrUrl) {
      console.error('Failed to create MediaPackage V1 endpoint');
      return;
    }

    // Create MediaTailor with CloudFront
    const { emt } = new MediaTailorWithCloudFront(this, 'MediaTailorWithCloudFront', {
      videoContentSourceUrl: emp.endpoints.hls.attrUrl, // (required) The MediaPackage V1 endpoint URL
      adDecisionServerUrl: `${ads.url}?duration=[session.avail_duration_secs]`, // (optional) The ad decision server URL
      slateAdUrl: `${publicFolder.url}/slate-1sec.mp4`, // (optional) The URL of the slate video file
      skipCloudFront: true, // (optional) Skip the CloudFront setup (default = false)
    });

    // Print MediaTialor Session Initialization cURL command
    const arr = Fn.split('/', emp.endpoints.hls.attrUrl);
    new CfnOutput(this, "MediaTailorSessionInitializationCommand", {
      value: `curl -X POST -H "Content-Type: application/json" -d '{ "logMode": "DEBUG"}' ${emt.config.attrSessionInitializationEndpointPrefix}${Fn.select(5, arr)}/${Fn.select(6, arr)}`,
      exportName: Aws.STACK_NAME + "MediaTailorSessionInitializationCommand",
      description: "MediaTailor Session Initialization Command",
    });
  }
}
