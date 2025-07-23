import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from 'react-native';

// Web-compatible alert function
const showAlert = (title, message, buttons) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      // For multiple buttons, use confirm for yes/no type dialogs
      const confirmMessage = `${title}\n\n${message}`;
      const confirmed = window.confirm(confirmMessage);
      
      if (confirmed && buttons.find(b => b.style !== 'cancel' && b.style !== 'destructive')) {
        // Execute the non-cancel, non-destructive button (usually the primary action)
        const primaryButton = buttons.find(b => b.style !== 'cancel' && b.style !== 'destructive');
        if (primaryButton && primaryButton.onPress) primaryButton.onPress();
      } else if (confirmed && buttons.find(b => b.style === 'destructive')) {
        // Execute destructive action if confirmed
        const destructiveButton = buttons.find(b => b.style === 'destructive');
        if (destructiveButton && destructiveButton.onPress) destructiveButton.onPress();
      }
    } else {
      // Single button or simple alert
      window.alert(`${title}\n\n${message}`);
      if (buttons && buttons[0] && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

// Firebase configuration and initialization
let firebase = null;
let database = null;

try {
  // Import Firebase functions
  const { initializeApp } = require('firebase/app');
  const { getDatabase, ref, set, update, onValue, get, off, remove } = require('firebase/database');
  
  // Your Firebase configuration using environment variables
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  firebase = { app, database, ref, set, update, onValue, get, off, remove };
  console.log('🔥 Firebase initialized successfully');
} catch (error) {
  console.log('Firebase not available, running in local mode:', error);
}

// 20 selectable player colors
const PLAYER_COLORS = [
  { name: 'Black', value: '#2D3748' },
  { name: 'Red', value: '#E53E3E' },
  { name: 'Green', value: '#38A169' },
  { name: 'Yellow', value: '#D69E2E' },
  { name: 'Purple', value: '#805AD5' },
  { name: 'Blue', value: '#3182CE' },
  { name: 'Orange', value: '#DD6B20' },
  { name: 'Pink', value: '#D53F8C' },
  { name: 'Teal', value: '#319795' },
  { name: 'Cyan', value: '#0BC5EA' },
  { name: 'Indigo', value: '#5A67D8' },
  { name: 'Gray', value: '#718096' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'White', value: '#F7FAFC' }
];

// Auto-sizing logic that ensures no scrolling with multiple rows
const getOptimalLayout = (playerCount, screenWidth = 1200, screenHeight = 800) => {
  // Detect mobile and calculate available screen space
  const isMobile = screenWidth < 768 || window.innerWidth < 768;
  const availableHeight = (isMobile ? window.innerHeight || screenHeight : screenHeight) * 1.0; // Use full screen on mobile
  const availableWidth = (isMobile ? window.innerWidth || screenWidth : screenWidth) * 0.95; // Use 95% of screen width
  
  // Calculate card height based on available space and required rows
  const getCardHeight = (rows) => {
    // On mobile, prioritize player boxes - use almost entire screen
    const reservedHeight = isMobile ? 5 : 200; // Virtually no reserved space on mobile
    const padding = isMobile ? 5 : 20; // Minimal padding for mobile
    return Math.floor((availableHeight - reservedHeight - padding) / rows);
  };
  
  // User requirements: 1-3 players = 1 row, 4-6 players = 2 rows, 7-9 players = 3 rows
  // Use 9-player size as absolute minimum, scale up for fewer players while fitting on screen
  const ninePlayerHeight = getCardHeight(3); // Minimum height for 9 players (3 rows)
  
  if (playerCount <= 1) return { cols: 1, rows: 1, size: 'large', cardHeight: Math.max(ninePlayerHeight, getCardHeight(1)) };
  if (playerCount === 2) return { cols: 2, rows: 1, size: 'large', cardHeight: Math.max(ninePlayerHeight, getCardHeight(1)) };
  if (playerCount === 3) return { cols: 3, rows: 1, size: 'medium', cardHeight: Math.max(ninePlayerHeight, getCardHeight(1)) };
  if (playerCount === 4) return { cols: 2, rows: 2, size: 'medium', cardHeight: Math.max(ninePlayerHeight, getCardHeight(2)) };
  if (playerCount === 5) return { cols: 2, rows: 3, size: 'medium', cardHeight: Math.max(ninePlayerHeight, getCardHeight(3)) };
  if (playerCount === 6) return { cols: 2, rows: 3, size: 'medium', cardHeight: Math.max(ninePlayerHeight, getCardHeight(3)) };
  if (playerCount === 7) return { cols: 3, rows: 3, size: 'compact', cardHeight: ninePlayerHeight };
  if (playerCount === 8) return { cols: 3, rows: 3, size: 'compact', cardHeight: ninePlayerHeight };
  if (playerCount === 9) return { cols: 3, rows: 3, size: 'compact', cardHeight: ninePlayerHeight };
  // For 10+ players, use more compact layout
  if (playerCount <= 12) return { cols: 4, rows: 3, size: 'small', cardHeight: Math.min(90, getCardHeight(3)) };
  if (playerCount <= 15) return { cols: 5, rows: 3, size: 'tiny', cardHeight: Math.min(80, getCardHeight(3)) };
  return { cols: 6, rows: Math.ceil(playerCount / 6), size: 'tiny', cardHeight: Math.min(70, getCardHeight(Math.ceil(playerCount / 6))) };
};

// Screen Components - MUST be outside main component to prevent focus loss
const HomeScreen = ({ 
  theme, 
  gameHistory, 
  createNewGame, 
  setCurrentScreen, 
  setShowSettings,
  deleteGame,
  hasActiveGame,
  returnToGame,
  loadSavedGame
}) => (
  <ScrollView contentContainerStyle={[styles.container, theme === 'light' && styles.lightContainer]}>
    <View style={styles.header}>
      <Text style={[styles.title, theme === 'light' && styles.lightText]}>🎲 Board Game Timer</Text>
      <Text style={[styles.subtitle, theme === 'light' && styles.lightSubtext]}>Track time for every player in your board games</Text>
      <Text style={styles.localStatus}>
        {firebase ? '🔥 Firebase Ready' : '📱 Local Mode'}
      </Text>
    </View>

    <View style={styles.buttonContainer}>
      <TouchableOpacity 
        style={[styles.button, styles.primaryButton, styles.buttonWithFeedback]} 
        onPress={hasActiveGame ? returnToGame : createNewGame}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {hasActiveGame ? '🔄 Return to Game' : '🎮 Create New Game'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton, styles.buttonWithFeedback]} 
        onPress={() => setCurrentScreen('join')}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>📱 Join Existing Game</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.tertiaryButton, styles.buttonWithFeedback]} 
        onPress={() => setCurrentScreen('history')}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>🏆 Game History</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.settingsButton, styles.buttonWithFeedback]} 
        onPress={() => setShowSettings(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>⚙️ Settings</Text>
      </TouchableOpacity>
    </View>

    {gameHistory.length > 0 && (
      <View style={[styles.recentGames, theme === 'light' && styles.lightCard]}>
        <Text style={[styles.sectionTitle, theme === 'light' && styles.lightText]}>Recent Games</Text>
        {gameHistory.slice(0, 3).map(game => (
          <View key={game.id} style={styles.gameHistoryItem}>
            <View style={styles.gameHistoryText}>
              <Text style={[styles.gameName, theme === 'light' && styles.lightText]}>{game.name}</Text>
              <Text style={[styles.gameDate, theme === 'light' && styles.lightSubtext]}>{new Date(game.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.gameHistoryActions}>
              <TouchableOpacity 
                style={styles.continueGameButton}
                onPress={() => loadSavedGame(game, true)}
              >
                <Text style={styles.continueGameText}>▶️</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.continueGameButton, {backgroundColor: '#10b981', marginLeft: 4}]}
                onPress={() => loadSavedGame(game, false)}
              >
                <Text style={styles.continueGameText}>🎮</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteGameButton, {marginLeft: 4}]}
                onPress={() => deleteGame(game.id)}
              >
                <Text style={styles.deleteGameText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    )}
  </ScrollView>
);

const JoinGameScreen = ({ 
  joinGameId, 
  handleJoinGameIdChange, 
  joinGame, 
  setCurrentScreen,
  theme
}) => (
  <ScrollView contentContainerStyle={[styles.container, theme === 'light' && styles.lightContainer]}>
    <View style={styles.header}>
      <Text style={[styles.title, theme === 'light' && styles.lightText]}>📱 Join Game</Text>
      <Text style={[styles.subtitle, theme === 'light' && styles.lightSubtext]}>Enter the 6-character game ID to join</Text>
    </View>

    <View style={styles.inputContainer}>
      <TextInput
        key="join-game-input"
        style={styles.input}
        placeholder="Enter Game ID (e.g. ABC123)"
        placeholderTextColor="#999"
        value={joinGameId}
        onChangeText={handleJoinGameIdChange}
        maxLength={6}
        autoCapitalize="characters"
        autoComplete="off"
        selectTextOnFocus={true}
      />
      
      <TouchableOpacity 
        style={[styles.button, styles.primaryButton, !joinGameId.trim() && styles.disabledButton]} 
        onPress={joinGame}
        disabled={!joinGameId.trim()}
      >
        <Text style={styles.buttonText}>Join Game</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setCurrentScreen('home')}>
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
);

const GameHistoryScreen = ({ gameHistory, setCurrentScreen, formatTime, deleteGame, loadSavedGame, theme }) => (
  <ScrollView contentContainerStyle={[styles.container, theme === 'light' && styles.lightContainer]}>
    <View style={styles.headerRow}>
      <Text style={[styles.title, theme === 'light' && styles.lightText]}>🏆 Game History</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
        <Text style={styles.backButtonText}>🏠 Home</Text>
      </TouchableOpacity>
    </View>

    {gameHistory.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, theme === 'light' && styles.lightText]}>No games saved yet</Text>
        <Text style={[styles.emptySubtitle, theme === 'light' && styles.lightSubtext]}>Play a game and save it to see it here!</Text>
      </View>
    ) : (
      <View style={styles.historyList}>
        {gameHistory.map(game => (
          <View key={game.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={styles.historyHeaderText}>
                <Text style={[styles.historyGameName, theme === 'light' && styles.lightText]}>{game.name}</Text>
                <Text style={[styles.historyDate, theme === 'light' && styles.lightSubtext]}>{new Date(game.date).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteGameButton}
                onPress={() => deleteGame(game.id)}
              >
                <Text style={styles.deleteGameText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.historyTotal, theme === 'light' && styles.lightText]}>
              Total Time: {formatTime(game.totalTime)} | Game ID: {game.gameId || 'local'}
            </Text>
            
            {(game.totalTurns || game.formattedAverageTurnTime) && (
              <View style={styles.historyStats}>
                {game.totalTurns && (
                  <Text style={[styles.historyStatText, theme === 'light' && styles.lightSubtext]}>
                    🎯 Total Turns: {game.totalTurns}
                  </Text>
                )}
                {game.formattedAverageTurnTime && (
                  <Text style={[styles.historyStatText, theme === 'light' && styles.lightSubtext]}>
                    ⏱️ Avg Turn: {game.formattedAverageTurnTime}
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.historyPlayers}>
              {game.players.map((player, idx) => (
                <View key={idx} style={styles.historyPlayerRow}>
                  <Text style={styles.historyPlayer}>
                    {player.name}: {player.formattedTime}
                  </Text>
                  {(player.turns > 0 || player.formattedAvgTurnTime) && (
                    <Text style={styles.historyPlayerStats}>
                      ({player.turns} turns, avg: {player.formattedAvgTurnTime || '0:00'})
                    </Text>
                  )}
                </View>
              ))}
            </View>
            
            <View style={styles.historyActions}>
              <TouchableOpacity 
                style={styles.continueGameButton}
                onPress={() => loadSavedGame(game, true)}
              >
                <Text style={styles.continueGameText}>▶️ Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.continueGameButton, {backgroundColor: '#10b981', marginLeft: 8}]}
                onPress={() => loadSavedGame(game, false)}
              >
                <Text style={styles.continueGameText}>🎮 New Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    )}
  </ScrollView>
);

const GameScreen = ({
  gameId,
  firebase,
  connectionStatus,
  shareGame,
  setShowSettings,
  setCurrentScreen,
  currentGameName,
  handleGameNameChange,
  addPlayer,
  isRunning,
  activePlayerId,
  resumeGame,
  gameStarted,
  pauseGame,
  nextPlayer,
  saveGame,
  resetGame,
  finishGame,
  leaveGame,
  players,
  getPlayerGridCols,
  showColorPicker,
  setShowColorPicker,
  handlePlayerNameChange,
  removePlayer,
  PLAYER_COLORS,
  updatePlayerColor,
  updatePlayerName,
  tempPlayerName,
  setTempPlayerName,
  timerMode,
  formatTime,
  getAverageTurnTime,
  getOverallAverageTime,
  startPlayerTurn,
  lastActionState,
  undoLastAction,
  isHostUser,
  lastActivePlayerId,
  editingPlayerId,
  setEditingPlayerId,
  connectedPlayers,
  copyNotificationVisible,
  getPlayerCardHeight,
  theme
}) => (
  <ScrollView style={[styles.container, theme === 'light' && styles.lightContainer]} contentContainerStyle={styles.scrollContent}>
    <View style={styles.headerRow}>
      <View>
        <Text style={[styles.title, theme === 'light' && styles.lightText]}>
          {gameId ? `Game: ${gameId}` : '🎲 Board Game Timer'}
        </Text>
        {firebase && gameId && (
          <View>
            <Text style={[
              styles.connectionStatus,
              connectionStatus === 'connected' && styles.connectedStatus,
              connectionStatus === 'connecting' && styles.connectingStatus,
              connectionStatus === 'error' && styles.errorStatus
            ]}>
              {connectionStatus === 'connected' && `🔥 Connected (${Object.keys(connectedPlayers).length} players)`}
              {connectionStatus === 'connecting' && '⏳ Connecting...'}
              {connectionStatus === 'error' && '❌ Connection Error'}
              {connectionStatus === 'local' && '💾 Local Mode'}
              {connectionStatus === 'offline' && '📱 Offline'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.headerButtons}>
        {gameId && (
          <TouchableOpacity style={styles.shareButton} onPress={shareGame}>
            <Text style={styles.shareButtonText}>📤 Share</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.settingsIconButton} onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsIconText}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
      </View>
    </View>

    {copyNotificationVisible && (
      <View style={styles.copyNotification}>
        <Text style={styles.copyNotificationText}>📋 Copied!</Text>
      </View>
    )}

    <TextInput
      key="game-name-input"
      style={[styles.gameNameInput, theme === 'light' && styles.lightInput]}
      placeholder="Enter game name (optional)"
      placeholderTextColor={theme === 'light' ? "#666" : "#999"}
      value={currentGameName}
      onChangeText={handleGameNameChange}
      autoComplete="off"
      selectTextOnFocus={true}
      maxLength={50}
    />

    <View style={styles.controlsContainer}>
      <TouchableOpacity 
        style={[styles.controlButton, players.length >= 9 ? styles.disabledButton : styles.addButton]} 
        onPress={players.length >= 9 ? null : addPlayer}
        disabled={players.length >= 9}
      >
        <Text style={styles.controlButtonText}>
          {players.length >= 9 ? '🚫 Max Players Reached' : '➕ Add Player'}
        </Text>
      </TouchableOpacity>
      
      {!isRunning ? (
        <TouchableOpacity 
          style={[styles.controlButton, styles.playButton, (activePlayerId === null && lastActivePlayerId === null) && styles.disabledButton]} 
          onPress={resumeGame}
          disabled={activePlayerId === null && lastActivePlayerId === null}
        >
          <Text style={styles.controlButtonText}>
            ▶️ {gameStarted ? 'Resume' : 'Start'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={[styles.controlButton, styles.pauseButton]} 
          onPress={pauseGame}
        >
          <Text style={styles.controlButtonText}>⏸️ Pause</Text>
        </TouchableOpacity>
      )}
      
      {gameStarted && (
        <>
          <TouchableOpacity style={[styles.controlButton, styles.saveButton]} onPress={saveGame}>
            <Text style={styles.controlButtonText}>💾 Save</Text>
          </TouchableOpacity>
          {isHostUser && (
            <TouchableOpacity style={[styles.controlButton, styles.finishButton]} onPress={finishGame}>
              <Text style={styles.controlButtonText}>🏁 Finish</Text>
            </TouchableOpacity>
          )}
          {lastActionState && (
            <TouchableOpacity style={[styles.controlButton, styles.undoButton]} onPress={undoLastAction}>
              <Text style={styles.controlButtonText}>↶ Undo</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      
      {isHostUser && (
        <TouchableOpacity 
          style={[styles.controlButton, styles.resetButton]} 
          onPress={resetGame}
        >
          <Text style={styles.controlButtonText}>🔄 Reset</Text>
        </TouchableOpacity>
      )}
      
      {gameId && firebase && (
        <TouchableOpacity 
          style={[styles.controlButton, styles.leaveButton]} 
          onPress={leaveGame}
        >
          <Text style={styles.controlButtonText}>🚪 Leave Game</Text>
        </TouchableOpacity>
      )}
    </View>

    <View style={[styles.playersGrid, { 
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 4
    }]}>
      {players.map((player) => {
        return (
          <View
            key={player.id}
            style={[
              styles.playerCard,
              { 
                backgroundColor: player.color + '30', 
                borderColor: player.color,
                borderWidth: player.isActive ? 4 : 2,
              },
              player.isActive && { backgroundColor: player.color + '40' },
              { 
                width: getPlayerGridCols() === 1 ? '95%' : 
                       getPlayerGridCols() === 2 ? '48%' : 
                       getPlayerGridCols() === 3 ? '32%' : 
                       getPlayerGridCols() === 4 ? '24%' : 
                       getPlayerGridCols() === 5 ? '19%' : '16%',
                marginBottom: 6,
                marginHorizontal: 1,
                height: getPlayerCardHeight(),
                flexBasis: getPlayerGridCols() === 1 ? '95%' : 
                          getPlayerGridCols() === 2 ? '48%' : 
                          getPlayerGridCols() === 3 ? '32%' : 
                          getPlayerGridCols() === 4 ? '24%' : 
                          getPlayerGridCols() === 5 ? '19%' : '16%',
                flexShrink: 0,
                flexGrow: 0,
                overflow: 'hidden'
              }
            ]}
          >
            {/* Row 1: Color + Delete Controls */}
            <View style={[
              styles.playerControlsRow,
              (typeof window !== 'undefined' && window.innerWidth < 768) && styles.playerControlsRowMobile
            ]}>
              {(typeof window !== 'undefined' && window.innerWidth < 768) ? (
                // Mobile compact layout - centered controls
                <View style={styles.playerControlsCompact}>
                  <TouchableOpacity 
                    style={[styles.colorButtonCompact, { backgroundColor: player.color }]}
                    onPress={() => setShowColorPicker(showColorPicker === player.id ? null : player.id)}
                  >
                    <Text style={styles.colorButtonTextCompact}>🎨</Text>
                  </TouchableOpacity>
                  {players.length > 2 && (
                    <TouchableOpacity 
                      onPress={() => {
                        console.log('Delete button pressed for player:', player.id);
                        removePlayer(player.id);
                      }}
                      style={styles.removeButtonTouchArea}
                    >
                      <Text style={styles.removeButtonCompact}>❌</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                // Desktop: Compact traditional layout - name input with controls on same row
                <View style={styles.playerNameContainer}>
                  <TextInput
                    key={`player-name-${player.id}`}
                    style={[
                      styles.playerNameInput,
                      theme === 'light' && styles.lightPlayerNameInput,
                      {
                        fontSize: player.name.length > 15 ? (player.name.length > 20 ? 12 : 14) : 16,
                        lineHeight: player.name.length > 15 ? (player.name.length > 20 ? 14 : 16) : 20,
                      }
                    ]}
                    value={editingPlayerId === player.id ? tempPlayerName : player.name}
                    onChangeText={handlePlayerNameChange(player.id)}
                    onFocus={() => {
                      setEditingPlayerId(player.id);
                      setTempPlayerName(player.name); // Initialize temp name with current name
                    }}
                    onBlur={(e) => {
                      const finalName = tempPlayerName.trim() || player.name;
                      setEditingPlayerId(null);
                      
                      // Only update if name actually changed
                      if (finalName !== player.name) {
                        console.log('Final name sync on blur for player:', player.id, finalName);
                        updatePlayerName(player.id, finalName);
                      }
                      setTempPlayerName(''); // Clear temp name
                    }}
                    autoComplete="off"
                    selectTextOnFocus={true}
                    editable={true}
                    maxLength={24}
                    multiline={false}
                    scrollEnabled={false}
                    placeholder="Enter player name"
                    placeholderTextColor={theme === 'light' ? "#666" : "rgba(255, 255, 255, 0.5)"}
                  />
                  <View style={styles.playerHeader}>
                    <View style={styles.playerControls}>
                      <TouchableOpacity 
                        style={[styles.colorButton, { backgroundColor: player.color }]}
                        onPress={() => setShowColorPicker(showColorPicker === player.id ? null : player.id)}
                      >
                        <Text style={styles.colorButtonText}>🎨</Text>
                      </TouchableOpacity>
                      {players.length > 2 && (
                        <TouchableOpacity onPress={() => removePlayer(player.id)}>
                          <Text style={styles.removeButton}>❌</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>
            
            {showColorPicker === player.id && (
              <View style={[
                styles.colorPicker,
                (typeof window !== 'undefined' && window.innerWidth < 768) && styles.colorPickerMobile
              ]}>
                <Text style={[
                  styles.colorPickerTitle,
                  (typeof window !== 'undefined' && window.innerWidth < 768) && styles.colorPickerTitleMobile
                ]}>Choose Color:</Text>
                <View style={[
                  styles.colorGrid,
                  (typeof window !== 'undefined' && window.innerWidth < 768) && styles.colorGridMobile
                ]}>
                  {PLAYER_COLORS.map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorOption,
                        (typeof window !== 'undefined' && window.innerWidth < 768) && styles.colorOptionMobile,
                        { backgroundColor: color.value },
                        player.color === color.value && styles.selectedColor
                      ]}
                      onPress={() => {
                        console.log('Color picker clicked for player:', player.id, 'color:', color.value);
                        updatePlayerColor(player.id, color.value);
                        setShowColorPicker(null);
                        console.log('Color picker closed, sync should have started');
                      }}
                    >
                      {player.color === color.value && (
                        <Text style={[
                          styles.selectedColorCheck,
                          (typeof window !== 'undefined' && window.innerWidth < 768) && styles.selectedColorCheckMobile
                        ]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            {(typeof window !== 'undefined' && window.innerWidth < 768) ? (
              // Mobile: 5-row layout
              <>
                {/* Row 2: Player Name */}
                <View style={styles.playerNameRowMobile}>
                  {editingPlayerId === player.id ? (
                    <TextInput
                      key={`mobile-player-name-${player.id}`}
                      style={[styles.playerNameInputMobile, styles.playerNameInputMobileLarge]}
                      value={tempPlayerName}
                      onChangeText={(text) => {
                        console.log('Name changing:', player.id, text);
                        handlePlayerNameChange(player.id)(text);
                      }}
                      onBlur={() => {
                        const finalName = tempPlayerName.trim() || player.name;
                        console.log('Name input blur, final name:', finalName);
                        
                        // Only update if name actually changed
                        if (finalName !== player.name) {
                          updatePlayerName(player.id, finalName);
                        }
                        setTimeout(() => {
                          setEditingPlayerId(null);
                          setTempPlayerName('');
                        }, 150);
                      }}
                      onSubmitEditing={() => {
                        const finalName = tempPlayerName.trim() || player.name;
                        console.log('Name submit, final name:', finalName);
                        
                        // Only update if name actually changed
                        if (finalName !== player.name) {
                          updatePlayerName(player.id, finalName);
                        }
                        setEditingPlayerId(null);
                        setTempPlayerName('');
                      }}
                      autoFocus={true}
                      selectTextOnFocus={true}
                      placeholder={`Player ${player.id}`}
                      placeholderTextColor="#888"
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  ) : (
                    <TouchableOpacity 
                      onPress={() => {
                        console.log('Starting edit for player:', player.id);
                        setEditingPlayerId(player.id);
                        setTempPlayerName(player.name || ''); // Initialize temp name
                      }} 
                      style={styles.playerNameTouchArea}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.playerNameTextMobileLarge}>
                        {player.name || `Player ${player.id}`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Row 3: Timer */}
                <View style={styles.timerSectionCompact}>
                  <Text style={[styles.timeDisplay, styles.timeDisplayCompact]}>
                    {formatTime(player.time)}
                  </Text>
                </View>
                
                {/* Row 4: Start Button */}
                <View style={styles.playerButtonSectionMobile}>
                  <TouchableOpacity
                    style={[styles.playerButton, styles.playerButtonMobileSquare, {
                      backgroundColor: player.isActive && isRunning ? '#ef4444' : player.isActive && !isRunning ? '#f59e0b' : '#10b981',
                    }]}
                    onPress={() => startPlayerTurn(player.id)}
                  >
                    <Text style={[styles.playerButtonText, styles.playerButtonTextMobileSquare, { color: '#ffffff', fontWeight: 'bold' }]}>
                      {player.isActive && isRunning ? '⏸️' : player.isActive && !isRunning ? '▶️' : 'Play'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Row 5: Stats */}
                <View style={styles.playerStatsBottom}>
                  <Text style={styles.statTextMobile}>🎯 {player.turns || 0}</Text>
                  <Text style={styles.statTextMobile}>⏱️ {formatTime(getAverageTurnTime(player))}</Text>
                </View>
              </>
            ) : (
              // Desktop: Compact integrated layout
              <>
                <View style={styles.timerSection}>
                  <Text style={[
                    styles.timeDisplay,
                    timerMode === 'countdown' && player.time <= 60 && styles.urgentTime,
                  ]}>
                    {formatTime(player.time)}
                  </Text>
                  {timerMode === 'countdown' && player.time <= 60 && player.time > 0 && (
                    <Text style={styles.urgentText}>TIME RUNNING OUT!</Text>
                  )}
                </View>
                
                <View style={styles.playerButtonSection}>
                  <TouchableOpacity
                    style={[styles.playerButton, {
                      backgroundColor: player.isActive && isRunning ? '#ef4444' : player.isActive && !isRunning ? '#f59e0b' : '#10b981',
                      elevation: 4,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      borderWidth: 2,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }]}
                    onPress={() => startPlayerTurn(player.id)}
                  >
                    <Text style={[styles.playerButtonText, { color: '#ffffff', fontWeight: 'bold' }]}>
                      {player.isActive && isRunning ? '⏸️' : player.isActive && !isRunning ? '▶️' : 'Play'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.playerStats}>
                  <Text style={styles.statText}>🎯 Turns: {player.turns || 0}</Text>
                  <Text style={styles.statText}>⏱️ Avg: {formatTime(getAverageTurnTime(player))}</Text>
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>

    {gameStarted && (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>📊 Game Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Time</Text>
            <Text style={styles.statValue}>
              {formatTime(players.reduce((sum, p) => sum + p.time, 0))}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Active Player</Text>
            <Text style={styles.statValue}>
              {activePlayerId ? players.find(p => p.id === activePlayerId)?.name : 'None'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Players</Text>
            <Text style={styles.statValue}>{players.length}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg Turn Time</Text>
            <Text style={styles.statValue}>
              {formatTime(getOverallAverageTime())}
            </Text>
          </View>
        </View>
      </View>
    )}
  </ScrollView>
);

const BoardGameTimer = () => {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [testInput, setTestInput] = useState('Type here to test');
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', time: 0, isActive: false, color: PLAYER_COLORS[0].value, turns: 0, totalTurnTime: 0, turnStartTime: null },
    { id: 2, name: 'Player 2', time: 0, isActive: false, color: PLAYER_COLORS[1].value, turns: 0, totalTurnTime: 0, turnStartTime: null }
  ]);
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timerMode, setTimerMode] = useState('countup');
  const [initialTime, setInitialTime] = useState(600);
  const [gameHistory, setGameHistory] = useState([]);
  const [currentGameName, setCurrentGameName] = useState('');
  const [gameId, setGameId] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('offline');
  const [playerBoxSize, setPlayerBoxSize] = useState('auto');
  const [copyNotificationVisible, setCopyNotificationVisible] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('boardgame_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [playTurnSounds, setPlayTurnSounds] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [lastActionState, setLastActionState] = useState(null); // For undo functionality
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [allowGuestControl, setAllowGuestControl] = useState(true); // Default to allowing guest controls
  const [allowGuestNames, setAllowGuestNames] = useState(true); // Default to allowing guest names
  const [isHostUser, setIsHostUser] = useState(true);
  const [lastActivePlayerId, setLastActivePlayerId] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null); // Track which player is being edited
  const [tempPlayerName, setTempPlayerName] = useState(''); // Track temporary name during editing
  const [authoritativeTimerPlayerId, setAuthoritativeTimerPlayerId] = useState(null); // Track who owns the current timer
  
  const [showColorPicker, setShowColorPicker] = useState(null);
  
  const intervalRef = useRef();
  const gameRef = useRef(null);
  // Generate or restore persistent playerId for host recognition
  const generateOrRestorePlayerId = (gameId) => {
    if (gameId) {
      const savedPlayerId = localStorage.getItem(`playerId_${gameId}`);
      if (savedPlayerId) {
        return savedPlayerId;
      }
    }
    return `player_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  };
  
  const playerId = useRef(generateOrRestorePlayerId());
  
  // Update playerId when gameId changes to maintain host status
  useEffect(() => {
    if (gameId) {
      const savedPlayerId = localStorage.getItem(`playerId_${gameId}`);
      if (savedPlayerId) {
        playerId.current = savedPlayerId;
      }
    }
  }, [gameId]);
  const gameNameDebounceRef = useRef();
  const joinGameIdDebounceRef = useRef();
  const playerNameDebounceRefs = useRef({});
  const nameChangeTimeoutRef = useRef(); // For real-time name changes
  const playerClickTimeoutRef = useRef(); // For debouncing rapid player clicks
  const processingPlayerTurnRef = useRef(false); // Prevent concurrent player turn changes
  const autoSaveRef = useRef();
  const lastActiveTimeRef = useRef(Date.now());
  const wasRunningRef = useRef(false);
  const lastLocalActionRef = useRef(0); // Track when local actions happen
  const ignoreUpdatesUntilRef = useRef(0); // Ignore Firebase updates for a short time after local actions
  const lastSaveTimeRef = useRef(0); // Track when last save happened to prevent spam

  // Auto-save state every 3 minutes (180 seconds) - good balance of usefulness vs performance
  useEffect(() => {
    if (gameStarted) {
      autoSaveRef.current = setInterval(() => {
        autoSaveGameState();
      }, 180000); // Auto-save every 3 minutes
    }
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [gameStarted]); // Only restart auto-save when game starts/ends, not on every state change

  // Load saved state on app start
  useEffect(() => {
    loadSavedState();
    loadGameHistory();
  }, []);

  // Handle page visibility for background timer support - simplified for mobile
  useEffect(() => {
    if (typeof document === 'undefined') return; // Skip on mobile if needed
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastActiveTimeRef.current = Date.now();
        wasRunningRef.current = isRunning;
      } else if (wasRunningRef.current && activePlayerId && gameStarted) {
        const timeAway = Math.floor((Date.now() - lastActiveTimeRef.current) / 1000);
        if (timeAway > 1) { // Only update if significant time passed
          setPlayers(prev => prev.map(player => 
            player.id === activePlayerId ? {
              ...player,
              time: timerMode === 'countup' ? player.time + timeAway : Math.max(0, player.time - timeAway)
            } : player
          ));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, activePlayerId, gameStarted, timerMode]);

  // Timer effect with higher precision
  useEffect(() => {
    if (isRunning && activePlayerId !== null) {
      intervalRef.current = setInterval(() => {
        setPlayers(prev => {
          const updated = prev.map(player => {
            if (player.id === activePlayerId) {
              // Use 0.1 second increments for more precise tracking
              const increment = timerMode === 'countup' ? 0.1 : -0.1;
              const newPreciseTime = (player.preciseTime || player.time) + increment;
              const clampedPreciseTime = timerMode === 'countup' 
                ? Math.min(28800, Math.max(0, newPreciseTime))
                : Math.max(0, newPreciseTime);
              
              return { 
                ...player, 
                preciseTime: clampedPreciseTime,
                time: Math.floor(clampedPreciseTime) // Display time remains whole seconds
              };
            }
            return player;
          });
          
          // Always return updated to ensure timer continues
          return updated;
        });
      }, 100); // 100ms intervals for smoother precision
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, activePlayerId, timerMode]);


  // Firebase game state sync effect - simplified for mobile
  const lastSyncRef = useRef('');
  const syncTimeoutRef = useRef();
  
  useEffect(() => {
    if (firebase && gameId && isHost) {
      // Debounce all syncs to prevent loops - only sync on initial host/game changes
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 500);
    }
    
    return () => clearTimeout(syncTimeoutRef.current);
  }, [gameId, isHost]); // Minimal dependencies - only sync on host/game changes
  
  // Separate effect for timer state changes - only sync when we own the timer
  const timerSyncTimeoutRef = useRef();
  const lastSyncedTimerState = useRef({ activePlayerId: null, isRunning: false });
  
  useEffect(() => {
    if (firebase && gameId && gameStarted && authoritativeTimerPlayerId === playerId.current) {
      // Only sync if the timer state actually changed to prevent feedback loops
      const currentState = { activePlayerId, isRunning };
      const hasChanged = 
        currentState.activePlayerId !== lastSyncedTimerState.current.activePlayerId ||
        currentState.isRunning !== lastSyncedTimerState.current.isRunning;
      
      if (hasChanged) {
        clearTimeout(timerSyncTimeoutRef.current);
        timerSyncTimeoutRef.current = setTimeout(() => {
          syncGameStateToFirebase();
          lastSyncedTimerState.current = currentState;
        }, 1000); // Reduced delay but only sync when we own the timer
      }
    }
    
    return () => clearTimeout(timerSyncTimeoutRef.current);
  }, [activePlayerId, isRunning, authoritativeTimerPlayerId, playerId.current]); // Timer changes sync only from timer owner

  // Text changes sync - more responsive (removed settings to prevent game resets)
  const gameNameTimeoutRef = useRef();
  useEffect(() => {
    if (firebase && gameId && isHost) {
      clearTimeout(gameNameTimeoutRef.current);
      gameNameTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 500); // Faster sync for text changes
    }
    
    return () => clearTimeout(gameNameTimeoutRef.current);
  }, [currentGameName]); // Only sync on game name changes, not settings

  // Immediate sync for player count changes (add/remove) - not for timer updates
  const playerCountTimeoutRef = useRef();
  const lastPlayerCount = useRef(players.length);
  useEffect(() => {
    if (firebase && gameId && players.length !== lastPlayerCount.current) {
      // Only sync when player count actually changes, not on timer updates
      lastPlayerCount.current = players.length;
      clearTimeout(playerCountTimeoutRef.current);
      playerCountTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 100); // Quick sync for player changes but not immediate
    }
  }, [players.length, firebase, gameId]); // Only depend on count, not full players array

  // Firebase listener effect
  useEffect(() => {
    if (firebase && gameId) {
      const unsubscribe = listenToGameChanges();
      syncPlayerJoin();
      
      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [gameId]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const generateGameId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createNewGame = async () => {
    // Check if already in a game and prevent multiple concurrent games
    if (gameId && firebase) {
      showAlert(
        'Already in Game',
        'You are already hosting or joined a game. Finish or leave the current game first.',
        [
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }

    const newGameId = generateGameId();
    setGameId(newGameId);
    setIsHost(true);
    setIsHostUser(true);
    setAllowGuestControl(true); // Allow guests to control timers by default
    setAllowGuestNames(true); // Allow guests to edit names/colors by default
    setCurrentScreen('game');
    
    // Save playerId for this game to maintain host status
    localStorage.setItem(`playerId_${newGameId}`, playerId.current);
    
    // Reset all state for fresh game
    setIsRunning(false);
    setActivePlayerId(null);
    setLastActivePlayerId(null);
    setGameStarted(false);
    setCurrentGameName('');
    setPlayers([
      { id: 1, name: 'Player 1', time: 0, isActive: false, color: PLAYER_COLORS[0].value, turns: 0, totalTurnTime: 0, turnStartTime: null },
      { id: 2, name: 'Player 2', time: 0, isActive: false, color: PLAYER_COLORS[1].value, turns: 0, totalTurnTime: 0, turnStartTime: null }
    ]);
    
    if (firebase) {
      setConnectionStatus('connecting');
      Alert.alert('Game Created!', `Game ID: ${newGameId}\n🔥 Firebase multiplayer enabled!`);
    } else {
      Alert.alert('Game Created!', `Game ID: ${newGameId}\n📱 Running in local mode.`);
    }
  };

  const joinGame = async () => {
    if (!joinGameId.trim()) return;
    
    // Check if already in a game and prevent multiple concurrent games
    if (gameId && firebase) {
      showAlert(
        'Already in Game',
        'You are already in a game. Finish or leave the current game first.',
        [
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }
    
    const gameIdToJoin = joinGameId.trim().toUpperCase();
    
    // Validate game ID format (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(gameIdToJoin)) {
      Alert.alert('Invalid Game ID', 'Game ID must be exactly 6 characters (letters and numbers only).');
      return;
    }
    
    if (firebase) {
      setConnectionStatus('connecting');
      
      // Try to load existing game data
      try {
        const gameRef = firebase.ref(firebase.database, `games/${gameIdToJoin}`);
        const snapshot = await firebase.get(gameRef);
        
        if (snapshot.exists()) {
          // Game exists, join it
          const savedPlayerId = localStorage.getItem(`playerId_${gameIdToJoin}`);
          if (savedPlayerId) {
            playerId.current = savedPlayerId;
          } else {
            // Save new playerId for future sessions
            localStorage.setItem(`playerId_${gameIdToJoin}`, playerId.current);
          }
          
          setGameId(gameIdToJoin);
          setIsHost(false);
          setIsHostUser(false);
          setCurrentScreen('game');
          Alert.alert('Joined Game!', `🔥 Connected to multiplayer game: ${gameIdToJoin}`);
        } else {
          // Game doesn't exist
          Alert.alert('Game Not Found', `No active game found with ID: ${gameIdToJoin}. Please check the ID or ask the host to share the correct code.`);
          setConnectionStatus('offline');
        }
      } catch (error) {
        console.log('Error loading game:', error);
        Alert.alert('Connection Error', 'Failed to connect to the game. Please try again.');
        setConnectionStatus('error');
      }
    } else {
      // Local mode - just set the ID without validation
      setGameId(gameIdToJoin);
      setIsHost(false);
      setIsHostUser(false);
      setCurrentScreen('game');
      Alert.alert('Joined Game!', `📱 Playing locally with ID: ${gameIdToJoin}`);
    }
  };

  const shareGame = async () => {
    if (gameId) {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(gameId);
          setCopyNotificationVisible(true);
          setTimeout(() => setCopyNotificationVisible(false), 2000);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = gameId;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setCopyNotificationVisible(true);
          setTimeout(() => setCopyNotificationVisible(false), 2000);
        }
      } catch (error) {
        console.log('Copy failed:', error);
        const modeText = firebase && isOnline 
          ? '🔥 Multiplayer enabled with Firebase!'
          : '📱 Running in local mode.';
        const shareText = `Game ID: ${gameId}\n\n${modeText}`;
        alert(`Share Game: ${shareText}`);
      }
    }
  };

  // Input sanitization and validation
  const sanitizeGameData = (data) => {
    return {
      players: (data.players || []).slice(0, 9).map((p, index) => ({
        id: (typeof p.id === 'number' && p.id > 0) ? Math.min(100, p.id) : (index + 1), // Preserve original IDs, fallback to index-based
        name: String(p.name || '').substring(0, 50).replace(/[<>\"'&]/g, ''),
        time: Math.max(0, Math.min(28800, parseInt(p.time) || 0)),
        isActive: Boolean(p.isActive),
        color: String(p.color || '#2D3748').match(/^#[0-9A-Fa-f]{6}$/) ? p.color : '#2D3748',
        turns: Math.max(0, Math.min(1000, parseInt(p.turns) || 0)),
        totalTurnTime: Math.max(0, Math.min(28800000, parseInt(p.totalTurnTime) || 0)),
        turnStartTime: p.turnStartTime ? Math.max(0, parseInt(p.turnStartTime)) : null
      })),
      activePlayerId: data.activePlayerId ? Math.max(1, Math.min(100, parseInt(data.activePlayerId))) : null,
      isRunning: Boolean(data.isRunning),
      gameStarted: Boolean(data.gameStarted),
      timerMode: ['countup', 'countdown'].includes(data.timerMode) ? data.timerMode : 'countup',
      initialTime: Math.max(60, Math.min(28800, parseInt(data.initialTime) || 600)),
      currentGameName: String(data.currentGameName || '').substring(0, 50).replace(/[<>\"'&]/g, ''),
      lastUpdated: Date.now(),
      lastActionPlayerId: String(data.lastActionPlayerId || '').substring(0, 100),
      authoritativeTimerPlayerId: data.authoritativeTimerPlayerId ? String(data.authoritativeTimerPlayerId).substring(0, 100) : null,
      allowGuestControl: Boolean(data.allowGuestControl),
      allowGuestNames: Boolean(data.allowGuestNames)
    };
  };

  // Firebase sync functions with local fallback
  const syncGameStateToFirebase = async () => {
    if (!gameId) return;
    
    const rawGameData = {
      players,
      activePlayerId,
      isRunning,
      gameStarted,
      timerMode,
      initialTime,
      currentGameName,
      lastUpdated: Date.now(),
      lastActionPlayerId: playerId.current, // Track who made the last action
      authoritativeTimerPlayerId: authoritativeTimerPlayerId, // Track who owns the current timer
      allowGuestControl,
      allowGuestNames
    };
    
    // Sanitize data before sending to Firebase
    const gameData = sanitizeGameData(rawGameData);

    // Always set hostId - either this player's ID if they're host, or preserve existing
    if (isHost) {
      gameData.hostId = playerId.current;
    } else {
      // For guests, fetch current hostId from Firebase to preserve it
      try {
        const currentGameRef = firebase.ref(firebase.database, `games/${gameId}/hostId`);
        const hostSnapshot = await firebase.get(currentGameRef);
        if (hostSnapshot.exists()) {
          gameData.hostId = hostSnapshot.val();
        }
      } catch (error) {
        console.log('Could not preserve hostId:', error);
      }
    }

    if (firebase && firebase.database) {
      try {
        if (isHost) {
          // Host can set the entire game data including hostId
          await firebase.set(firebase.ref(firebase.database, `games/${gameId}`), gameData);
        } else {
          // Guests use update to avoid overwriting hostId
          const gameRef = firebase.ref(firebase.database, `games/${gameId}`);
          await firebase.update(gameRef, gameData);
        }
        setConnectionStatus('connected');
        setIsOnline(true);
        return;
      } catch (error) {
        console.log('Firebase sync error, falling back to local mode:', error);
        setConnectionStatus('error');
        setIsOnline(false);
      }
    }
    
    // Local mode fallback - store in localStorage
    try {
      localStorage.setItem(`game_${gameId}`, JSON.stringify(gameData));
      setConnectionStatus('local');
    } catch (error) {
      console.log('Local storage error:', error);
      setConnectionStatus('offline');
    }
  };

  const addPlayer = () => {
    // Check max player limit
    if (players.length >= 9) {
      Alert.alert('Player Limit', 'Maximum 9 players allowed.');
      return;
    }
    
    // Allow adding players while timer is running (no pause needed)
    
    // Check guest permissions for adding players
    if (!isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest control.');
      return;
    }
    
    // Mark this as a local action for optimistic updates
    markLocalAction();
    
    saveStateForUndo(); // Save state for undo
    const newId = Math.max(...players.map(p => p.id)) + 1;
    const initialPlayerTime = timerMode === 'countdown' && !gameStarted ? initialTime : 0;
    const newPlayer = {
      id: newId,
      name: `Player ${newId}`,
      time: initialPlayerTime,
      preciseTime: initialPlayerTime, // Initialize precise time
      isActive: false,
      color: getNextPlayerColor(),
      turns: 0,
      totalTurnTime: 0,
      turnStartTime: null
    };
    setPlayers([...players, newPlayer]);
    
    // Immediately sync player addition to Firebase
    if (firebase && gameId) {
      syncGameStateToFirebase(); // Immediate sync for player addition
    }
  };

  const removePlayer = (id) => {
    // Only hosts can remove players in multiplayer mode
    if (firebase && gameId && !isHostUser) {
      Alert.alert('Not Allowed', 'Only the host can remove players.');
      return;
    }
    
    if (players.length > 2) {
      const playerToRemove = players.find(p => p.id === id);
      
      // Check if player has been actively used (has timer data)
      if (playerToRemove && (playerToRemove.time > 0 || playerToRemove.turns > 0)) {
        showAlert(
          'Remove Player',
          `Remove "${playerToRemove.name}" who has ${formatTime(playerToRemove.time)} recorded? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                saveStateForUndo(); // Save state for undo
                setPlayers(players.filter(p => p.id !== id));
                if (activePlayerId === id) {
                  setActivePlayerId(null);
                  setIsRunning(false);
                }
              }
            }
          ]
        );
      } else {
        // No confirmation needed for unused players
        saveStateForUndo(); // Save state for undo
        setPlayers(players.filter(p => p.id !== id));
        if (activePlayerId === id) {
          setActivePlayerId(null);
          setIsRunning(false);
        }
      }
    }
  };

  const updatePlayerName = useCallback((id, name) => {
    // Check permissions only in multiplayer mode when connected to Firebase
    if (firebase && gameId && !isHostUser && !allowGuestNames) {
      Alert.alert('Not Allowed', 'The host has disabled guest name editing.');
      return;
    }
    
    console.log('Name change for player:', id, name, 'by:', playerId.current);
    
    // Update player name immediately (optimistic update) 
    setPlayers(prev => prev.map(player => 
      player.id === id ? { ...player, name } : player
    ));
    
    // Direct Firebase sync for names - bypass general game state sync
    if (firebase && gameId) {
      setTimeout(async () => {
        try {
          // Direct name sync to Firebase - more reliable for individual player updates
          const playerRef = firebase.ref(firebase.database, `games/${gameId}/players`);
          const currentPlayersSnapshot = await firebase.get(playerRef);
          
          if (currentPlayersSnapshot.exists()) {
            const currentPlayers = currentPlayersSnapshot.val() || [];
            const updatedPlayers = currentPlayers.map(player => 
              player.id === id ? { ...player, name } : player
            );
            
            // Update just the players array with the new name
            await firebase.set(playerRef, updatedPlayers);
            console.log('Name directly synced to Firebase for player:', id, name);
          } else {
            // Fallback to full game state sync if players don't exist
            await syncGameStateToFirebase();
            console.log('Name fallback sync for player:', id, name);
          }
        } catch (error) {
          console.log('Failed to sync name directly, trying fallback:', error);
          // Fallback to general sync
          try {
            await syncGameStateToFirebase();
            console.log('Name fallback sync completed');
          } catch (fallbackError) {
            console.log('Name fallback sync also failed:', fallbackError);
          }
        }
      }, 1); // Near-instant sync for names
    }
  }, [isHostUser, allowGuestNames, firebase, gameId, syncGameStateToFirebase, playerId]);

  const updatePlayerColor = useCallback((colorPlayerId, color) => {
    console.log('Color change for player:', colorPlayerId, color, 'by:', playerId.current);
    // Check guest permissions for changing player colors only in multiplayer mode
    if (firebase && gameId && !isHostUser && !allowGuestNames) {
      console.log('Color change blocked: guest permissions');
      Alert.alert('Not Allowed', 'The host has disabled guest name and color editing.');
      return;
    }
    
    console.log('Setting player color locally...');
    // Force immediate update for instant visual feedback
    setPlayers(prev => {
      const updated = prev.map(player => 
        player.id === colorPlayerId ? { ...player, color } : player
      );
      console.log('Color updated locally:', updated.find(p => p.id === colorPlayerId)?.color);
      return updated;
    });
    
    // Mark this as a local action for optimistic updates
    markLocalAction();
    
    // Direct Firebase sync for colors - bypass general game state sync
    if (firebase && gameId) {
      setTimeout(async () => {
        try {
          // Direct color sync to Firebase - more reliable for individual player updates
          const playerRef = firebase.ref(firebase.database, `games/${gameId}/players`);
          const currentPlayersSnapshot = await firebase.get(playerRef);
          
          if (currentPlayersSnapshot.exists()) {
            const currentPlayers = currentPlayersSnapshot.val() || [];
            const updatedPlayers = currentPlayers.map(player => 
              player.id === colorPlayerId ? { ...player, color } : player
            );
            
            // Update just the players array with the new color
            await firebase.set(playerRef, updatedPlayers);
            console.log('Color directly synced to Firebase for player:', colorPlayerId, color);
          } else {
            // Fallback to full game state sync if players don't exist
            await syncGameStateToFirebase();
            console.log('Color fallback sync for player:', colorPlayerId, color);
          }
        } catch (error) {
          console.log('Failed to sync color directly, trying fallback:', error);
          // Fallback to general sync
          try {
            await syncGameStateToFirebase();
            console.log('Color fallback sync completed');
          } catch (fallbackError) {
            console.log('Color fallback sync also failed:', fallbackError);
          }
        }
      }, 1); // Near-instant sync for colors
    }
  }, [isHostUser, allowGuestNames, firebase, gameId, syncGameStateToFirebase, playerId]);

  const handleGameNameChange = useCallback((text) => {
    // Check permissions only in multiplayer mode when connected to Firebase
    if (firebase && gameId && !isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest name editing.');
      return;
    }
    
    // Mark this as a local action for optimistic updates
    markLocalAction();
    
    // Update game name immediately
    setCurrentGameName(text);
    
    // Immediate sync for name changes
    if (firebase && gameId) {
      syncGameStateToFirebase(); // Immediate sync for name changes
    }
  }, [isHostUser, allowGuestNames, firebase, gameId]);

  // Handle settings changes with immediate sync for hosts
  const handleGuestControlToggle = useCallback(() => {
    if (!isHostUser) return; // Only hosts can change this
    
    console.log('Taking immediate authority for guest control setting:', playerId.current);
    
    // Take immediate authority - become the "temporary main user" for this action
    const previousAuthority = authoritativeTimerPlayerId;
    setAuthoritativeTimerPlayerId(playerId.current);
    
    const newValue = !allowGuestControl;
    setAllowGuestControl(newValue);
    console.log('Host changed guest timer controls to:', newValue);
    
    // Immediate sync like the working game name - no delays
    if (firebase && gameId) {
      setTimeout(async () => {
        try {
          const settingRef = firebase.ref(firebase.database, `games/${gameId}/allowGuestControl`);
          await firebase.set(settingRef, newValue);
          console.log('Guest control setting synced immediately:', newValue);
          // Restore previous authority after sync
          if (previousAuthority && previousAuthority !== playerId.current) {
            setTimeout(() => setAuthoritativeTimerPlayerId(previousAuthority), 100);
          }
        } catch (error) {
          console.log('Failed to sync guest control setting:', error);
          // Restore authority on error
          if (previousAuthority && previousAuthority !== playerId.current) {
            setAuthoritativeTimerPlayerId(previousAuthority);
          }
        }
      }, 10); // Immediate sync like game name
    }
  }, [allowGuestControl, isHostUser, firebase, gameId, authoritativeTimerPlayerId, playerId]);

  const handleGuestNamesToggle = useCallback(() => {
    if (!isHostUser) return; // Only hosts can change this
    
    console.log('Taking immediate authority for guest names setting:', playerId.current);
    
    // Take immediate authority - become the "temporary main user" for this action
    const previousAuthority = authoritativeTimerPlayerId;
    setAuthoritativeTimerPlayerId(playerId.current);
    
    const newValue = !allowGuestNames;
    setAllowGuestNames(newValue);
    console.log('Host changed guest name editing to:', newValue);
    
    // Immediate sync like the working game name - no delays
    if (firebase && gameId) {
      setTimeout(async () => {
        try {
          const settingRef = firebase.ref(firebase.database, `games/${gameId}/allowGuestNames`);
          await firebase.set(settingRef, newValue);
          console.log('Guest names setting synced immediately:', newValue);
          // Restore previous authority after sync
          if (previousAuthority && previousAuthority !== playerId.current) {
            setTimeout(() => setAuthoritativeTimerPlayerId(previousAuthority), 100);
          }
        } catch (error) {
          console.log('Failed to sync guest names setting:', error);
          // Restore authority on error
          if (previousAuthority && previousAuthority !== playerId.current) {
            setAuthoritativeTimerPlayerId(previousAuthority);
          }
        }
      }, 10); // Immediate sync like game name
    }
  }, [allowGuestNames, isHostUser, firebase, gameId, authoritativeTimerPlayerId, playerId]);


  const handleJoinGameIdChange = useCallback((text) => {
    setJoinGameId(text.toUpperCase());
  }, []);

  const handlePlayerNameChange = useCallback((playerId) => 
    (text) => {
      console.log('Player name changing (temp only):', playerId, text);
      
      // Only update temporary name state, don't update actual player data yet
      setTempPlayerName(text);
    }, []
  );

  // Helper function to mark local actions for optimistic updates
  const markLocalAction = (isDirectSync = false) => {
    const now = Date.now();
    lastLocalActionRef.current = now;
    // Much longer protection for direct Firebase updates since they need time to propagate
    const protectionTime = isDirectSync ? 1000 : 300; // 1s for direct, 300ms for regular
    ignoreUpdatesUntilRef.current = now + protectionTime;
    console.log('markLocalAction called, ignoring updates for', protectionTime + 'ms', isDirectSync ? '(direct sync)' : '(regular)');
  };



  const listenToGameChanges = () => {
    if (!firebase || !firebase.database || !gameId) return;

    const gameRef = firebase.ref(firebase.database, `games/${gameId}`);
    
    const unsubscribe = firebase.onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      
      // If game data doesn't exist, it means host finished the game and removed it
      // Kick out all players except the one who just removed it (the host who called finishGame)
      if (!data) {
        // Only show alert if we're not currently finishing the game ourselves
        // (i.e., if we're not the host who just called finishGame)
        if (currentScreen !== 'home') {
          Alert.alert(
            'Game Ended',
            'The host has finished the game. You have been disconnected.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Reset everything and return to home
                  performReset();
                  setCurrentScreen('home');
                  setGameId('');
                  setIsHost(false);
                  setIsHostUser(false);
                  setConnectionStatus('disconnected');
                  setIsOnline(false);
                }
              }
            ]
          );
        }
        return;
      }
      
      if (data && data.lastUpdated) {
        const now = Date.now();
        
        // Smart conflict protection - only ignore updates that would conflict with our specific changes
        const localPlayersAreDefault = players.length <= 2 && players.every(p => p.name.startsWith('Player '));
        const isInitialLoad = localPlayersAreDefault || players.length === 0;
        const hasRecentLocalAction = now < ignoreUpdatesUntilRef.current;
        
        // Only ignore updates from the same player who made the local action, not all updates
        if (!isInitialLoad && hasRecentLocalAction && data.lastActionPlayerId === playerId.current) {
          console.log('Ignoring Firebase update from same player due to recent local action, remaining:', ignoreUpdatesUntilRef.current - now + 'ms');
          setConnectionStatus('connected');
          setIsOnline(true);
          return;
        }
        
        // Update if this change came from another player AND we haven't made a conflicting local action
        if (data.lastActionPlayerId !== playerId.current) {
          // Additional check: if the update is very recent and we just made an action, prioritize our action
          // Extended conflict window to ensure our local changes have time to sync
          if (data.lastActionPlayerId && data.lastUpdated > lastLocalActionRef.current && 
              now - lastLocalActionRef.current < 600) {
            console.log('Conflict detected: prioritizing recent local action');
            setConnectionStatus('connected');
            setIsOnline(true);
            return; // Don't apply remote updates if we have a very recent local action
          }
          
          // Sanitize incoming data and batch updates to prevent multiple re-renders
          const sanitizedData = sanitizeGameData(data);
          
          // Validation: Don't apply updates that would reset the game to initial state
          // BUT allow initial loading when joining a game (when local players array is empty or default)
          const hasValidPlayers = sanitizedData.players && sanitizedData.players.length > 0;
          const playersHaveNames = sanitizedData.players.some(p => p.name && p.name.trim() !== '' && !p.name.startsWith('Player '));
          const localPlayersAreDefault = players.length <= 2 && players.every(p => p.name.startsWith('Player '));
          const isInitialLoad = localPlayersAreDefault || players.length === 0;
          const isLikelyReset = !isInitialLoad && (!hasValidPlayers || (!playersHaveNames && players.some(p => p.name && !p.name.startsWith('Player '))));
          
          if (isLikelyReset) {
            console.log('Detected potential state reset - rejecting Firebase update:', { 
              hasValidPlayers, 
              playersHaveNames, 
              currentPlayersHaveNames: players.some(p => p.name && !p.name.startsWith('Player ')),
              sanitizedPlayers: sanitizedData.players,
              isInitialLoad
            });
            setConnectionStatus('connected');
            setIsOnline(true);
            return; // Don't apply updates that look like resets
          }
          
          // Simple timer protection - only protect if we're actively running the timer
          const weOwnTimer = authoritativeTimerPlayerId === playerId.current && isRunning && activePlayerId !== null;
          
          console.log('Timer protection check:', { 
            weOwnTimer, 
            isRunning, 
            activePlayerId,
            authoritativeTimerPlayerId 
          });
          
          const updates = {
            players: sanitizedData.players.map(incomingPlayer => {
              const localPlayer = players.find(p => p.id === incomingPlayer.id);
              
              // If we're running the timer for this player, keep our timer data
              if (weOwnTimer && incomingPlayer.id === activePlayerId) {
                return localPlayer ? {
                  ...incomingPlayer,
                  time: localPlayer.time,
                  preciseTime: localPlayer.preciseTime || localPlayer.time,
                  isActive: true
                } : incomingPlayer;
              }
              
              // Always accept incoming changes for other players to avoid conflicts
              if (localPlayer) {
                return {
                  ...incomingPlayer,
                  // Accept all incoming changes to prevent sync loops
                  name: incomingPlayer.name,
                  color: incomingPlayer.color
                };
              }
              
              return incomingPlayer;
            }),
            // Accept pause commands even if we own the timer, otherwise protect running state
            activePlayerId: sanitizedData.activePlayerId, // Always accept player changes
            isRunning: !sanitizedData.isRunning ? false : (weOwnTimer ? isRunning : sanitizedData.isRunning), // Always accept pause
            gameStarted: sanitizedData.gameStarted,
            timerMode: sanitizedData.timerMode,
            initialTime: sanitizedData.initialTime,
            currentGameName: sanitizedData.currentGameName,
            allowGuestControl: sanitizedData.allowGuestControl,
            allowGuestNames: sanitizedData.allowGuestNames,
            isHostUser: data.hostId === playerId.current
          };
          
          // Apply all updates at once, but protect currently editing player and authoritative timer
          if (editingPlayerId !== null) {
            // Merge players but keep the currently editing player's name and prevent player removal
            const currentEditingPlayer = players.find(p => p.id === editingPlayerId);
            if (currentEditingPlayer) {
              // Ensure the editing player is preserved in the updates
              const editingPlayerExists = updates.players.some(p => p.id === editingPlayerId);
              if (!editingPlayerExists) {
                // If the editing player was removed from the update, add them back
                updates.players.push(currentEditingPlayer);
                console.log('Restored editing player to prevent removal during name edit:', editingPlayerId);
              } else {
                // Just update the name to match current local state
                updates.players = updates.players.map(p => 
                  p.id === editingPlayerId ? { ...p, name: currentEditingPlayer.name } : p
                );
              }
            }
          }
          
          // If we are the authoritative timer owner, don't let others overwrite our timer count and precise time
          if (data.authoritativeTimerPlayerId === playerId.current && activePlayerId !== null) {
            const currentActivePlayer = players.find(p => p.id === activePlayerId);
            if (currentActivePlayer) {
              updates.players = updates.players.map(p => 
                p.id === activePlayerId ? { 
                  ...p, 
                  time: currentActivePlayer.time,
                  preciseTime: currentActivePlayer.preciseTime || currentActivePlayer.time
                } : p
              );
            }
          }
          // Apply updates but preserve local timer values for authoritative player
          setPlayers(currentPlayers => {
            // If we are the authoritative timer owner, preserve our precise timer values
            if (sanitizedData.authoritativeTimerPlayerId === playerId.current && activePlayerId !== null) {
              const updatedPlayers = updates.players.map(fbPlayer => {
                const currentPlayer = currentPlayers.find(cp => cp.id === fbPlayer.id);
                // For the active player, keep local timer precision if we own it
                if (fbPlayer.id === activePlayerId && currentPlayer) {
                  return {
                    ...fbPlayer,
                    time: currentPlayer.time, // Keep precise local time
                    turnStartTime: currentPlayer.turnStartTime // Keep precise start time
                  };
                }
                return fbPlayer;
              });
              console.log('Preserving authoritative timer values for player:', activePlayerId);
              return updatedPlayers;
            }
            return updates.players;
          });
          
          setActivePlayerId(updates.activePlayerId);
          setIsRunning(updates.isRunning);
          setGameStarted(updates.gameStarted);
          
          // Update authoritative timer player ID from Firebase
          if (sanitizedData.authoritativeTimerPlayerId) {
            setAuthoritativeTimerPlayerId(sanitizedData.authoritativeTimerPlayerId);
            console.log('Updated timer authority from Firebase:', sanitizedData.authoritativeTimerPlayerId);
          }
          
          // Only update game name if we're not currently editing it
          if (document.activeElement?.placeholder !== "Enter game name (optional)") {
            setCurrentGameName(updates.currentGameName);
          }
          
          // Update host status first
          const newIsHostUser = gameId && firebase ? updates.isHostUser : isHostUser;
          if (gameId && firebase) {
            setIsHostUser(newIsHostUser);
          }
          
          // Only update settings if we're not the host (guests should receive host's settings)
          // Use the NEW host status, not the old one
          if (!newIsHostUser) {
            setAllowGuestControl(updates.allowGuestControl);
            setAllowGuestNames(updates.allowGuestNames);
            console.log('Guest received permission update:', { 
              allowGuestControl: updates.allowGuestControl, 
              allowGuestNames: updates.allowGuestNames,
              newIsHostUser 
            });
          } else {
            console.log('Host ignoring permission update to maintain authority, isHost:', newIsHostUser, 'playerId:', playerId.current, 'hostId:', data.hostId);
          }
        }
        setConnectionStatus('connected');
        setIsOnline(true);
      }
    });

    return unsubscribe;
  };

  const syncPlayerJoin = async () => {
    if (!firebase || !firebase.database || !gameId) return;

    try {
      const playerRef = firebase.ref(firebase.database, `games/${gameId}/connectedPlayers/${playerId.current}`);
      await firebase.set(playerRef, {
        id: playerId.current,
        joinedAt: Date.now(),
        isActive: true
      });
    } catch (error) {
      console.log('Player join sync error:', error);
    }
  };

  const startPlayerTurn = (newPlayerId) => {
    // Prevent concurrent processing to avoid authority conflicts during rapid clicking
    if (processingPlayerTurnRef.current) {
      console.log('Player turn change already in progress, ignoring click for:', newPlayerId);
      return;
    }
    
    console.log('Timer button clicked:', { 
      isHostUser, 
      allowGuestControl, 
      newPlayerId,
      currentActive: activePlayerId,
      playerId: playerId.current,
      firebase: !!firebase,
      gameId
    });
    
    // Check guest timer permissions in multiplayer mode
    if (firebase && gameId && !isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest timer controls.');
      return;
    }
    
    // If clicking the active player, toggle pause/resume
    if (newPlayerId === activePlayerId && gameStarted) {
      // Add a small delay to prevent rapid toggle conflicts in multiplayer
      if (firebase && gameId && processingPlayerTurnRef.current) {
        return; // Prevent rapid clicking in multiplayer
      }
      
      if (isRunning) {
        pauseGame();
      } else {
        resumeGame();
      }
      return;
    }
    
    // Set processing flag to prevent rapid clicks
    processingPlayerTurnRef.current = true;
    
    console.log('Starting turn for player:', newPlayerId);
    
    saveStateForUndo(); // Save state for undo
    
    const currentTime = Date.now();
    
    // Take timer authority IMMEDIATELY before any state changes
    const previousAuthority = authoritativeTimerPlayerId;
    setAuthoritativeTimerPlayerId(playerId.current);
    console.log('Taking immediate timer authority on click:', playerId.current);
    
    // Update players state immediately - simple and direct
    setPlayers(prev => prev.map(player => {
      if (player.id === activePlayerId && player.isActive && activePlayerId !== newPlayerId) {
        // End current player's turn and record statistics
        const turnDuration = player.turnStartTime ? currentTime - player.turnStartTime : 0;
        return {
          ...player,
          isActive: false,
          turns: (player.turns || 0) + 1,
          totalTurnTime: (player.totalTurnTime || 0) + turnDuration,
          turnStartTime: null
        };
      } else if (player.id === newPlayerId) {
        // Start new player's turn - ensure preciseTime is properly set
        const currentPreciseTime = player.preciseTime !== undefined ? player.preciseTime : player.time;
        return {
          ...player,
          isActive: true,
          turnStartTime: currentTime,
          preciseTime: currentPreciseTime // Maintain precise time for timer accuracy
        };
      }
      return { ...player, isActive: false };
    }));
    
    // Set new active player and start timer immediately
    setActivePlayerId(newPlayerId);
    setIsRunning(true);
    setGameStarted(true);
    
    // Play turn sound if enabled
    if (playTurnSounds) {
      playTurnSound();
    }
    
    // Vibrate on mobile if supported
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    // Immediate sync with authority - no delays for rapid click handling
    if (firebase && gameId) {
      setTimeout(() => {
        syncGameStateToFirebase();
        console.log('Timer state synced with immediate authority:', playerId.current);
        
        // Clear processing flag immediately after sync starts (ultra fast)
        setTimeout(() => {
          processingPlayerTurnRef.current = false;
        }, 1); // Ultra fast unlock for rapid clicking
      }, 1); // Near-instant sync for rapid click handling
    } else {
      // Clear processing flag immediately if no Firebase sync needed
      setTimeout(() => {
        processingPlayerTurnRef.current = false;
      }, 1); // Ultra fast for local games
    }
  };

  const pauseGame = () => {
    // Check guest timer permissions in multiplayer mode
    if (firebase && gameId && !isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest timer controls.');
      return;
    }
    
    saveStateForUndo(); // Save state for undo
    // Store the last active player for resume
    if (activePlayerId) {
      setLastActivePlayerId(activePlayerId);
      const currentTime = Date.now();
      setPlayers(prev => prev.map(player => {
        if (player.id === activePlayerId && player.isActive) {
          const turnDuration = player.turnStartTime ? currentTime - player.turnStartTime : 0;
          // Preserve current time values without resetting
          const currentPreciseTime = player.preciseTime || player.time;
          return {
            ...player,
            isActive: false,
            turns: (player.turns || 0) + 1,
            totalTurnTime: (player.totalTurnTime || 0) + turnDuration,
            turnStartTime: null,
            preciseTime: currentPreciseTime // Ensure preciseTime is preserved
          };
        }
        return player;
      }));
    }
    setIsRunning(false);
    setActivePlayerId(null);
    setAuthoritativeTimerPlayerId(null); // Clear authoritative timer owner
    
    // Direct Firebase sync for pause state like settings
    if (firebase && gameId) {
      setTimeout(async () => {
        try {
          const gameRef = firebase.ref(firebase.database, `games/${gameId}`);
          await firebase.update(gameRef, {
            isRunning: false,
            activePlayerId: null,
            lastUpdated: Date.now(),
            lastActionPlayerId: playerId.current
          });
          console.log('Pause state synced directly');
        } catch (error) {
          console.log('Failed to sync pause directly:', error);
        }
      }, 50);
    }
  };
  
  const resumeGame = () => {
    // Check guest timer permissions in multiplayer mode
    if (firebase && gameId && !isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest timer controls.');
      return;
    }
    
    // Resume with the last active player if no current active player
    const playerToResume = activePlayerId || lastActivePlayerId;
    if (playerToResume !== null) {
      if (!activePlayerId) {
        // Restart the last active player's timer
        setActivePlayerId(playerToResume);
        setPlayers(prev => prev.map(player => {
          if (player.id === playerToResume) {
            // Ensure preciseTime is properly initialized from current time
            const currentPreciseTime = player.preciseTime !== undefined ? player.preciseTime : player.time;
            return {
              ...player,
              isActive: true,
              turnStartTime: Date.now(),
              preciseTime: currentPreciseTime // Maintain precise time for proper countdown
            };
          }
          return {
            ...player,
            isActive: false,
            turnStartTime: null
          };
        }));
      }
      setIsRunning(true);
      
      // Make this player the authoritative timer owner when resuming (only if not already owned)
      if (!authoritativeTimerPlayerId || authoritativeTimerPlayerId === playerId.current) {
        setAuthoritativeTimerPlayerId(playerId.current);
        console.log('Taking timer authority on resume:', playerId.current);
      }
      
      // Immediately sync resume state to Firebase for multiplayer
      if (firebase && gameId) {
        setTimeout(() => {
          syncGameStateToFirebase();
        }, 100); // Quick sync for resume state
      }
    }
  };

  const nextPlayer = () => {
    saveStateForUndo(); // Save state for undo
    const currentIndex = players.findIndex(p => p.id === activePlayerId);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayerId = players[nextIndex].id;
    startPlayerTurn(nextPlayerId);
  };

  // Play turn sound
  const playTurnSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // High beep
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.log('Sound not supported:', error);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      localStorage.setItem('boardgame_theme', newTheme);
    } catch (error) {
      console.log('Failed to save theme:', error);
    }
  };

  // Load theme on start
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('boardgame_theme');
      if (savedTheme) {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.log('Failed to load theme:', error);
    }
  }, []);

  const resetGame = () => {
    console.log('Reset button clicked, gameStarted:', gameStarted);
    if (gameStarted) {
      showAlert(
        'Reset Game',
        'Do you want to save the current game before resetting?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save & Reset',
            onPress: () => {
              saveGame();
              performReset();
            }
          },
          {
            text: 'Reset Without Saving',
            style: 'destructive',
            onPress: () => {
              showAlert(
                'Are you sure?',
                'This will permanently clear all timer data without saving.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: performReset
                  }
                ]
              );
            }
          }
        ]
      );
    } else {
      showAlert(
        'Reset Game',
        'Are you sure you want to reset? This will clear all current data.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: performReset
          }
        ]
      );
    }
  };

  const performReset = (forceZero = false) => {
    console.log('Performing reset, forceZero:', forceZero);
    setIsRunning(false);
    setActivePlayerId(null);
    setLastActivePlayerId(null);
    setGameStarted(false);
    
    // For create new game or when explicitly requested, always use 0
    // For manual reset during game, respect timer mode
    const resetTime = forceZero ? 0 : (timerMode === 'countdown' ? initialTime : 0);
    
    setPlayers(prev => prev.map(player => ({
      ...player,
      time: resetTime,
      preciseTime: resetTime, // Reset precise time to match regular time
      isActive: false,
      turns: 0,
      totalTurnTime: 0,
      turnStartTime: null
    })));
    Alert.alert('Game Reset', 'The game has been reset successfully.');
  };

  const leaveGame = () => {
    showAlert(
      'Leave Game',
      'Are you sure you want to leave this game? You will lose connection and return to the main menu.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Game',
          style: 'destructive',
          onPress: () => {
            // Clear all game state and return to home
            setCurrentScreen('home');
            setGameId('');
            setIsHost(false);
            setIsHostUser(false);
            setConnectionStatus('disconnected');
            setIsOnline(false);
            setGameStarted(false);
            setIsRunning(false);
            setActivePlayerId(null);
            setLastActivePlayerId(null);
            setCurrentGameName('');
            
            // Reset players to default
            setPlayers([
              { id: 1, name: 'Player 1', time: 0, isActive: false, color: PLAYER_COLORS[0].value, turns: 0, totalTurnTime: 0, turnStartTime: null },
              { id: 2, name: 'Player 2', time: 0, isActive: false, color: PLAYER_COLORS[1].value, turns: 0, totalTurnTime: 0, turnStartTime: null }
            ]);
            
            Alert.alert('Left Game', 'You have successfully left the game and returned to the main menu.');
          }
        }
      ]
    );
  };

  const finishGame = async () => {
    if (!gameStarted) return;
    
    showAlert(
      'Finish Game',
      'Save this game and start fresh? This will end the game for all players.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish & Save',
          onPress: async () => {
            saveGame();
            
            // If host, remove the game from Firebase to kick out other players
            if (isHostUser && firebase && firebase.database && gameId) {
              try {
                const gameRef = firebase.ref(firebase.database, `games/${gameId}`);
                await firebase.remove(gameRef);
                console.log('Game removed from Firebase, all players kicked out');
              } catch (error) {
                console.log('Error removing game from Firebase:', error);
              }
            }
            
            // Reset everything and return to home
            performReset();
            setCurrentScreen('home');
            setGameId('');
            setIsHost(false);
            setIsHostUser(false);
            setConnectionStatus('disconnected');
            setIsOnline(false);
            
            Alert.alert('Game Finished', 'Game saved successfully and all players have been disconnected!');
          }
        }
      ]
    );
  };

  // Auto-save current game state
  const autoSaveGameState = () => {
    if (!gameStarted) return;
    
    const gameState = {
      players,
      activePlayerId,
      isRunning,
      gameStarted,
      timerMode,
      initialTime,
      currentGameName,
      gameId,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('boardgame_auto_save', JSON.stringify(gameState));
    } catch (error) {
      console.log('Auto-save failed:', error);
    }
  };

  // Load saved state
  const loadSavedState = () => {
    try {
      // Don't restore auto-save if we already have an active game or are in multiplayer
      if (gameStarted || gameId) {
        console.log('Skipping auto-save restoration - game already active');
        return;
      }
      
      const saved = localStorage.getItem('boardgame_auto_save');
      if (saved) {
        const gameState = JSON.parse(saved);
        // Only restore if saved within last 24 hours
        if (Date.now() - gameState.timestamp < 24 * 60 * 60 * 1000) {
          setPlayers(gameState.players || []);
          setActivePlayerId(gameState.activePlayerId);
          setIsRunning(false); // Don't auto-resume running timers
          setGameStarted(gameState.gameStarted || false);
          setTimerMode(gameState.timerMode || 'countup');
          setInitialTime(gameState.initialTime || 600);
          setCurrentGameName(gameState.currentGameName || '');
          setGameId(gameState.gameId || '');
          console.log('Auto-save restored successfully');
        }
      }
    } catch (error) {
      console.log('Failed to load saved state:', error);
    }
  };

  // Load game history
  const loadGameHistory = () => {
    try {
      const saved = localStorage.getItem('boardgame_history');
      if (saved) {
        setGameHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Failed to load game history:', error);
    }
  };

  // Save game history
  const saveGameHistory = (newHistory) => {
    try {
      localStorage.setItem('boardgame_history', JSON.stringify(newHistory));
    } catch (error) {
      console.log('Failed to save game history:', error);
    }
  };

  const saveGame = () => {
    if (!gameStarted) return;
    
    // Prevent save spam - cooldown of 2 seconds
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2000) {
      Alert.alert('Please Wait', 'Please wait a moment before saving again.');
      return;
    }
    lastSaveTimeRef.current = now;
    
    // Calculate game statistics
    const totalTurns = players.reduce((sum, p) => sum + (p.turns || 0), 0);
    const averageTurnTime = totalTurns > 0 ? Math.round(players.reduce((sum, p) => sum + p.totalTurnTime, 0) / totalTurns) : 0;
    
    const gameData = {
      id: Date.now(),
      gameId: gameId || 'local', // Track by game code/ID
      name: currentGameName || `Game ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      players: players.map(p => ({
        name: p.name,
        time: p.time,
        formattedTime: formatTime(p.time),
        color: p.color,
        turns: p.turns || 0,
        avgTurnTime: p.turns > 0 ? Math.round(p.totalTurnTime / p.turns) : 0,
        formattedAvgTurnTime: p.turns > 0 ? formatTime(Math.round(p.totalTurnTime / p.turns)) : '0:00'
      })),
      timerMode,
      totalTime: players.reduce((sum, p) => sum + p.time, 0),
      totalTurns: totalTurns,
      averageTurnTime: averageTurnTime,
      formattedAverageTurnTime: formatTime(averageTurnTime)
    };
    
    // Implement max 10 games per game ID limit
    let newHistory = [...gameHistory];
    const sameGameIdHistory = newHistory.filter(game => game.gameId === gameData.gameId);
    
    if (sameGameIdHistory.length >= 10) {
      // Remove the oldest games with same gameId to keep only 9, then add the new one
      const gamesToRemove = sameGameIdHistory.slice(9); // Keep first 9, remove rest
      newHistory = newHistory.filter(game => !gamesToRemove.includes(game));
    }
    
    newHistory = [gameData, ...newHistory];
    setGameHistory(newHistory);
    saveGameHistory(newHistory);
    Alert.alert('Success', 'Game saved successfully!');
  };

  // Delete game from history
  const deleteGame = (gameId) => {
    const gameToDelete = gameHistory.find(game => game.id === gameId);
    showAlert(
      'Delete Game',
      `Are you sure you want to permanently delete "${gameToDelete?.name || 'this game'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newHistory = gameHistory.filter(game => game.id !== gameId);
            setGameHistory(newHistory);
            saveGameHistory(newHistory);
            Alert.alert('Deleted', 'Game deleted successfully.');
          }
        }
      ]
    );
  };

  // Load saved game and continue playing
  const loadSavedGame = (game, continueMode = true) => {
    const title = continueMode ? 'Continue Game' : 'New Game from Save';
    const message = continueMode 
      ? `Continue playing "${game.name}" with existing times? This will create a new save when you save again.`
      : `Start a fresh game using "${game.name}" setup? All timers will reset to zero.`;
    const buttonText = continueMode ? 'Continue' : 'Start Fresh';
    
    showAlert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: buttonText,
          onPress: () => {
            // Reset current game state but keep it as a new session
            setGameId(''); // New session, no multiplayer ID
            setIsHost(false);
            setIsHostUser(true); // Always host in local games
            setAllowGuestControl(true); // Allow timer controls in local games
            setAllowGuestNames(true); // Allow name editing in local games
            
            // Load saved game data with appropriate setup
            const loadedPlayers = game.players.map((p, index) => ({
              id: index + 1,
              name: p.name,
              time: continueMode ? p.time : 0, // Reset time if starting fresh
              isActive: false,
              color: p.color,
              turns: 0,
              totalTurnTime: 0,
              turnStartTime: null
            }));
            
            setPlayers(loadedPlayers);
            
            if (continueMode) {
              // Avoid multiple "(Continued)" text appending
              const baseName = game.name.replace(/ \(Continued\)$/, '');
              setCurrentGameName(baseName + ' (Continued)');
            } else {
              setCurrentGameName(game.name + ' (Fresh)');
            }
            
            setTimerMode(game.timerMode || 'countup');
            setActivePlayerId(null);
            setIsRunning(false);
            setGameStarted(continueMode); // Only mark as started if continuing
            setCurrentScreen('game');
            
            const modeText = continueMode ? 'continued from' : 'started fresh using';
            Alert.alert('Session Started', `New session ${modeText} "${game.name}". You can now play and save as a new game!`);
          }
        }
      ]
    );
  };

  // Undo last action - enhanced to reset to turn start time
  const undoLastAction = () => {
    if (lastActionState) {
      // If there's a turn start snapshot, reset the active player to their turn start time
      if (lastActionState.turnStartSnapshot && lastActionState.turnStartSnapshot.playerId) {
        const { playerId: snapPlayerId, timeAtStart, preciseTimeAtStart } = lastActionState.turnStartSnapshot;
        
        setPlayers(prev => prev.map(player => 
          player.id === snapPlayerId 
            ? { ...player, time: timeAtStart, preciseTime: preciseTimeAtStart }
            : player
        ));
        
        setActivePlayerId(snapPlayerId);
        setIsRunning(false); // Pause after undo
        Alert.alert('Undone', 'Timer reset to turn start. Press resume to continue.');
      } else {
        // Fallback to regular state restoration
        setPlayers(lastActionState.players);
        setActivePlayerId(lastActionState.activePlayerId);
        setIsRunning(lastActionState.isRunning);
        Alert.alert('Undone', 'Last action has been undone');
      }
      
      setGameStarted(lastActionState.gameStarted);
      setLastActionState(null);
    }
  };

  // Save state for undo - enhanced to track turn start time
  const saveStateForUndo = () => {
    setLastActionState({
      players: [...players],
      activePlayerId,
      isRunning,
      gameStarted,
      turnStartSnapshot: activePlayerId ? {
        playerId: activePlayerId,
        startTime: players.find(p => p.id === activePlayerId)?.turnStartTime || Date.now(),
        timeAtStart: players.find(p => p.id === activePlayerId)?.time || 0,
        preciseTimeAtStart: players.find(p => p.id === activePlayerId)?.preciseTime || 0
      } : null
    });
  };

  const getNextPlayerColor = () => {
    const usedColors = new Set(players.map(p => p.color));
    const availableColor = PLAYER_COLORS.find(color => !usedColors.has(color.value));
    return availableColor ? availableColor.value : PLAYER_COLORS[0].value;
  };



  const getAverageTurnTime = (player) => {
    if (player.turns === 0) return 0;
    
    // Simple calculation: total time divided by turns
    return Math.round(player.time / player.turns);
  };

  const getOverallAverageTime = () => {
    const playersWithTurns = players.filter(p => p.turns > 0);
    if (playersWithTurns.length === 0) return 0;
    
    // Calculate average of all player averages
    const totalAvg = playersWithTurns.reduce((sum, player) => sum + getAverageTurnTime(player), 0);
    return Math.round(totalAvg / playersWithTurns.length);
  };

  const getPlayerBoxSize = () => {
    if (playerBoxSize === 'auto') {
      const layout = getOptimalLayout(players.length);
      return layout.size.charAt(0).toUpperCase() + layout.size.slice(1);
    }
    return playerBoxSize.charAt(0).toUpperCase() + playerBoxSize.slice(1);
  };

  const getPlayerGridCols = () => {
    if (playerBoxSize === 'auto') {
      return getOptimalLayout(players.length, screenDimensions.width, screenDimensions.height).cols;
    }
    
    const size = getPlayerBoxSize().toLowerCase();
    if (size === 'large') return players.length === 1 ? 1 : 2;
    if (size === 'medium') return 2;
    if (size === 'compact') return 3;
    if (size === 'small') return 4;
    return 5; // tiny
  };

  // Get actual screen dimensions for responsive layout
  const [screenDimensions, setScreenDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const updateDimensions = () => {
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  const getPlayerCardHeight = () => {
    if (playerBoxSize === 'auto') {
      return getOptimalLayout(players.length, screenDimensions.width, screenDimensions.height).cardHeight;
    }
    return 140; // default height
  };



  return (
    <View style={styles.app}>

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚙️ Settings</Text>
            
            {(!gameId || isHostUser) && (
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Timer Mode</Text>
                <View style={styles.settingOptions}>
                  <TouchableOpacity
                    style={[
                      styles.settingOption,
                      timerMode === 'countup' && styles.settingOptionActive
                    ]}
                    onPress={() => setTimerMode('countup')}
                  >
                    <Text style={[
                      styles.settingOptionText,
                      timerMode === 'countup' && styles.settingOptionTextActive
                    ]}>Count Up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.settingOption,
                      timerMode === 'countdown' && styles.settingOptionActive
                    ]}
                    onPress={() => setTimerMode('countdown')}
                  >
                    <Text style={[
                      styles.settingOptionText,
                      timerMode === 'countdown' && styles.settingOptionTextActive
                    ]}>Count Down</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {timerMode === 'countdown' && (!gameId || isHostUser) && (
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Initial Time (minutes, max 480)</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(initialTime / 60)}
                  onChangeText={(text) => {
                    const minutes = parseInt(text) || 10;
                    const clampedMinutes = Math.max(1, Math.min(480, minutes)); // 1 minute to 8 hours
                    setInitialTime(clampedMinutes * 60);
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#999"
                />
              </View>
            )}
            
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Turn Sounds</Text>
              <View style={styles.settingOptions}>
                <TouchableOpacity
                  style={[
                    styles.settingOption,
                    playTurnSounds && styles.settingOptionActive
                  ]}
                  onPress={() => setPlayTurnSounds(!playTurnSounds)}
                >
                  <Text style={[
                    styles.settingOptionText,
                    playTurnSounds && styles.settingOptionTextActive
                  ]}>🔊 Enabled</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.settingOption,
                    !playTurnSounds && styles.settingOptionActive
                  ]}
                  onPress={() => setPlayTurnSounds(!playTurnSounds)}
                >
                  <Text style={[
                    styles.settingOptionText,
                    !playTurnSounds && styles.settingOptionTextActive
                  ]}>🔇 Disabled</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Theme</Text>
              <View style={styles.settingOptions}>
                <TouchableOpacity
                  style={[
                    styles.settingOption,
                    theme === 'dark' && styles.settingOptionActive
                  ]}
                  onPress={() => {
                    setTheme('dark');
                    try { localStorage.setItem('boardgame_theme', 'dark'); } catch (e) {}
                  }}
                >
                  <Text style={[
                    styles.settingOptionText,
                    theme === 'dark' && styles.settingOptionTextActive
                  ]}>🌙 Dark</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.settingOption,
                    theme === 'light' && styles.settingOptionActive
                  ]}
                  onPress={() => {
                    setTheme('light');
                    try { localStorage.setItem('boardgame_theme', 'light'); } catch (e) {}
                  }}
                >
                  <Text style={[
                    styles.settingOptionText,
                    theme === 'light' && styles.settingOptionTextActive
                  ]}>☀️ Light</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {isHostUser && gameId && (
              <>
                <View style={styles.settingSection}>
                  <Text style={styles.settingLabel}>Guest Timer Controls</Text>
                  <View style={styles.settingOptions}>
                    <TouchableOpacity
                      style={[
                        styles.settingOption,
                        allowGuestControl && styles.settingOptionActive
                      ]}
                      onPress={handleGuestControlToggle}
                    >
                      <Text style={[
                        styles.settingOptionText,
                        allowGuestControl && styles.settingOptionTextActive
                      ]}>👥 Allow Guests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.settingOption,
                        !allowGuestControl && styles.settingOptionActive
                      ]}
                      onPress={handleGuestControlToggle}
                    >
                      <Text style={[
                        styles.settingOptionText,
                        !allowGuestControl && styles.settingOptionTextActive
                      ]}>🔒 Host Only</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.settingSection}>
                  <Text style={styles.settingLabel}>Guest Name & Color Editing</Text>
                  <View style={styles.settingOptions}>
                    <TouchableOpacity
                      style={[
                        styles.settingOption,
                        allowGuestNames && styles.settingOptionActive
                      ]}
                      onPress={handleGuestNamesToggle}
                    >
                      <Text style={[
                        styles.settingOptionText,
                        allowGuestNames && styles.settingOptionTextActive
                      ]}>✏️ Allow Guests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.settingOption,
                        !allowGuestNames && styles.settingOptionActive
                      ]}
                      onPress={handleGuestNamesToggle}
                    >
                      <Text style={[
                        styles.settingOptionText,
                        !allowGuestNames && styles.settingOptionTextActive
                      ]}>🔒 Host Only</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
              </>
            )}
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {currentScreen === 'home' && (
        <HomeScreen 
          theme={theme}
          gameHistory={gameHistory}
          createNewGame={createNewGame}
          setCurrentScreen={setCurrentScreen}
          setShowSettings={setShowSettings}
          deleteGame={deleteGame}
          hasActiveGame={gameStarted || gameId}
          returnToGame={() => setCurrentScreen('game')}
          loadSavedGame={loadSavedGame}
        />
      )}
      {currentScreen === 'game' && (
        <GameScreen 
          gameId={gameId}
          firebase={firebase}
          connectionStatus={connectionStatus}
          shareGame={shareGame}
          setShowSettings={setShowSettings}
          setCurrentScreen={setCurrentScreen}
          currentGameName={currentGameName}
          handleGameNameChange={handleGameNameChange}
          addPlayer={addPlayer}
          isRunning={isRunning}
          activePlayerId={activePlayerId}
          resumeGame={resumeGame}
          gameStarted={gameStarted}
          pauseGame={pauseGame}
          nextPlayer={nextPlayer}
          saveGame={saveGame}
          resetGame={resetGame}
          finishGame={finishGame}
          leaveGame={leaveGame}
          players={players}
          getPlayerGridCols={getPlayerGridCols}
          showColorPicker={showColorPicker}
          setShowColorPicker={setShowColorPicker}
          handlePlayerNameChange={handlePlayerNameChange}
          removePlayer={removePlayer}
          PLAYER_COLORS={PLAYER_COLORS}
          updatePlayerColor={updatePlayerColor}
          updatePlayerName={updatePlayerName}
          tempPlayerName={tempPlayerName}
          setTempPlayerName={setTempPlayerName}
          timerMode={timerMode}
          formatTime={formatTime}
          getAverageTurnTime={getAverageTurnTime}
          getOverallAverageTime={getOverallAverageTime}
          startPlayerTurn={startPlayerTurn}
          lastActionState={lastActionState}
          undoLastAction={undoLastAction}
          isHostUser={isHostUser}
          lastActivePlayerId={lastActivePlayerId}
          editingPlayerId={editingPlayerId}
          setEditingPlayerId={setEditingPlayerId}
          connectedPlayers={connectedPlayers}
          copyNotificationVisible={copyNotificationVisible}
          getPlayerCardHeight={getPlayerCardHeight}
          theme={theme}
        />
      )}
      {currentScreen === 'history' && (
        <GameHistoryScreen 
          gameHistory={gameHistory}
          setCurrentScreen={setCurrentScreen}
          formatTime={formatTime}
          deleteGame={deleteGame}
          loadSavedGame={loadSavedGame}
          theme={theme}
        />
      )}
      {currentScreen === 'join' && (
        <JoinGameScreen 
          joinGameId={joinGameId}
          handleJoinGameIdChange={handleJoinGameIdChange}
          joinGame={joinGame}
          setCurrentScreen={setCurrentScreen}
          theme={theme}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    width: '100%',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Extra space at bottom for mobile
    minHeight: '100%',
  },
  lightContainer: {
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: '100%',
    flexShrink: 1, // Allow title to shrink on mobile
  },
  lightText: {
    color: '#2d3748',
  },
  subtitle: {
    fontSize: 16,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 22,
  },
  lightSubtext: {
    color: '#718096',
  },
  localStatus: {
    fontSize: 14,
    color: '#f59e0b',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  button: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonWithFeedback: {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: '#10b981',
  },
  tertiaryButton: {
    backgroundColor: '#8b5cf6',
  },
  settingsButton: {
    backgroundColor: '#6b7280',
  },
  disabledButton: {
    backgroundColor: '#6b7280',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  recentGames: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  lightCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  gameHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gameHistoryText: {
    flex: 1,
  },
  gameHistoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteGameButton: {
    padding: 4,
    marginLeft: 8,
  },
  deleteGameText: {
    fontSize: 16,
  },
  gameName: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  gameDate: {
    color: '#a0aec0',
    fontSize: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 20,
    flexWrap: 'wrap', // Allow wrapping on mobile
    gap: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  backButton: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  shareButton: {
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  settingsIconButton: {
    padding: 12,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  settingsIconText: {
    fontSize: 14,
  },
  connectionStatus: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  connectedStatus: {
    color: '#10b981',
  },
  connectingStatus: {
    color: '#f59e0b',
  },
  errorStatus: {
    color: '#ef4444',
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 6,
    flexWrap: 'wrap',
    gap: 12,
    minHeight: 32,
  },
  statText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textShadow: '1px 1px 2px #000000',
  },
  statTextCompact: {
    fontSize: 11,
  },
  statTextTiny: {
    fontSize: 9,
  },
  inputFocused: {
    borderColor: '#3b82f6',
    borderWidth: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  inputContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 2,
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    outlineStyle: 'none',
    cursor: 'text',
    pointerEvents: 'auto',
  },
  gameNameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    outlineStyle: 'none',
    cursor: 'text',
    pointerEvents: 'auto',
    maxWidth: '100%', // Ensure it doesn't overflow on mobile
    width: '100%',
  },
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    marginTop: 8,
    paddingHorizontal: 8,
    minHeight: 56,
    alignItems: 'center',
  },
  controlButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  playButton: {
    backgroundColor: '#3b82f6',
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
  },
  nextButton: {
    backgroundColor: '#8b5cf6',
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  finishButton: {
    backgroundColor: '#7c3aed',
  },
  resetButton: {
    backgroundColor: '#ef4444',
  },
  leaveButton: {
    backgroundColor: '#dc2626',
  },
  undoButton: {
    backgroundColor: '#f59e0b',
  },
  themeButton: {
    backgroundColor: '#8b5cf6',
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  playersGrid: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 0,
    flexShrink: 0,
    paddingBottom: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  playerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    minHeight: 200, // Fixed minimum height
    minWidth: '48%', // Responsive width based on screen
    maxWidth: '48%', // Prevent cards from getting too wide
  },
  activePlayerCard: {
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 32,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorButtonText: {
    fontSize: 14,
  },
  colorPicker: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  colorPickerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedColor: {
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  selectedColorCheck: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadow: '1px 1px 2px #000000',
  },
  playerNameInput: {
    color: '#ffffff',
    fontSize: 16, // Base font size - will be overridden dynamically
    fontWeight: '600',
    width: '100%',
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    minHeight: 36,
    maxHeight: 36, // Fixed height - no growing
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 20,
    outlineStyle: 'none',
    cursor: 'text',
    pointerEvents: 'auto',
  },
  playerNameInputCompact: {
    padding: 4,
    minHeight: 24,
    maxHeight: 24,
    fontSize: 12,
    lineHeight: 14,
  },
  removeButton: {
    fontSize: 16,
  },
  playerNameContainer: {
    marginBottom: 8,
    minHeight: 32,
    justifyContent: 'center',
  },
  playerNameContainerCompact: {
    marginBottom: 4,
    minHeight: 24,
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  timerSectionCompact: {
    marginBottom: 4,
    paddingVertical: 2,
    flex: 1,
    justifyContent: 'center',
  },
  timeDisplay: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  timeDisplayCompact: {
    fontSize: 18,
    marginVertical: 1,
    paddingHorizontal: 2,
  },
  timeDisplayTiny: {
    fontSize: 16,
    marginVertical: 1,
    paddingHorizontal: 2,
  },
  urgentTime: {
    color: '#ef4444',
  },
  urgentText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  urgentTextCompact: {
    fontSize: 10,
    marginTop: 2,
  },
  playerButtonSection: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  playerButtonSectionCompact: {
    marginTop: 2,
    paddingHorizontal: 2,
    justifyContent: 'flex-end',
  },
  playerButton: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    minHeight: 32,
    justifyContent: 'center',
  },
  playerButtonCompact: {
    padding: 6,
    minHeight: 32,
  },
  playerButtonSmall: {
    padding: 4,
    minHeight: 28,
  },
  playerButtonTiny: {
    padding: 3,
    minHeight: 24,
  },
  playerButtonMobile: {
    padding: 6,
    minHeight: 36,
    borderRadius: 6,
    marginHorizontal: 1,
  },
  playerButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerButtonTime: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.9,
  },
  playerButtonTimeCompact: {
    fontSize: 10,
    marginTop: 1,
  },
  playerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
  },
  playerButtonTextCompact: {
    fontSize: 10,
  },
  playerButtonTextSmall: {
    fontSize: 9,
  },
  playerButtonTextTiny: {
    fontSize: 8,
  },
  playerButtonTextMobile: {
    fontSize: 18,
    lineHeight: 20,
  },
  statsContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    minWidth: '30%',
    marginBottom: 12,
    padding: 8,
  },
  statLabel: {
    color: '#a0aec0',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 20,
  },
  historyList: {
    gap: 16,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyHeaderText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyGameName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  historyDate: {
    fontSize: 12,
    color: '#a0aec0',
  },
  historyTotal: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  historyStatText: {
    fontSize: 12,
    color: '#a0aec0',
    fontWeight: '500',
  },
  historyPlayers: {
    gap: 6,
  },
  historyPlayerRow: {
    marginBottom: 4,
  },
  historyPlayer: {
    fontSize: 12,
    color: '#a0aec0',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  historyPlayerStats: {
    fontSize: 10,
    color: '#718096',
    fontStyle: 'italic',
    paddingLeft: 8,
  },
  historyActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  continueGameButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  continueGameText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#2a2a4e',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingSection: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  settingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  settingOptionText: {
    color: '#a0aec0',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  settingOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  settingInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 48,
  },
  modalCloseButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  lightInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#2d3748',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  lightPlayerNameInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#2d3748',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  gameCodeButton: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  gameCodeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  lightGameCodeButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  lightGameCodeText: {
    color: '#2563eb',
  },
  copyNotification: {
    position: 'absolute',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    elevation: 5,
  },
  copyNotificationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Mobile 4-row layout styles
  playerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  playerTopRowCompact: {
    marginBottom: 4,
    paddingHorizontal: 4,
    height: 30,
  },
  playerNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  playerNameTextMobile: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  playerControlsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorButtonCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorButtonTextCompact: {
    fontSize: 12,
  },
  removeButtonCompact: {
    fontSize: 14,
    opacity: 0.8,
  },
  playerStatsCompact: {
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    height: 28,
    justifyContent: 'center',
  },
  statTextMobile: {
    fontSize: 10,
    color: '#a0aec0',
    fontWeight: '500',
  },
  playerNameInputMobile: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: '#ffffff',
  },
  removeButtonTouchArea: {
    padding: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerMobile: {
    position: 'absolute',
    top: 35,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(42, 42, 78, 0.95)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  colorPickerTitleMobile: {
    fontSize: 12,
    marginBottom: 6,
  },
  colorGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  colorOptionMobile: {
    width: 20,
    height: 20,
    borderRadius: 10,
    margin: 1,
  },
  selectedColorCheckMobile: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  // New 5-row layout styles
  playerControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  playerControlsRowMobile: {
    paddingVertical: 2,
    marginBottom: 4,
  },
  playerNameRow: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  playerNameRowMobile: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
  },
  playerNameTouchArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  playerNameTextMobileLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  playerNameInputMobileLarge: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#ffffff',
    minHeight: 36,
  },
  playerButtonSectionMobile: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerButtonMobileSquare: {
    width: '90%',
    aspectRatio: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
  },
  playerButtonTextMobileSquare: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerStatsBottom: {
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    height: 24,
    justifyContent: 'center',
    borderRadius: 4,
  },
});

export default React.memo(BoardGameTimer);