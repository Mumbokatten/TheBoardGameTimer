// WebSocket client for Board Game Timer
class WebSocketClient {
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
  }

  // Connect to WebSocket server
  connect(serverUrl = 'ws://localhost:8080/boardgame-timer') {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(serverUrl);
        
        this.ws.onopen = () => {
          console.log('🔌 WebSocket connected');
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
          console.error('❌ WebSocket error:', error);
          this.connectionStatus = 'error';
          this.emit('connectionStatus', 'error');
          reject(error);
        };

        this.ws.onclose = (event) => {
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

  // Reconnect logic
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      this.emit('connectionStatus', 'error');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`🔄 Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    this.emit('connectionStatus', 'connecting');

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, try again
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      });
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  // Send message to server
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
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

  // Handle incoming messages
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

  // Event emitter functionality
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

  // Game operations
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
}

// Export singleton instance
const webSocketClient = new WebSocketClient();

// Keep connection alive with periodic pings
setInterval(() => {
  if (webSocketClient.isConnected()) {
    webSocketClient.ping();
  }
}, 30000); // Ping every 30 seconds

export default webSocketClient;