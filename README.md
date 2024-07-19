# awscdk-app-back-to-back-avails

AWS CDK app for deploying necessary resources to test MediaTailor's back-to-back avails behavior

## Install
1. Install [Node](https://nodejs.org)
2. Install [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
3. Install this app
```
$ git clone https://github.com/kuu/awscdk-app-back-to-back-avails.git
$ cd awscdk-app-back-to-back-avails
$ npm install
```

## Deploy
This creates an S3 bucket, uploads MP4 files in ./upload dir to the bucket, and deploys other resources (MediaLive, MediaPackage, MediaTailor, EventBridge, Lambda, etc.)
```
$ npx cdk deploy
```

## Output
MediaTialor's session initialization command will be printed:
```
curl -X POST -H "Content-Type: application/json" -d '{ "logMode": "DEBUG"}' https://xxx.mediatailor.{region}.amazonaws.com/v1/session/yyy/{config-name}/{endpoint-name}/index.m3u8
```

## Clean up
```
$ npm cdk destroy
```

## Useful commands
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Configure
You can configure the avail num/length
```
$ vi lib/awscdk-app-back-to-back-avails-stack.ts
const INTERVAL_IN_MINUTES = 3;
const BACK_TO_BACK_AVAILS_NUM = 3;
const AVAIL_DURATION_IN_SECONDS = 30;
const MAX_OVERLAP_IN_SECONDS = 0.5;
```

You can also replace the origin/ad/slate contents if necessary:
```
$ ls -1 upload
dog.mp4
30sec.mp4
60sec.mp4
slate-1sec.mp4
```