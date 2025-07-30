#!/bin/bash

# Board Game Timer AWS Lambda Deployment Script

set -e

echo "🚀 Starting Board Game Timer Lambda deployment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ SAM CLI is not installed. Installing..."
    npm install -g @aws-sam/cli
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

echo "✅ AWS credentials configured"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the Lambda function
echo "🔨 Building Lambda function..."
sam build

# Deploy based on argument
if [ "$1" = "--guided" ]; then
    echo "🎯 Running guided deployment..."
    sam deploy --guided
else
    echo "🚀 Deploying to AWS..."
    sam deploy
fi

# Get the outputs
echo "📊 Getting deployment outputs..."
STACK_NAME=$(grep stack_name samconfig.toml | cut -d'"' -f2)

if [ -z "$STACK_NAME" ]; then
    STACK_NAME="boardgame-timer-lambda"
fi

echo "📡 Fetching WebSocket endpoint..."
WEBSOCKET_URI=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURI`].OutputValue' \
    --output text)

if [ -n "$WEBSOCKET_URI" ]; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "📋 Connection Details:"
    echo "   WebSocket URI: $WEBSOCKET_URI"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Update your client configuration:"
    echo "      REACT_APP_LAMBDA_WEBSOCKET_URL=$WEBSOCKET_URI"
    echo ""
    echo "   2. Test the connection:"
    echo "      wscat -c $WEBSOCKET_URI"
    echo ""
    echo "   3. Monitor in AWS Console:"
    echo "      https://console.aws.amazon.com/lambda/"
    echo ""
else
    echo "⚠️ Could not retrieve WebSocket URI. Check the AWS Console for outputs."
fi

echo "✅ Deployment complete!"