<div align="center">
  <img src="frontend/assets/icon.png" alt="CampusFlow Logo" width="120" />
  <h1>CampusFlow</h1>
  <p><strong>Your AI-powered academic command center</strong></p>
</div>

<div align="center">
  <img alt="React Native" src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="Expo" src="https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white" />
  <img alt="AWS" src="https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
</div>

<br />

CampusFlow is an intelligent student productivity app that eliminates the chaos of college life. By leveraging LLMs (Groq / AWS Bedrock), it automatically extracts deadlines, assignments, and events from raw unstructured text (like WhatsApp messages, college emails, and timetable PDFs) and organizes them into a centralized, actionable dashboard.

---

## ✨ Key Features

- 🧠 **AI-Powered Data Ingestion**: Simply paste a message or upload a document. The AI extracts events, classifies them (exam, assignment, event), and assigns an urgency level.
- 📱 **Cross-Platform Native App**: A buttery smooth mobile experience built with React Native and Expo.
- 🔔 **Smart Push Nudges**: Receive intelligent push notifications (via Expo Push API) reminding you of critical deadlines before it's too late.
- ☕ **Daily Morning Briefings**: Wake up to a personalized AI-generated daily briefing summarizing your schedule and health score.
- 📈 **Academic Health Score**: A gamified system that evaluates your academic standing based on pending tasks and upcoming critical deadlines.
- ☁️ **Fully Serverless Backend**: Highly scalable, zero-maintenance backend powered by AWS Lambda, API Gateway, DynamoDB, SQS, and EventBridge.

---

## 🏗️ Architecture

CampusFlow is split into two main components:

### 1. Frontend (`/frontend`)
- **Framework**: React Native & Expo Router (File-based routing)
- **State Management**: Zustand
- **Styling**: Native StyleSheet with a custom Design System
- **Push Notifications**: Expo Notifications SDK

### 2. Backend (`/backend`)
- **Infrastructure as Code**: AWS SAM (Serverless Application Model)
- **Compute**: AWS Lambda (Node.js 20)
- **Database**: Amazon DynamoDB (Single-table design pattern)
- **Asynchronous Processing**: AWS SQS (for handling AI ingestion tasks safely)
- **AI Integration**: Groq API (`llama-3.3-70b-versatile`) and AWS Bedrock (`Claude 3 Sonnet`)
- **File Storage**: Amazon S3 (for timetable/PDF uploads)

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.x
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with valid credentials
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

### Backend Deployment

The backend must be deployed first so the frontend has an API to talk to.

```bash
cd backend

# Install dependencies
npm install

# Build the SAM application
npm run build

# Deploy to AWS (Follow the interactive prompts)
npm run deploy
```

*Note: Make sure to set your `GROQ_API_KEY` and other parameters in AWS Systems Manager or during the SAM guided deploy.*

### Frontend Setup

Once the backend is deployed, you will receive an `ApiBaseUrl` in the CloudFormation outputs. 

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend` root and add your backend URL:
   ```env
   EXPO_PUBLIC_API_URL=https://<your-api-id>.execute-api.<region>.amazonaws.com/dev/api
   ```
4. Start the Expo development server:
   ```bash
   npx expo start
   ```

---

## 📦 Deployment

### Building for Production
We use **EAS (Expo Application Services)** to bundle the mobile apps.

**To build a preview APK for Android:**
```bash
cd frontend
npx eas-cli build -p android --profile preview
```

**To build a production AAB for the Google Play Store:**
```bash
cd frontend
npx eas-cli build -p android --profile production
```

---

## 🔒 Security & Privacy
- **JWT Authentication**: All endpoints are secured via an AWS API Gateway Custom Lambda Authorizer.
- **Data Isolation**: All extracted data is strictly tied to the student's ID.
- **Secure File Uploads**: Uploads use strictly temporary S3 presigned URLs.

---

<div align="center">
  <p>Built with ❤️ by the CampusFlow Team</p>
</div>
