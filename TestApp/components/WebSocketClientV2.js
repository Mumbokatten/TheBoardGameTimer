// Enhanced WebSocket client that supports both Lambda and traditional WebSocket servers
class WebSocketClientV2 {
  constructor() {
    this.ws = null;
    this.gameId = null;
    this.playerId = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connectionStatus = 'disconnected';
    this.messageQueue = [];
    this.isReconnecting = false;
    this.serverType = 'auto'; // 'lambda', 'websocket', or 'auto'
    this.currentServerUrl = null;
  }

  // Auto-detect server type and connect
  async connect(serverUrl = null) {
    const servers = serverUrl ? [serverUrl] : [
      // Try Lambda first (production)
      process.env.REACT_APP_LAMBDA_WEBSOCKET_URL || 'wss://your-api-id.execute-api.us-east-1.amazonaws.com/dev',
      // Fallback to local WebSocket server
      'ws://localhost:8080/boardgame-timer'
    ];

    for (const url of servers) {
      try {
        await this.connectToServer(url);
        this.currentServerUrl = url;
        this.serverType = url.includes('execute-api') ? 'lambda' : 'websocket';
        console.log(`🔌 Connected to ${this.serverType} server:`, url);
        return;
      } catch (error) {
        console.log(`Failed to connect to ${url}:`, error.message);
        continue;
      }
    }

    throw new Error('Failed to connect to any available server');
  }

  // Connect to a specific server
  connectToServer(serverUrl) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(serverUrl);
        
        const timeout = setTimeout(() => {
          this.ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);
        
        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('🔌 WebSocket connected to:', serverUrl);
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          
          // Send queued messages
          this.flushMessageQueue();
          
          // Emit connection status
          this.emit('connectionStatus', 'connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket error:', error);
          this.connectionStatus = 'error';
          this.emit('connectionStatus', 'error');
          reject(error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.connectionStatus = 'disconnected';
          this.emit('connectionStatus', 'disconnected');
          
          // Attempt to reconnect if not intentional close
          if (event.code !== 1000 && !this.isReconnecting) {
            this.reconnect();
          }
        };

      } catch (error) {
        console.error('❌ Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }

  // Reconnect logic with server fallback
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      this.emit('connectionStatus', 'error');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`🔄 Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    this.emit('connectionStatus', 'connecting');

    setTimeout(async () => {
      try {
        await this.connect(this.currentServerUrl);
      } catch (error) {
        // Try connecting to any available server
        try {
          await this.connect();
        } catch (fallbackError) {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
          }
        }
      }
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  // Send message with server-specific formatting
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      let formattedMessage;
      
      if (this.serverType === 'lambda') {
        // Lambda expects action-based routing
        formattedMessage = JSON.stringify({
          action: message.type.toLowerCase().replace('_', ''),
          ...message
        });
      } else {
        // Traditional WebSocket server
        formattedMessage = JSON.stringify(message);
      }
      
      this.ws.send(formattedMessage);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      console.log('📦 Message queued (connection not ready):', message.type);
    }
  }

  // Flush queued messages
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
      console.log('📤 Sent queued message:', message.type);
    }
  }

  // Handle incoming messages (same for both server types)
  handleMessage(message) {
    console.log('📨 Received:', message.type);
    
    switch (message.type) {
      case 'CONNECTION_STATUS':
        this.emit('connectionStatus', message.status);
        break;
        
      case 'GAME_CREATED':
        this.gameId = message.gameId;
        this.emit('gameCreated', message);
        break;
        
      case 'GAME_JOINED':
        this.gameId = message.gameId;
        this.emit('gameJoined', message);
        break;
        
      case 'GAME_STATE_UPDATE':
        this.emit('gameStateUpdate', message);
        break;
        
      case 'PLAYER_JOINED':
        this.emit('playerJoined', message);
        break;
        
      case 'PLAYER_LEFT':
        this.emit('playerLeft', message);
        break;
        
      case 'ERROR':
        console.error('❌ Server error:', message.message);
        this.emit('error', message);
        break;
        
      case 'PONG':
        // Handle ping response
        break;
        
      default:
        console.log('❓ Unknown message type:', message.type);
    }
  }

  // Event emitter functionality (same as original)
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Game operations (same interface for both server types)
  createGame(playerId, playerData = {}) {
    this.playerId = playerId;
    this.send({
      type: 'CREATE_GAME',
      playerId,
      playerData
    });
  }

  joinGame(gameId, playerId, playerData = {}) {
    this.playerId = playerId;
    this.send({
      type: 'JOIN_GAME',
      gameId,
      playerId,
      playerData
    });
  }

  updateGameState(gameId, playerId, data) {
    this.send({
      type: 'UPDATE_GAME_STATE',
      gameId,
      playerId,
      data
    });
  }

  updatePlayer(gameId, playerId, playerData) {
    this.send({
      type: 'UPDATE_PLAYER',
      gameId,
      playerId,
      playerData
    });
  }

  leaveGame(gameId, playerId) {
    this.send({
      type: 'LEAVE_GAME',
      gameId,
      playerId
    });
  }

  // Send ping to keep connection alive
  ping() {
    this.send({
      type: 'PING'
    });
  }

  // Disconnect
  disconnect() {
    this.isReconnecting = false;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.connectionStatus;
  }

  // Check if connected
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Get current server type
  getServerType() {
    return this.serverType;
  }

  // Get current server URL
  getServerUrl() {
    return this.currentServerUrl;
  }
}

// Export singleton instance
const webSocketClientV2 = new WebSocketClientV2();

// Keep connection alive with periodic pings
setInterval(() => {
  if (webSocketClientV2.isConnected()) {
    webSocketClientV2.ping();
  }
}, 30000); // Ping every 30 seconds

export default webSocketClientV2;