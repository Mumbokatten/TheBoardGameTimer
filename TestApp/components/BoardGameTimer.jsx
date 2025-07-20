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
  const { getDatabase, ref, set, update, onValue, get, off } = require('firebase/database');
  
  // Your Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDvUsG3RjdSUH_oDlj9SO5HC5-4onfhV8k",
    authDomain: "bgtimer-fa2c3.firebaseapp.com",
    databaseURL: "https://bgtimer-fa2c3-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bgtimer-fa2c3",
    storageBucket: "bgtimer-fa2c3.firebasestorage.app",
    messagingSenderId: "937157472924",
    appId: "1:937157472924:web:5ff1c2c4ccfc3bcd8c7359",
    measurementId: "G-H1NMZLJV74"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  firebase = { app, database, ref, set, update, onValue, get, off };
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

// Auto-sizing logic that ensures no scrolling
const getOptimalLayout = (playerCount) => {
  if (playerCount <= 1) return { cols: 1, size: 'large' };
  if (playerCount === 2) return { cols: 2, size: 'large' };
  if (playerCount <= 4) return { cols: 2, size: 'medium' };
  if (playerCount <= 6) return { cols: 3, size: 'small' };
  if (playerCount <= 9) return { cols: 3, size: 'compact' };
  return { cols: 4, size: 'compact' }; // For 10+ players
};

