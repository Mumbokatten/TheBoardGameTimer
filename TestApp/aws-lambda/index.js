// AWS Lambda WebSocket Handler for Board Game Timer
const AWS = require('aws-sdk');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const apigateway = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT
});

// DynamoDB table names
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'boardgame-connections';
const GAMES_TABLE = process.env.GAMES_TABLE || 'boardgame-games';

// Utility functions
const generateGameId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const sendMessage = async (connectionId, message) => {
  try {
    await apigateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }).promise();
    return true;
  } catch (error) {
    console.error(`Failed to send message to ${connectionId}:`, error);
    if (error.statusCode === 410) {
      // Connection is stale, remove it
      await removeConnection(connectionId);
    }
    return false;
  }
};

const broadcastToGame = async (gameId, message, excludeConnectionId = null) => {
  try {
    // Get all connections for this game
    const connectionsResult = await dynamodb.scan({
      TableName: CONNECTIONS_TABLE,
      FilterExpression: 'gameId = :gameId',
      ExpressionAttributeValues: {
        ':gameId': gameId
      }
    }).promise();

    const sendPromises = connectionsResult.Items
      .filter(conn => conn.connectionId !== excludeConnectionId)
      .map(conn => sendMessage(conn.connectionId, message));

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('Error broadcasting to game:', error);
  }
};

const addConnection = async (connectionId, playerId, gameId = null) => {
  const params = {
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      playerId,
      gameId,
      connectedAt: Date.now(),
      lastSeen: Date.now()
    }
  };

  await dynamodb.put(params).promise();
};

const removeConnection = async (connectionId) => {
  const params = {
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId }
  };

  await dynamodb.delete(params).promise();
};

const getConnection = async (connectionId) => {
  const params = {
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId }
  };

  const result = await dynamodb.get(params).promise();
  return result.Item;
};

const updateConnection = async (connectionId, updates) => {
  const updateExpression = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updates).forEach(key => {
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = updates[key];
  });

  const params = {
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  };

  await dynamodb.update(params).promise();
};

// Game management functions
const createGame = async (gameId, hostPlayerId, hostConnectionId) => {
  const game = {
    gameId,
    hostId: hostPlayerId,
    players: [],
    activePlayerId: null,
    isRunning: false,
    gameStarted: false,
    currentGameName: '',
    timerMode: 'countup',
    initialTime: 600,
    allowGuestControl: true,
    allowGuestNames: true,
    authoritativeTimerPlayerId: null,
    connectedPlayers: {
      [hostPlayerId]: {
        id: hostPlayerId,
        connectionId: hostConnectionId,
        joinedAt: Date.now(),
        lastSeen: Date.now()
      }
    },
    lastActionPlayerId: null,
    timestamp: Date.now(),
    ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
  };

  const params = {
    TableName: GAMES_TABLE,
    Item: game
  };

  await dynamodb.put(params).promise();
  return game;
};

const getGame = async (gameId) => {
  const params = {
    TableName: GAMES_TABLE,
    Key: { gameId }
  };

  const result = await dynamodb.get(params).promise();
  return result.Item;
};

