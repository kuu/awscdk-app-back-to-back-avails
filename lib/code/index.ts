import {
  MediaLiveClient,
  BatchUpdateScheduleCommand,
  BatchScheduleActionCreateRequest,
  DeleteScheduleCommand,
} from '@aws-sdk/client-medialive';

const client = new MediaLiveClient({ region: process.env.REGION });

const CHANNEL_ID = process.env.CHANNEL_ID as string;
const OFFSET = 30;
const BACK_TO_BACK_AVAILS_NUM = Number.parseInt(process.env.BACK_TO_BACK_AVAILS_NUM as string);
const AVAIL_DURATION_IN_SECONDS = Number.parseInt(process.env.AVAIL_DURATION_IN_SECONDS as string);
const MAX_OVERLAP_IN_SECONDS = Number.parseFloat(process.env.MAX_OVERLAP_IN_SECONDS as string);

// Lambda function to insert SCTE-35 splice_insert() message using the MediaLive schedule API
export async function handler() {
  await deleteSchedules();
  const startTime = new Date(Date.now() + (OFFSET * 1000));
  await scheduleEvent(Math.floor(startTime.getTime() / 1000), startTime);
}

function deleteSchedules() {
  const command = new DeleteScheduleCommand({ ChannelId: CHANNEL_ID });
  return client.send(command);
}

async function scheduleEvent(eventId: number, start: Date) {
  const scte = createScteCommand(eventId, start, createDurationList(BACK_TO_BACK_AVAILS_NUM));
  const command = new BatchUpdateScheduleCommand({ ChannelId: CHANNEL_ID, Creates: scte });
  const response = await client.send(command);
  console.log(JSON.stringify(response, null, 2));
}

interface DurationItem {
  duration: number;
  overlap: number;
}

function createScteCommand(eventId: number, start: Date, durationList: DurationItem[]): BatchScheduleActionCreateRequest {
  let t = start;
  return {
    ScheduleActions: durationList.map(({duration, overlap}, i) => {
      if (i > 0) {
        const {duration, overlap} = durationList[i - 1];
        t = incrementDate(t, duration - overlap);
      }
      return {
        ActionName: `SCTE35_splice-insert_${eventId}-${i}`,
        ScheduleActionSettings: {
          Scte35SpliceInsertSettings: {
            SpliceEventId: eventId + i,
            Duration: Math.round(duration * 90_000), // 90kHz
          },
        },
        ScheduleActionStartSettings: {
          FixedModeScheduleActionStartSettings: {
            Time: t.toISOString(),
          },
        },
      };
    }),
  };
}

function incrementDate(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function createDurationList(lengthOfList: number): DurationItem[] {
  const list = Array.from({ length: lengthOfList }, () => ({duration: 0, overlap: 0}));
  for (let i = 0; i < lengthOfList; i++) {
    list[i].duration = AVAIL_DURATION_IN_SECONDS;
    list[i].overlap = getRandomFloat(0, MAX_OVERLAP_IN_SECONDS);
  }
  return list;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