// Screen Components - MUST be outside main component to prevent focus loss
const HomeScreen = ({ 
  theme, 
  gameHistory, 
  createNewGame, 
  setCurrentScreen, 
  setShowSettings,
  deleteGame
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
        onPress={createNewGame}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>🎮 Create New Game</Text>
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
            <TouchableOpacity 
              style={styles.deleteGameButton}
              onPress={() => deleteGame(game.id)}
            >
              <Text style={styles.deleteGameText}>🗑️</Text>
            </TouchableOpacity>
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
  setCurrentScreen 
}) => (
  <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>📱 Join Game</Text>
      <Text style={styles.subtitle}>Enter the 6-character game ID to join</Text>
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

const GameHistoryScreen = ({ gameHistory, setCurrentScreen, formatTime, deleteGame, loadSavedGame }) => (
  <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.headerRow}>
      <Text style={styles.title}>🏆 Game History</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
        <Text style={styles.backButtonText}>🏠 Home</Text>
      </TouchableOpacity>
    </View>

    {gameHistory.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No games saved yet</Text>
        <Text style={styles.emptySubtitle}>Play a game and save it to see it here!</Text>
      </View>
    ) : (
      <View style={styles.historyList}>
        {gameHistory.map(game => (
          <View key={game.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={styles.historyHeaderText}>
                <Text style={styles.historyGameName}>{game.name}</Text>
                <Text style={styles.historyDate}>{new Date(game.date).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteGameButton}
                onPress={() => deleteGame(game.id)}
              >
                <Text style={styles.deleteGameText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.historyTotal}>Total Time: {formatTime(game.totalTime)}</Text>
            
            <View style={styles.historyPlayers}>
              {game.players.map((player, idx) => (
                <Text key={idx} style={styles.historyPlayer}>
                  {player.name}: {player.formattedTime}
                </Text>
              ))}
            </View>
            
            <View style={styles.historyActions}>
              <TouchableOpacity 
                style={styles.continueGameButton}
                onPress={() => loadSavedGame(game)}
              >
                <Text style={styles.continueGameText}>▶️ Continue</Text>
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
  players,
  getPlayerGridCols,
  showColorPicker,
  setShowColorPicker,
  handlePlayerNameChange,
  removePlayer,
  PLAYER_COLORS,
  updatePlayerColor,
  timerMode,
  formatTime,
  getAverageTurnTime,
  startPlayerTurn,
  lastActionState,
  undoLastAction
}) => (
  <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.title}>
          {gameId ? `Game: ${gameId}` : '🎲 Board Game Timer'}
        </Text>
        {firebase && gameId && (
          <Text style={[
            styles.connectionStatus,
            connectionStatus === 'connected' && styles.connectedStatus,
            connectionStatus === 'connecting' && styles.connectingStatus,
            connectionStatus === 'error' && styles.errorStatus
          ]}>
            {connectionStatus === 'connected' && '🔥 Connected'}
            {connectionStatus === 'connecting' && '⏳ Connecting...'}
            {connectionStatus === 'error' && '❌ Connection Error'}
            {connectionStatus === 'local' && '💾 Local Mode'}
            {connectionStatus === 'offline' && '📱 Offline'}
          </Text>
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

    <TextInput
      key="game-name-input"
      style={styles.gameNameInput}
      placeholder="Enter game name (optional)"
      placeholderTextColor="#999"
      value={currentGameName}
      onChangeText={handleGameNameChange}
      autoComplete="off"
      selectTextOnFocus={true}
    />

    <View style={styles.controlsContainer}>
      <TouchableOpacity 
        style={[styles.controlButton, styles.addButton]} 
        onPress={addPlayer}
      >
        <Text style={styles.controlButtonText}>➕ Add Player</Text>
      </TouchableOpacity>
      
      {!isRunning ? (
        <TouchableOpacity 
          style={[styles.controlButton, styles.playButton, activePlayerId === null && styles.disabledButton]} 
          onPress={resumeGame}
          disabled={activePlayerId === null}
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
          <TouchableOpacity style={[styles.controlButton, styles.finishButton]} onPress={finishGame}>
            <Text style={styles.controlButtonText}>🏁 Finish</Text>
          </TouchableOpacity>
          {lastActionState && (
            <TouchableOpacity style={[styles.controlButton, styles.undoButton]} onPress={undoLastAction}>
              <Text style={styles.controlButtonText}>↶ Undo</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      
      <TouchableOpacity 
        style={[styles.controlButton, styles.resetButton]} 
        onPress={resetGame}
      >
        <Text style={styles.controlButtonText}>🔄 Reset</Text>
      </TouchableOpacity>
    </View>

    <View style={[styles.playersGrid, { 
      flexDirection: getPlayerGridCols() === 1 ? 'column' : 'row',
      flexWrap: getPlayerGridCols() > 1 ? 'wrap' : 'nowrap'
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
              getPlayerGridCols() > 1 && { 
                width: getPlayerGridCols() === 2 ? '48%' : '31%',
                marginBottom: 8
              }
            ]}
          >
            <View style={styles.playerHeader}>
              <View style={styles.playerControls}>
                <TouchableOpacity 
                  style={[styles.colorButton, { backgroundColor: player.color }]}
                  onPress={() => setShowColorPicker(showColorPicker === player.id ? null : player.id)}
                >
                  <Text style={styles.colorButtonText}>🎨</Text>
                </TouchableOpacity>
                {players.length > 2 && (
                  <TouchableOpacity 
                    onPress={() => removePlayer(player.id)}
                  >
                    <Text style={styles.removeButton}>❌</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <TextInput
              key={`player-name-${player.id}`}
              style={[
                styles.playerNameInput,
                {
                  fontSize: player.name.length > 15 ? (player.name.length > 20 ? 12 : 14) : 16,
                  lineHeight: player.name.length > 15 ? (player.name.length > 20 ? 14 : 16) : 20,
                }
              ]}
              value={player.name}
              onChangeText={handlePlayerNameChange(player.id)}
              autoComplete="off"
              selectTextOnFocus={true}
              editable={true}
              maxLength={24}
              multiline={true}
              scrollEnabled={false}
              placeholder="Enter player name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
            
            {showColorPicker === player.id && (
              <View style={styles.colorPicker}>
                <Text style={styles.colorPickerTitle}>Choose Color:</Text>
                <View style={styles.colorGrid}>
                  {PLAYER_COLORS.map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color.value },
                        player.color === color.value && styles.selectedColor
                      ]}
                      onPress={() => {
                        updatePlayerColor(player.id, color.value);
                        setShowColorPicker(null);
                      }}
                    >
                      {player.color === color.value && (
                        <Text style={styles.selectedColorCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            <View style={styles.timeContainer}>
              <Text style={[
                styles.timeDisplay,
                timerMode === 'countdown' && player.time <= 60 && styles.urgentTime
              ]}>
                {formatTime(player.time)}
              </Text>
              {timerMode === 'countdown' && player.time <= 60 && player.time > 0 && (
                <Text style={styles.urgentText}>TIME RUNNING OUT!</Text>
              )}
              
              <View style={styles.playerStats}>
                <Text style={styles.statText}>
                  🎯 Turns: {player.turns || 0}
                </Text>
                <Text style={styles.statText}>
                  ⏱️ Avg: {formatTime(getAverageTurnTime(player))}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[
                styles.playerButton,
                { 
                  backgroundColor: player.isActive && isRunning ? player.color : player.color + '80',
                  borderColor: player.color,
                  borderWidth: 2
                },
                getPlayerGridCols() > 2 && styles.playerButtonCompact
              ]}
              onPress={() => startPlayerTurn(player.id)}
            >
              <View style={styles.playerButtonContent}>
                <Text style={[
                  styles.playerButtonText,
                  getPlayerGridCols() > 2 && styles.playerButtonTextCompact,
                  { color: player.isActive && isRunning ? '#ffffff' : '#ffffff' }
                ]}>
                  {player.isActive && isRunning ? '⏸️ Active' : '▶️ Start'}
                </Text>
                <Text style={[
                  styles.playerButtonTime,
                  getPlayerGridCols() > 2 && styles.playerButtonTimeCompact
                ]}>
                  {formatTime(player.time)}
                </Text>
              </View>
            </TouchableOpacity>
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
  const [theme, setTheme] = useState('dark');
  const [playTurnSounds, setPlayTurnSounds] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [lastActionState, setLastActionState] = useState(null); // For undo functionality
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [allowGuestControl, setAllowGuestControl] = useState(false);
  const [allowGuestNames, setAllowGuestNames] = useState(false); // Separate control for names
  const [isHostUser, setIsHostUser] = useState(true);
  const [lastActivePlayerId, setLastActivePlayerId] = useState(null);
  
  const [showColorPicker, setShowColorPicker] = useState(null);
  
  const intervalRef = useRef();
  const gameRef = useRef(null);
  const playerId = useRef(`player_${Date.now()}_${Math.random().toString(36).substring(2)}`);
  const gameNameDebounceRef = useRef();
  const joinGameIdDebounceRef = useRef();
  const playerNameDebounceRefs = useRef({});
  const autoSaveRef = useRef();
  const lastActiveTimeRef = useRef(Date.now());
  const wasRunningRef = useRef(false);

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
  }, [gameStarted, players, activePlayerId, isRunning, currentGameName]);

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

  // Timer effect
  useEffect(() => {
    if (isRunning && activePlayerId !== null) {
      intervalRef.current = setInterval(() => {
        setPlayers(prev => {
          const updated = prev.map(player => {
            if (player.id === activePlayerId) {
              const newTime = timerMode === 'countup' 
                ? player.time + 1 
                : Math.max(0, player.time - 1);
              return { ...player, time: newTime };
            }
            return player;
          });
          
          // Only update if actually changed
          const hasChanged = updated.some((player, index) => player.time !== prev[index].time);
          return hasChanged ? updated : prev;
        });
      }, 1000);
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
      // Debounce all syncs to prevent loops
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 500);
    }
    
    return () => clearTimeout(syncTimeoutRef.current);
  }, [gameId, isHost]); // Minimal dependencies
  
  // Separate effect for timer state changes - allow from anyone
  useEffect(() => {
    if (firebase && gameId && gameStarted) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 1000);
    }
    
    return () => clearTimeout(syncTimeoutRef.current);
  }, [activePlayerId, isRunning]); // Timer changes sync from anyone

  // Text changes and settings sync - more responsive
  const gameNameTimeoutRef = useRef();
  useEffect(() => {
    if (firebase && gameId && isHost) {
      clearTimeout(gameNameTimeoutRef.current);
      gameNameTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 500); // Faster sync for text changes
    }
    
    return () => clearTimeout(gameNameTimeoutRef.current);
  }, [currentGameName, allowGuestControl, allowGuestNames]);

  // Immediate sync for player count changes (add/remove)
  const playerCountTimeoutRef = useRef();
  useEffect(() => {
    if (firebase && gameId) {
      clearTimeout(playerCountTimeoutRef.current);
      playerCountTimeoutRef.current = setTimeout(() => {
        syncGameStateToFirebase();
      }, 100); // Very fast sync for player changes
    }
    
    return () => clearTimeout(playerCountTimeoutRef.current);
  }, [players.length]); // Sync when player count changes

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
    const newGameId = generateGameId();
    setGameId(newGameId);
    setIsHost(true);
    setCurrentScreen('game');
    performReset(); // Use direct reset without confirmation for new games
    
    if (firebase) {
      setConnectionStatus('connecting');
      Alert.alert('Game Created!', `Game ID: ${newGameId}\n🔥 Firebase multiplayer enabled!`);
    } else {
      Alert.alert('Game Created!', `Game ID: ${newGameId}\n📱 Running in local mode.`);
    }
  };

  const joinGame = async () => {
    if (!joinGameId.trim()) return;
    
    const gameIdToJoin = joinGameId.trim().toUpperCase();
    setGameId(gameIdToJoin);
    setIsHost(false);
    setCurrentScreen('game');
    
    if (firebase) {
      setConnectionStatus('connecting');
      
      // Try to load existing game data
      try {
        const gameRef = firebase.ref(firebase.database, `games/${gameIdToJoin}`);
        const snapshot = await firebase.get(gameRef);
        
        if (snapshot.exists()) {
          Alert.alert('Joined Game!', `🔥 Connected to multiplayer game: ${gameIdToJoin}`);
        } else {
          Alert.alert('Joined Game!', `🔥 Firebase enabled for game: ${gameIdToJoin}`);
        }
      } catch (error) {
        console.log('Error loading game:', error);
        Alert.alert('Joined Game!', `🔥 Firebase enabled for game: ${gameIdToJoin}`);
      }
    } else {
      Alert.alert('Joined Game!', `📱 Playing locally with ID: ${gameIdToJoin}`);
    }
  };

  const shareGame = async () => {
    if (gameId) {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(gameId);
          // Show a proper web alert
          alert(`✅ Copied! Session ID "${gameId}" copied to clipboard`);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = gameId;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          alert(`✅ Copied! Session ID "${gameId}" copied to clipboard`);
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

  const addPlayer = () => {
    // Check guest permissions for adding players
    if (!isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest control.');
      return;
    }
    
    saveStateForUndo(); // Save state for undo
    const newId = Math.max(...players.map(p => p.id)) + 1;
    const newPlayer = {
      id: newId,
      name: `Player ${newId}`,
      time: timerMode === 'countdown' ? initialTime : 0,
      isActive: false,
      color: getNextPlayerColor(),
      turns: 0,
      totalTurnTime: 0,
      turnStartTime: null
    };
    setPlayers([...players, newPlayer]);
  };

  const removePlayer = (id) => {
    // Check guest permissions for removing players
    if (!isHostUser && !allowGuestControl) {
      Alert.alert('Not Allowed', 'The host has disabled guest control.');
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
    // Allow typing, update immediately
    setPlayers(prev => prev.map(player => 
      player.id === id ? { ...player, name } : player
    ));
    
    // Immediate sync for name changes
    if (firebase && gameId) {
      setTimeout(() => {
        syncGameStateToFirebase();
      }, 300); // Quick sync for name changes
    }
    
    // Check guest permissions for name editing specifically
    if (!isHostUser && !allowGuestNames && name.length > 0) {
      setTimeout(() => {
        Alert.alert('Note', 'The host has disabled guest name editing. Your changes may not be saved.');
      }, 1000);
    }
  }, [isHostUser, allowGuestNames, firebase, gameId]);

  const updatePlayerColor = useCallback((playerId, color) => {
    // Check guest permissions for changing player colors (use allowGuestNames for colors too)
    if (!isHostUser && !allowGuestNames) {
      Alert.alert('Not Allowed', 'The host has disabled guest name and color editing.');
      return;
    }
    
    setPlayers(prev => prev.map(player => 
      player.id === playerId ? { ...player, color } : player
    ));
  }, [isHostUser, allowGuestNames]);

  const handleGameNameChange = useCallback((text) => {
    // Allow typing, but show warning after typing if not allowed
    setCurrentGameName(text);
    
    // Check guest permissions after a delay (game name uses allowGuestNames)
    if (!isHostUser && !allowGuestNames && text.length > 0) {
      setTimeout(() => {
        Alert.alert('Note', 'The host has disabled guest name editing. Your changes may not be saved.');
      }, 1000);
    }
  }, [isHostUser, allowGuestNames]);

  const handleJoinGameIdChange = useCallback((text) => {
    setJoinGameId(text.toUpperCase());
  }, []);

  const handlePlayerNameChange = useCallback((playerId) => 
    (text) => {
      console.log('Player name changing:', playerId, text);
      updatePlayerName(playerId, text);
    }, [updatePlayerName]
  );


  // Firebase sync functions with local fallback
  const syncGameStateToFirebase = async () => {
    if (!gameId) return;
    
    const gameData = {
      players,
      activePlayerId,
      isRunning,
      gameStarted,
      timerMode,
      initialTime,
      currentGameName,
      lastUpdated: Date.now(),
      hostId: playerId.current,
      allowGuestControl,
      allowGuestNames
    };

    if (firebase && firebase.database) {
      try {
        await firebase.set(firebase.ref(firebase.database, `games/${gameId}`), gameData);
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

  const listenToGameChanges = () => {
    if (!firebase || !firebase.database || !gameId) return;

    const gameRef = firebase.ref(firebase.database, `games/${gameId}`);
    
    const unsubscribe = firebase.onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.lastUpdated) {
        // Update if this change came from another player
        if (data.hostId !== playerId.current) {
          // Batch updates to prevent multiple re-renders
          const updates = {
            players: data.players || [],
            activePlayerId: data.activePlayerId,
            isRunning: data.isRunning || false,
            gameStarted: data.gameStarted || false,
            timerMode: data.timerMode || 'countup',
            initialTime: data.initialTime || 600,
            currentGameName: data.currentGameName || '',
            allowGuestControl: data.allowGuestControl || false,
            allowGuestNames: data.allowGuestNames || false,
            isHostUser: data.hostId === playerId.current
          };
          
          // Apply all updates at once
          setPlayers(updates.players);
          setActivePlayerId(updates.activePlayerId);
          setIsRunning(updates.isRunning);
          setGameStarted(updates.gameStarted);
          setAllowGuestControl(updates.allowGuestControl);
          setAllowGuestNames(updates.allowGuestNames);
          setIsHostUser(updates.isHostUser);
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
    // Timer controls always work - no restrictions needed for clicking timers
    
    // If clicking the active player, toggle pause/resume
    if (newPlayerId === activePlayerId && gameStarted) {
      if (isRunning) {
        pauseGame();
      } else {
        resumeGame();
      }
      return;
    }
    
    saveStateForUndo(); // Save state for undo
    const currentTime = Date.now();
    
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
        // Start new player's turn (don't increment turn count yet - wait until turn ends)
        return {
          ...player,
          isActive: true,
          turnStartTime: currentTime
        };
      }
      return { ...player, isActive: false };
    }));
    
    setActivePlayerId(newPlayerId);
    setIsRunning(true);
    setGameStarted(true);
    
    // Play turn sound if enabled
    if (playTurnSounds) {
      playTurnSound();
    }
    
    // Vibrate on mobile if supported
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Short vibration pattern
    }
    
    // Sync to Firebase if available (timer actions sync for everyone)
    if (firebase && gameId) {
      syncGameStateToFirebase();
    }
  };

  const pauseGame = () => {
    saveStateForUndo(); // Save state for undo
    // Store the last active player for resume
    if (activePlayerId) {
      setLastActivePlayerId(activePlayerId);
      const currentTime = Date.now();
      setPlayers(prev => prev.map(player => {
        if (player.id === activePlayerId && player.isActive) {
          const turnDuration = player.turnStartTime ? currentTime - player.turnStartTime : 0;
          return {
            ...player,
            isActive: false,
            turns: (player.turns || 0) + 1,
            totalTurnTime: (player.totalTurnTime || 0) + turnDuration,
            turnStartTime: null
          };
        }
        return player;
      }));
    }
    setIsRunning(false);
    setActivePlayerId(null);
  };
  
  const resumeGame = () => {
    // Resume with the last active player if no current active player
    const playerToResume = activePlayerId || lastActivePlayerId;
    if (playerToResume !== null) {
      if (!activePlayerId) {
        // Restart the last active player's timer
        setActivePlayerId(playerToResume);
        setPlayers(prev => prev.map(player => ({
          ...player,
          isActive: player.id === playerToResume,
          turnStartTime: player.id === playerToResume ? Date.now() : null
        })));
      }
      setIsRunning(true);
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

  const performReset = () => {
    console.log('Performing reset');
    setIsRunning(false);
    setActivePlayerId(null);
    setLastActivePlayerId(null);
    setGameStarted(false);
    const resetTime = timerMode === 'countdown' ? initialTime : 0;
    setPlayers(prev => prev.map(player => ({
      ...player,
      time: resetTime,
      isActive: false,
      turns: 0,
      totalTurnTime: 0,
      turnStartTime: null
    })));
    Alert.alert('Game Reset', 'The game has been reset successfully.');
  };

  const finishGame = () => {
    if (!gameStarted) return;
    
    showAlert(
      'Finish Game',
      'Save this game and start fresh?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish & Save',
          onPress: () => {
            saveGame();
            performReset();
            Alert.alert('Game Finished', 'Game saved successfully and reset for a new game!');
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
    
    const gameData = {
      id: Date.now(),
      name: currentGameName || `Game ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      players: players.map(p => ({
        name: p.name,
        time: p.time,
        formattedTime: formatTime(p.time),
        color: p.color
      })),
      timerMode,
      totalTime: players.reduce((sum, p) => sum + p.time, 0)
    };
    
    const newHistory = [gameData, ...gameHistory];
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
  const loadSavedGame = (game) => {
    showAlert(
      'Continue Game',
      `Start a new session continuing from "${game.name}"? This will create a new save when you save again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // Reset current game state but keep it as a new session
            setGameId(''); // New session, no multiplayer ID
            setIsHost(false);
            setIsHostUser(true);
            setAllowGuestControl(false);
            
            // Load saved game data with new session naming
            const loadedPlayers = game.players.map((p, index) => ({
              id: index + 1,
              name: p.name,
              time: p.time,
              isActive: false,
              color: p.color,
              turns: 0,
              totalTurnTime: 0,
              turnStartTime: null
            }));
            
            setPlayers(loadedPlayers);
            setCurrentGameName(game.name + ' (Continued)');
            setTimerMode(game.timerMode || 'countup');
            setActivePlayerId(null);
            setIsRunning(false);
            setGameStarted(true); // Mark as started so controls are available
            setCurrentScreen('game');
            
            Alert.alert('Session Started', `New session created from "${game.name}". You can now continue playing and save as a new game!`);
          }
        }
      ]
    );
  };

  // Undo last action
  const undoLastAction = () => {
    if (lastActionState) {
      setPlayers(lastActionState.players);
      setActivePlayerId(lastActionState.activePlayerId);
      setIsRunning(lastActionState.isRunning);
      setGameStarted(lastActionState.gameStarted);
      setLastActionState(null);
      Alert.alert('Undone', 'Last action has been undone');
    }
  };

  // Save state for undo
  const saveStateForUndo = () => {
    setLastActionState({
      players: [...players],
      activePlayerId,
      isRunning,
      gameStarted
    });
  };

  const getNextPlayerColor = () => {
    const usedColors = new Set(players.map(p => p.color));
    const availableColor = PLAYER_COLORS.find(color => !usedColors.has(color.value));
    return availableColor ? availableColor.value : PLAYER_COLORS[0].value;
  };



  const getAverageTurnTime = (player) => {
    if (player.turns === 0) return 0;
    return Math.round(player.totalTurnTime / player.turns / 1000); // in seconds
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
      return getOptimalLayout(players.length).cols;
    }
    
    const size = getPlayerBoxSize().toLowerCase();
    if (size === 'large') return players.length === 1 ? 1 : 2;
    if (size === 'medium') return 2;
    if (size === 'small') return 3;
    return 4; // compact
  };



  return (
    <View style={styles.app}>

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚙️ Settings</Text>
            
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

            {timerMode === 'countdown' && (
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Initial Time (minutes)</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(initialTime / 60)}
                  onChangeText={(text) => setInitialTime(parseInt(text) * 60 || 600)}
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
                      onPress={() => setAllowGuestControl(!allowGuestControl)}
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
                      onPress={() => setAllowGuestControl(!allowGuestControl)}
                    >
                      <Text style={[
                        styles.settingOptionText,
                        !allowGuestControl && styles.settingOptionTextActive
                      ]}>🔒 Host Only</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.settingSection}>
                  <Text style={styles.settingLabel}>Guest Name Editing</Text>
                  <View style={styles.settingOptions}>
                    <TouchableOpacity
                      style={[
                        styles.settingOption,
                        allowGuestNames && styles.settingOptionActive
                      ]}
                      onPress={() => setAllowGuestNames(!allowGuestNames)}
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
                      onPress={() => setAllowGuestNames(!allowGuestNames)}
                    >
                      <Text style={[
                        styles.settingOptionText,
                        !allowGuestNames && styles.settingOptionTextActive
                      ]}>🔒 Locked</Text>
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
          players={players}
          getPlayerGridCols={getPlayerGridCols}
          showColorPicker={showColorPicker}
          setShowColorPicker={setShowColorPicker}
          handlePlayerNameChange={handlePlayerNameChange}
          removePlayer={removePlayer}
          PLAYER_COLORS={PLAYER_COLORS}
          updatePlayerColor={updatePlayerColor}
          timerMode={timerMode}
          formatTime={formatTime}
          getAverageTurnTime={getAverageTurnTime}
          startPlayerTurn={startPlayerTurn}
          lastActionState={lastActionState}
          undoLastAction={undoLastAction}
        />
      )}
      {currentScreen === 'history' && (
        <GameHistoryScreen 
          gameHistory={gameHistory}
          setCurrentScreen={setCurrentScreen}
          formatTime={formatTime}
          deleteGame={deleteGame}
          loadSavedGame={loadSavedGame}
        />
      )}
      {currentScreen === 'join' && (
        <JoinGameScreen 
          joinGameId={joinGameId}
          handleJoinGameIdChange={handleJoinGameIdChange}
          joinGame={joinGame}
          setCurrentScreen={setCurrentScreen}
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
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
  },
  statText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textShadow: '1px 1px 2px #000000',
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
  },
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
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
    gap: 12,
    justifyContent: 'space-between',
  },
  playerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 140,
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
    width: '100%', // Take full width now that controls are above
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    height: 50, // Fixed height - no growing
    marginBottom: 12, // Space below name input
    textAlign: 'center', // Center the player name
    textAlignVertical: 'center', // Center vertically
    lineHeight: 20, // Base line height - will be overridden dynamically
    outlineStyle: 'none',
    cursor: 'text',
    pointerEvents: 'auto',
  },
  removeButton: {
    fontSize: 16,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 12,
    flex: 1,
    justifyContent: 'center',
  },
  timeDisplay: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
    textAlign: 'center',
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
  playerButton: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
  playerButtonCompact: {
    padding: 6,
    minHeight: 32,
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
  historyPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyPlayer: {
    fontSize: 12,
    color: '#a0aec0',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 6,
    borderRadius: 4,
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
});

export default React.memo(BoardGameTimer);