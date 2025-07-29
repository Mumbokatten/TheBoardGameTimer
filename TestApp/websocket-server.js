const WebSocket = require('ws');
const http = require('http');

// In-memory storage for games and connections
const games = new Map();
const connections = new Map(); // playerId -> WebSocket connection

// Game data structure matching Firebase implementation
class Game {
  constructor(gameId, hostId) {
    this.gameId = gameId;
    this.hostId = hostId;
    this.players = [];
    this.activePlayerId = null;
    this.isRunning = false;
    this.gameStarted = false;
    this.currentGameName = '';
    this.timerMode = 'countup';
    this.initialTime = 600;
    this.allowGuestControl = true;
    this.allowGuestNames = true;
    this.authoritativeTimerPlayerId = null;
    this.connectedPlayers = new Map();
    this.lastActionPlayerId = null;
    this.timestamp = Date.now();
  }

  addPlayer(playerId, playerData) {
    this.connectedPlayers.set(playerId, {
      id: playerId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      ...playerData
    });
  }

  removePlayer(playerId) {
    this.connectedPlayers.delete(playerId);
    // Remove from players array if exists
    this.players = this.players.filter(p => p.playerId !== playerId);
  }

  updateGameState(updates, playerId) {
    // Validate host permissions for structural changes
    if (this.hostId !== playerId) {
      // Guests can only update certain fields if permissions allow
      const allowedGuestUpdates = ['currentGameName'];
      if (this.allowGuestControl) {
        allowedGuestUpdates.push('activePlayerId', 'isRunning', 'authoritativeTimerPlayerId');
      }
      if (this.allowGuestNames) {
        allowedGuestUpdates.push('players');
      }

      // Filter updates to only allowed fields
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedGuestUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });
      updates = filteredUpdates;
    }

    // Apply updates
    Object.assign(this, updates);
    this.lastActionPlayerId = playerId;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      gameId: this.gameId,
      hostId: this.hostId,
      players: this.players,
      activePlayerId: this.activePlayerId,
      isRunning: this.isRunning,
      gameStarted: this.gameStarted,
      currentGameName: this.currentGameName,
      timerMode: this.timerMode,
      initialTime: this.initialTime,
      allowGuestControl: this.allowGuestControl,
      allowGuestNames: this.allowGuestNames,
      authoritativeTimerPlayerId: this.authoritativeTimerPlayerId,
      connectedPlayers: Object.fromEntries(this.connectedPlayers),
      lastActionPlayerId: this.lastActionPlayerId,
      timestamp: this.timestamp
    };
  }
}

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/boardgame-timer'
});

// Utility functions
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastToGame(gameId, message, excludePlayerId = null) {
  const game = games.get(gameId);
  if (!game) return;

  game.connectedPlayers.forEach((playerData, playerId) => {
    if (playerId !== excludePlayerId) {
      const connection = connections.get(playerId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
      }
    }
  });
}

function sendToPlayer(playerId, message) {
  const connection = connections.get(playerId);
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
  }
}

function cleanupDeadConnections() {
  const now = Date.now();
  const TIMEOUT = 30000; // 30 seconds

  connections.forEach((ws, playerId) => {
    if (ws.readyState !== WebSocket.OPEN) {
      connections.delete(playerId);
      
      // Remove from all games
      games.forEach((game, gameId) => {
        if (game.connectedPlayers.has(playerId)) {
          game.removePlayer(playerId);
          
          // Notify other players
          broadcastToGame(gameId, {
            type: 'PLAYER_LEFT',
            gameId,
            playerId,
            gameState: game.toJSON()
          });

          // Clean up empty games
          if (game.connectedPlayers.size === 0) {
            games.delete(gameId);
            console.log(`🗑️  Cleaned up empty game: ${gameId}`);
          }
        }
      });
    }
  });
}

// Clean up dead connections every 30 seconds
setInterval(cleanupDeadConnections, 30000);

