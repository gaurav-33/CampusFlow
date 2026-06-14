import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { computeHealthScore } from '../utils/healthScoreCalc.js';
import { generatePositiveNudge } from '../services/aiService.js';
import { queryByPK, putItem, updateHealthScore, markEventCompleted } from '../services/dynamoService.js';

const raw = new DynamoDBClient({ region: 'ap-south-1' });
const ddb = DynamoDBDocumentClient.from(raw);
const TABLE = process.env.TABLE_NAME ?? 'CampusFlowData';

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS" || event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = JSON.parse(event.body);
    const { studentId, eventSk } = body;

    if (!studentId || !eventSk) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing studentId or eventSk' }) };
    }

    const pk = `STUDENT#${studentId}`;

    // 1. Fetch Event
    const eventResult = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: pk, SK: eventSk }
    }));
    const eventItem = eventResult.Item;
    if (!eventItem) {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Event not found' }) };
    }

    if (eventItem.status === 'completed') {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ status: 'already_completed' }) };
    }

    // 2. Calculate Timestamp Math
    let hoursAhead = 0;
    if (eventItem.eventTs) {
      hoursAhead = (new Date(eventItem.eventTs).getTime() - new Date().getTime()) / (1000 * 60 * 60);
      if (hoursAhead < 0) hoursAhead = 0;
    }

    // 3. Update Event to 'completed' and set 'completedAt'
    await markEventCompleted(studentId, eventSk);

    // 4. Update BEHAVIOR Record
    const behaviorResult = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: pk, SK: 'BEHAVIOR' }
    }));
    let behavior = behaviorResult.Item || { tasksCompleted: 0, avgCompletionHoursAhead: 0 };
    
    const completedCount = behavior.tasksCompleted || 0;
    const oldAvg = behavior.avgCompletionHoursAhead || 0;
    const newAvg = ((oldAvg * completedCount) + hoursAhead) / (completedCount + 1);
    
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: pk, SK: 'BEHAVIOR' },
      UpdateExpression: 'SET tasksCompleted = if_not_exists(tasksCompleted, :zero) + :inc, avgCompletionHoursAhead = :newAvg',
      ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':newAvg': newAvg }
    }));

    // 5. Recalculate Health Score
    const items = await queryByPK(studentId);
    const allEvents = items.filter(i => i.SK.startsWith('EVENT#'));
    const profile = items.find(i => i.SK === 'PROFILE');
    
    // Explicitly update the fetched event to completed for the in-memory array
    const updatedEvents = allEvents.map(e => e.SK === eventSk ? { ...e, status: 'completed' } : e);
    const newScoreResult = computeHealthScore(updatedEvents);
    
    await updateHealthScore(studentId, newScoreResult.score);

    // 6. Rule R-11 (Positive Nudge)
    if (eventItem.urgency === 'critical' && hoursAhead > 24) {
      const nudgeText = await generatePositiveNudge(eventItem, profile);

      const nudgeSK = `NUDGE#${new Date().toISOString()}`;
      await putItem({
        PK: pk, SK: nudgeSK,
        eventRef: eventItem.title, nudgeText: nudgeText, urgency: 'low', // Positive, so low urgency
        read: false, createdAt: new Date().toISOString(),
      });
      // push to SNS omitted as per original ruleEngine logic (or mocked)
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'success', newScore: newScoreResult.score })
    };
  } catch (err) {
    console.error('Update Event error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
