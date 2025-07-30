# Board Game Timer - AWS Lambda WebSocket Implementation

This directory contains the AWS Lambda implementation of the Board Game Timer WebSocket server, providing a serverless alternative to the traditional WebSocket server.

## 🏗️ Architecture

```
Browser ←→ API Gateway WebSocket ←→ Lambda Function ←→ DynamoDB
                                           ↓
                                    Connection Management
                                    Game State Management
                                    Real-time Broadcasting
```

## 🚀 Deployment

### Prerequisites
1. **AWS CLI** configured with appropriate credentials
2. **SAM CLI** installed (`npm install -g @aws-sam/cli`)
3. **Node.js 18+** 

### Quick Deploy
```bash
cd aws-lambda
npm install
sam build
sam deploy --guided
```

### Environment Setup
```bash
# Install dependencies
npm install

# Build the Lambda function
sam build

# Deploy with guided setup (first time)
sam deploy --guided

# Future deployments
sam deploy
```

## 📊 Cost Estimation

### AWS Free Tier (12 months)
- **API Gateway**: 1M WebSocket messages FREE
- **Lambda**: 1M requests + 400K GB-seconds FREE  
- **DynamoDB**: 25GB + 25 read/write units FREE

### Production Costs (beyond free tier)
- **Small Scale** (50 games/day): ~$0/month (within free tier)
- **Medium Scale** (500 games/day): ~$5-8/month
- **Large Scale** (2000+ games/day): ~$20-30/month

## 🗄️ DynamoDB Tables

### Connections Table
```javascript
{
  connectionId: "abc123",    // Primary Key
  playerId: "player-uuid",
  gameId: "GAME123",        // GSI
  connectedAt: 1234567890,
  lastSeen: 1234567890,
  ttl: 1234567890          // Auto-cleanup after 24 hours
}
```

### Games Table
```javascript
{
  gameId: "GAME123",        // Primary Key
  hostId: "player-uuid",
  players: [...],
  activePlayerId: "player-1",
  isRunning: false,
  gameStarted: false,
  currentGameName: "Chess Match",
  connectedPlayers: {...},
  timestamp: 1234567890,
  ttl: 1234567890          // Auto-cleanup after 24 hours
}
```

## 🔧 Configuration

### Environment Variables
- `CONNECTIONS_TABLE`: DynamoDB connections table name
- `GAMES_TABLE`: DynamoDB games table name
- `WEBSOCKET_ENDPOINT`: API Gateway WebSocket endpoint

### Client Configuration
Update your client to use the Lambda WebSocket endpoint:

```javascript
// In WebSocketClientV2.js
const LAMBDA_ENDPOINT = 'wss://your-api-id.execute-api.us-east-1.amazonaws.com/dev';
```

## 🎮 Game Flow

1. **Connect**: Client connects to WebSocket API
2. **Create/Join**: Player creates or joins a game
3. **Real-time Sync**: All game state changes broadcast to connected players
4. **Auto-cleanup**: Games and connections auto-expire after 24 hours

## 🧪 Testing

### Local Testing
```bash
# Start SAM local API
sam local start-api

# Test with local WebSocket (requires additional setup)
# Note: WebSocket testing locally is complex - deploy to AWS for full testing
```

### Production Testing
```bash
# Deploy to AWS
sam deploy

# Get WebSocket endpoint from outputs
aws cloudformation describe-stacks --stack-name boardgame-timer-lambda --query 'Stacks[0].Outputs'

# Test with production endpoint
```

## 📁 File Structure

```
aws-lambda/
├── index.js              # Main Lambda handler
├── package.json           # Dependencies and scripts
├── template.yaml          # SAM CloudFormation template
├── samconfig.toml         # SAM configuration
├── README.md             # This file
└── tests/                # Unit tests (optional)
```

## 🔄 Comparison with Traditional WebSocket

| Feature | Lambda WebSocket | Traditional WebSocket |
|---------|------------------|----------------------|
| **Scaling** | Automatic | Manual |
| **Cost** | Pay-per-use | Fixed monthly |
| **Maintenance** | None | Server management |
| **Availability** | 99.9%+ | Depends on hosting |
| **Cold Starts** | ~100-500ms | None |
| **Complexity** | Higher setup | Simple setup |

## 🚨 Important Notes

1. **Cold Starts**: Lambda functions may have 100-500ms cold start delay
2. **Connection Limits**: API Gateway WebSocket has connection limits (10K concurrent by default)
3. **Message Size**: 32KB limit per WebSocket message
4. **Duration**: Connections automatically close after 2 hours of inactivity

## 🔗 Integration

The Lambda implementation uses the same message format as the traditional WebSocket server, making it a drop-in replacement. The client automatically detects and connects to the best available server.

## 🎯 Next Steps

1. Deploy to AWS using the commands above
2. Update client configuration with your API Gateway endpoint
3. Test multiplayer functionality
4. Monitor usage and costs in AWS Console
5. Scale as needed with automatic AWS scaling