// WebSocket connection handler
wss.on('connection', (ws, request) => {
  console.log('🔌 New WebSocket connection');
  
  let currentPlayerId = null;
  let currentGameId = null;

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'CONNECTION_STATUS',
    status: 'connected',
    timestamp: Date.now()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Message from ${currentPlayerId || 'unknown'}:`, message.type);

      switch (message.type) {
        case 'CREATE_GAME': {
          const gameId = generateGameId();
          const playerId = message.playerId;
          
          // Ensure gameId is unique
          while (games.has(gameId)) {
            gameId = generateGameId();
          }

          const game = new Game(gameId, playerId);
          games.set(gameId, game);
          
          // Register connection
          connections.set(playerId, ws);
          currentPlayerId = playerId;
          currentGameId = gameId;
          
          // Add host as first connected player
          game.addPlayer(playerId, message.playerData || {});

          ws.send(JSON.stringify({
            type: 'GAME_CREATED',
            gameId,
            gameState: game.toJSON()
          }));

          console.log(`🎮 Game created: ${gameId} by ${playerId}`);
          break;
        }

        case 'JOIN_GAME': {
          const { gameId, playerId, playerData } = message;
          const game = games.get(gameId);

          if (!game) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Game not found',
              code: 'GAME_NOT_FOUND'
            }));
            break;
          }

          // Register connection
          connections.set(playerId, ws);
          currentPlayerId = playerId;
          currentGameId = gameId;

          // Add player to game
          game.addPlayer(playerId, playerData || {});

          // Send current game state to joining player
          ws.send(JSON.stringify({
            type: 'GAME_JOINED',
            gameId,
            gameState: game.toJSON()
          }));

          // Notify other players
          broadcastToGame(gameId, {
            type: 'PLAYER_JOINED',
            gameId,
            playerId,
            gameState: game.toJSON()
          }, playerId);

          console.log(`👥 Player ${playerId} joined game ${gameId}`);
          break;
        }

        case 'UPDATE_GAME_STATE': {
          const { gameId, playerId, data } = message;
          const game = games.get(gameId);

          if (!game) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Game not found',
              code: 'GAME_NOT_FOUND'
            }));
            break;
          }

          // Update game state
          game.updateGameState(data, playerId);

          // Broadcast to all players in game
          broadcastToGame(gameId, {
            type: 'GAME_STATE_UPDATE',
            gameId,
            gameState: game.toJSON(),
            updatedBy: playerId
          });

          console.log(`🔄 Game state updated in ${gameId} by ${playerId}`);
          break;
        }

        case 'UPDATE_PLAYER': {
          const { gameId, playerId, playerData } = message;
          const game = games.get(gameId);

          if (!game) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Game not found',
              code: 'GAME_NOT_FOUND'
            }));
            break;
          }

          // Check permissions for player updates
          if (game.hostId !== playerId && !game.allowGuestNames) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Not allowed to update player data',
              code: 'PERMISSION_DENIED'
            }));
            break;
          }

          // Find and update player in players array
          const playerIndex = game.players.findIndex(p => p.id === playerData.id);
          if (playerIndex !== -1) {
            game.players[playerIndex] = { ...game.players[playerIndex], ...playerData };
            game.timestamp = Date.now();
            game.lastActionPlayerId = playerId;

            // Broadcast updated game state
            broadcastToGame(gameId, {
              type: 'GAME_STATE_UPDATE',
              gameId,
              gameState: game.toJSON(),
              updatedBy: playerId
            });

            console.log(`👤 Player updated in ${gameId}: ${playerData.id}`);
          }
          break;
        }

        case 'LEAVE_GAME': {
          const { gameId, playerId } = message;
          const game = games.get(gameId);

          if (game) {
            game.removePlayer(playerId);
            
            // If host left, transfer host to next player or delete game
            if (game.hostId === playerId) {
              const remainingPlayers = Array.from(game.connectedPlayers.keys());
              if (remainingPlayers.length > 0) {
                game.hostId = remainingPlayers[0];
                console.log(`👑 Host transferred to ${game.hostId} in game ${gameId}`);
              } else {
                games.delete(gameId);
                console.log(`🗑️  Game ${gameId} deleted - no players remaining`);
                break;
              }
            }

            // Notify remaining players
            broadcastToGame(gameId, {
              type: 'PLAYER_LEFT',
              gameId,
              playerId,
              gameState: game.toJSON()
            });

            console.log(`👋 Player ${playerId} left game ${gameId}`);
          }

          connections.delete(playerId);
          currentPlayerId = null;
          currentGameId = null;
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({
            type: 'PONG',
            timestamp: Date.now()
          }));
          break;
        }

        default:
          console.log('❓ Unknown message type:', message.type);
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Unknown message type',
            code: 'UNKNOWN_MESSAGE_TYPE'
          }));
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Invalid message format',
        code: 'INVALID_MESSAGE'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`🔌 Connection closed for ${currentPlayerId || 'unknown'}`);
    
    if (currentPlayerId && currentGameId) {
      const game = games.get(currentGameId);
      if (game) {
        game.removePlayer(currentPlayerId);
        
        // Notify other players
        broadcastToGame(currentGameId, {
          type: 'PLAYER_LEFT',
          gameId: currentGameId,
          playerId: currentPlayerId,
          gameState: game.toJSON()
        });

        // Clean up empty games
        if (game.connectedPlayers.size === 0) {
          games.delete(currentGameId);
          console.log(`🗑️  Cleaned up empty game: ${currentGameId}`);
        }
      }
      
      connections.delete(currentPlayerId);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/boardgame-timer`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutting down');
  });
  
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

// Export for testing
module.exports = { wss, games, connections, Game };