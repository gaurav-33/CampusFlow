import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const raw = new DynamoDBClient({ region: 'ap-south-1' });
const ddb = DynamoDBDocumentClient.from(raw);
const TABLE = process.env.TABLE_NAME ?? 'CampusFlowData';

const studentId = process.argv[2];

if (!studentId) {
  console.error("Please provide a studentId as an argument: node generateMockBriefing.js <studentId>");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const mockBriefingText = `Good morning! You have a busy day ahead. Your Database Management exam is tomorrow at 10 AM, so prioritize your revision. Also, don't forget to submit your Networks assignment by 5 PM today. Keep up the great work!`;

const generateBriefing = async () => {
  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `STUDENT#${studentId}`,
        SK: `BRIEFING#${today}`,
        entityType: 'BRIEFING',
        briefingText: mockBriefingText,
        generatedAt: new Date().toISOString(),
      }
    }));
    console.log(`✅ Successfully generated mock morning briefing for ${studentId} for date ${today}.`);
    console.log(`Briefing text: "${mockBriefingText}"`);
  } catch (err) {
    console.error("❌ Failed to generate mock briefing:", err);
  }
};

generateBriefing();