const updateGame = async (gameId, updates) => {
  const updateExpression = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  // Always update timestamp and TTL
  updates.timestamp = Date.now();
  updates.ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

  Object.keys(updates).forEach(key => {
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = updates[key];
  });

  const params = {
    TableName: GAMES_TABLE,
    Key: { gameId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.update(params).promise();
  return result.Attributes;
};

const deleteGame = async (gameId) => {
  const params = {
    TableName: GAMES_TABLE,
    Key: { gameId }
  };

  await dynamodb.delete(params).promise();
};

// Permission validation
const validatePermissions = (game, playerId, updates) => {
  if (game.hostId === playerId) {
    return updates; // Host can update everything
  }

  // Guest permissions
  const allowedGuestUpdates = ['currentGameName'];
  if (game.allowGuestControl) {
    allowedGuestUpdates.push('activePlayerId', 'isRunning', 'authoritativeTimerPlayerId');
  }
  if (game.allowGuestNames) {
    allowedGuestUpdates.push('players');
  }

  // Filter updates to only allowed fields
  const filteredUpdates = {};
  Object.keys(updates).forEach(key => {
    if (allowedGuestUpdates.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  return filteredUpdates;
};

// Lambda handler
exports.handler = async (event) => {
  const { routeKey, connectionId } = event.requestContext;
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // Set API Gateway endpoint for this request
  apigateway.config.endpoint = `https://${domain}/${stage}`;

  console.log('RouteKey:', routeKey, 'ConnectionId:', connectionId);

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId);

      case '$disconnect':
        return await handleDisconnect(connectionId);

      case 'createGame':
        return await handleCreateGame(connectionId, JSON.parse(event.body));

      case 'joinGame':
        return await handleJoinGame(connectionId, JSON.parse(event.body));

      case 'updateGameState':
        return await handleUpdateGameState(connectionId, JSON.parse(event.body));

      case 'updatePlayer':
        return await handleUpdatePlayer(connectionId, JSON.parse(event.body));

      case 'leaveGame':
        return await handleLeaveGame(connectionId, JSON.parse(event.body));

      case 'ping':
        return await handlePing(connectionId);

      default:
        console.log('Unknown route key:', routeKey);
        await sendMessage(connectionId, {
          type: 'ERROR',
          message: 'Unknown message type',
          code: 'UNKNOWN_MESSAGE_TYPE'
        });
        return { statusCode: 400 };
    }
  } catch (error) {
    console.error('Handler error:', error);
    
    try {
      await sendMessage(connectionId, {
        type: 'ERROR',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }

    return { statusCode: 500 };
  }
};

// Route handlers
const handleConnect = async (connectionId) => {
  console.log('New connection:', connectionId);
  
  // Store connection (playerId will be set later)
  await addConnection(connectionId, null);
  
  // Send connection confirmation
  await sendMessage(connectionId, {
    type: 'CONNECTION_STATUS',
    status: 'connected',
    timestamp: Date.now()
  });

  return { statusCode: 200 };
};

const handleDisconnect = async (connectionId) => {
  console.log('Disconnection:', connectionId);
  
  try {
    // Get connection info
    const connection = await getConnection(connectionId);
    if (connection && connection.gameId) {
      // Remove player from game
      await handlePlayerLeave(connection.gameId, connection.playerId, connectionId);
    }
    
    // Remove connection
    await removeConnection(connectionId);
  } catch (error) {
    console.error('Error during disconnect:', error);
  }

  return { statusCode: 200 };
};

const handleCreateGame = async (connectionId, message) => {
  const { playerId, playerData } = message;
  
  // Generate unique game ID
  let gameId = generateGameId();
  let attempts = 0;
  while (attempts < 10) {
    try {
      const existingGame = await getGame(gameId);
      if (!existingGame) break;
      gameId = generateGameId();
      attempts++;
    } catch (error) {
      break; // Game doesn't exist, we can use this ID
    }
  }

  // Create game
  const game = await createGame(gameId, playerId, connectionId);
  
  // Update connection with player and game info
  await updateConnection(connectionId, {
    playerId,
    gameId,
    lastSeen: Date.now()
  });

  // Send response
  await sendMessage(connectionId, {
    type: 'GAME_CREATED',
    gameId,
    gameState: game
  });

  console.log(`Game created: ${gameId} by ${playerId}`);
  return { statusCode: 200 };
};

const handleJoinGame = async (connectionId, message) => {
  const { gameId, playerId, playerData } = message;
  
  // Get game
  const game = await getGame(gameId);
  if (!game) {
    await sendMessage(connectionId, {
      type: 'ERROR',
      message: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
    return { statusCode: 404 };
  }

  // Add player to connected players
  const updatedConnectedPlayers = {
    ...game.connectedPlayers,
    [playerId]: {
      id: playerId,
      connectionId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      ...playerData
    }
  };

  // Update game
  await updateGame(gameId, {
    connectedPlayers: updatedConnectedPlayers,
    lastActionPlayerId: playerId
  });

  // Update connection
  await updateConnection(connectionId, {
    playerId,
    gameId,
    lastSeen: Date.now()
  });

  // Get updated game state
  const updatedGame = await getGame(gameId);

  // Send response to joining player
  await sendMessage(connectionId, {
    type: 'GAME_JOINED',
    gameId,
    gameState: updatedGame
  });

  // Notify other players
  await broadcastToGame(gameId, {
    type: 'PLAYER_JOINED',
    gameId,
    playerId,
    gameState: updatedGame
  }, connectionId);

  console.log(`Player ${playerId} joined game ${gameId}`);
  return { statusCode: 200 };
};

const handleUpdateGameState = async (connectionId, message) => {
  const { gameId, playerId, data } = message;
  
  // Get game
  const game = await getGame(gameId);
  if (!game) {
    await sendMessage(connectionId, {
      type: 'ERROR',
      message: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
    return { statusCode: 404 };
  }

  // Validate permissions and filter updates
  const allowedUpdates = validatePermissions(game, playerId, data);
  if (Object.keys(allowedUpdates).length === 0) {
    await sendMessage(connectionId, {
      type: 'ERROR',
      message: 'No valid updates provided',
      code: 'PERMISSION_DENIED'
    });
    return { statusCode: 403 };
  }

  // Update game
  allowedUpdates.lastActionPlayerId = playerId;
  const updatedGame = await updateGame(gameId, allowedUpdates);

  // Broadcast to all players
  await broadcastToGame(gameId, {
    type: 'GAME_STATE_UPDATE',
    gameId,
    gameState: updatedGame,
    updatedBy: playerId
  });

  console.log(`Game state updated in ${gameId} by ${playerId}`);
  return { statusCode: 200 };
};

const handleUpdatePlayer = async (connectionId, message) => {
  const { gameId, playerId, playerData } = message;
  
  // Get game
  const game = await getGame(gameId);
  if (!game) {
    await sendMessage(connectionId, {
      type: 'ERROR',
      message: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
    return { statusCode: 404 };
  }

  // Check permissions
  if (game.hostId !== playerId && !game.allowGuestNames) {
    await sendMessage(connectionId, {
      type: 'ERROR',
      message: 'Not allowed to update player data',
      code: 'PERMISSION_DENIED'
    });
    return { statusCode: 403 };
  }

  // Update player in players array
  const updatedPlayers = game.players.map(player => 
    player.id === playerData.id 
      ? { ...player, ...playerData }
      : player
  );

  // Update game
  const updatedGame = await updateGame(gameId, {
    players: updatedPlayers,
    lastActionPlayerId: playerId
  });

  // Broadcast update
  await broadcastToGame(gameId, {
    type: 'GAME_STATE_UPDATE',
    gameId,
    gameState: updatedGame,
    updatedBy: playerId
  });

  console.log(`Player updated in ${gameId}: ${playerData.id}`);
  return { statusCode: 200 };
};

const handleLeaveGame = async (connectionId, message) => {
  const { gameId, playerId } = message;
  
  await handlePlayerLeave(gameId, playerId, connectionId);
  return { statusCode: 200 };
};

const handlePlayerLeave = async (gameId, playerId, connectionId) => {
  try {
    const game = await getGame(gameId);
    if (!game) return;

    // Remove from connected players
    const updatedConnectedPlayers = { ...game.connectedPlayers };
    delete updatedConnectedPlayers[playerId];

    // Remove from players array
    const updatedPlayers = game.players.filter(p => p.playerId !== playerId);

    // Check if host left
    if (game.hostId === playerId) {
      const remainingPlayerIds = Object.keys(updatedConnectedPlayers);
      if (remainingPlayerIds.length > 0) {
        // Transfer host to next player
        const newHostId = remainingPlayerIds[0];
        await updateGame(gameId, {
          hostId: newHostId,
          connectedPlayers: updatedConnectedPlayers,
          players: updatedPlayers,
          lastActionPlayerId: playerId
        });
        
        const updatedGame = await getGame(gameId);
        
        // Notify remaining players
        await broadcastToGame(gameId, {
          type: 'PLAYER_LEFT',
          gameId,
          playerId,
          gameState: updatedGame
        });
        
        console.log(`Host transferred to ${newHostId} in game ${gameId}`);
      } else {
        // No players left, delete game
        await deleteGame(gameId);
        console.log(`Game ${gameId} deleted - no players remaining`);
      }
    } else {
      // Regular player left
      await updateGame(gameId, {
        connectedPlayers: updatedConnectedPlayers,
        players: updatedPlayers,
        lastActionPlayerId: playerId
      });
      
      const updatedGame = await getGame(gameId);
      
      // Notify remaining players
      await broadcastToGame(gameId, {
        type: 'PLAYER_LEFT',
        gameId,
        playerId,
        gameState: updatedGame
      });
    }

    console.log(`Player ${playerId} left game ${gameId}`);
  } catch (error) {
    console.error('Error handling player leave:', error);
  }
};

const handlePing = async (connectionId) => {
  await sendMessage(connectionId, {
    type: 'PONG',
    timestamp: Date.now()
  });
  
  return { statusCode: 200 };
};