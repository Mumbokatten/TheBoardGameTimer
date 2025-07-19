import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';

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
  
  const [showColorPicker, setShowColorPicker] = useState(null);
  
  const intervalRef = useRef();
  const gameRef = useRef(null);
  const playerId = useRef(`player_${Date.now()}_${Math.random().toString(36).substring(2)}`);
  const gameNameDebounceRef = useRef();
  const joinGameIdDebounceRef = useRef();
  const playerNameDebounceRefs = useRef({});

  // Timer effect
  useEffect(() => {
    if (isRunning && activePlayerId !== null) {
      intervalRef.current = setInterval(() => {
        setPlayers(prev => prev.map(player => {
          if (player.id === activePlayerId) {
            const newTime = timerMode === 'countup' 
              ? player.time + 1 
              : Math.max(0, player.time - 1);
            return { ...player, time: newTime };
          }
          return player;
        }));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, activePlayerId, timerMode]);


  // Firebase game state sync effect (immediate for game controls, debounced only for text)
  useEffect(() => {
    if (firebase && gameId && isHost) {
      syncGameStateToFirebase();
    }
  }, [players, activePlayerId, isRunning, gameStarted, timerMode, initialTime]);

  // Separate debounced sync for text changes only
  useEffect(() => {
    if (firebase && gameId && isHost) {
      const timeoutId = setTimeout(() => {
        syncGameStateToFirebase();
      }, 1500); // Only debounce text changes

      return () => clearTimeout(timeoutId);
    }
  }, [currentGameName]);

  // Firebase listener effect
  useEffect(() => {
    if (firebase && gameId) {
      const unsubscribe = listenToGameChanges();
      syncPlayerJoin();
      
      return () => {
        if (unsubscribe) {
          firebase.off(unsubscribe);
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
    resetGame();
    
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
          Alert.alert('Copied!', `Session ID "${gameId}" copied to clipboard`);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = gameId;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          Alert.alert('Copied!', `Session ID "${gameId}" copied to clipboard`);
        }
      } catch (error) {
        console.log('Copy failed:', error);
        const modeText = firebase && isOnline 
          ? '🔥 Multiplayer enabled with Firebase!'
          : '📱 Running in local mode.';
        const shareText = `Game ID: ${gameId}\n\n${modeText}`;
        Alert.alert('Share Game', shareText);
      }
    }
  };

  const addPlayer = () => {
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
    if (players.length > 2) {
      setPlayers(players.filter(p => p.id !== id));
      if (activePlayerId === id) {
        setActivePlayerId(null);
        setIsRunning(false);
      }
    }
  };

  const updatePlayerName = (id, name) => {
    setPlayers(prev => prev.map(player => 
      player.id === id ? { ...player, name } : player
    ));
  };


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
      hostId: playerId.current
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
        // Only update if this change came from another player
        if (data.hostId !== playerId.current) {
          setPlayers(data.players || []);
          setActivePlayerId(data.activePlayerId);
          setIsRunning(data.isRunning || false);
          setGameStarted(data.gameStarted || false);
          setTimerMode(data.timerMode || 'countup');
          setInitialTime(data.initialTime || 600);
          setCurrentGameName(data.currentGameName || '');
          setTempGameName(data.currentGameName || '');
          
          // Update temp player names
          const newTempNames = {};
          data.players?.forEach(player => {
            newTempNames[player.id] = player.name;
          });
          setTempPlayerNames(newTempNames);
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
  };

  const pauseGame = () => {
    // End current player's turn when pausing
    if (activePlayerId) {
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
  
  const resumeGame = () => { if (activePlayerId !== null) setIsRunning(true); };

  const nextPlayer = () => {
    const currentIndex = players.findIndex(p => p.id === activePlayerId);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayerId = players[nextIndex].id;
    startPlayerTurn(nextPlayerId);
  };

  const resetGame = () => {
    setIsRunning(false);
    setActivePlayerId(null);
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
    
    setGameHistory(prev => [gameData, ...prev]);
    Alert.alert('Success', 'Game saved successfully!');
  };

  const getNextPlayerColor = () => {
    const usedColors = new Set(players.map(p => p.color));
    const availableColor = PLAYER_COLORS.find(color => !usedColors.has(color.value));
    return availableColor ? availableColor.value : PLAYER_COLORS[0].value;
  };

  const updatePlayerColor = (playerId, color) => {
    setPlayers(prev => prev.map(player => 
      player.id === playerId ? { ...player, color } : player
    ));
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

  // Screen Components
  const HomeScreen = () => (
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
              <Text style={[styles.gameName, theme === 'light' && styles.lightText]}>{game.name}</Text>
              <Text style={[styles.gameDate, theme === 'light' && styles.lightSubtext]}>{new Date(game.date).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const JoinGameScreen = () => (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 Join Game</Text>
        <Text style={styles.subtitle}>Enter the 6-character game ID to join</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Game ID (e.g. ABC123)"
          placeholderTextColor="#999"
          value={joinGameId}
          onChangeText={(text) => setJoinGameId(text.toUpperCase())}
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

  const GameHistoryScreen = () => (
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
                <Text style={styles.historyGameName}>{game.name}</Text>
                <Text style={styles.historyDate}>{new Date(game.date).toLocaleDateString()}</Text>
              </View>
              
              <Text style={styles.historyTotal}>Total Time: {formatTime(game.totalTime)}</Text>
              
              <View style={styles.historyPlayers}>
                {game.players.map((player, idx) => (
                  <Text key={idx} style={styles.historyPlayer}>
                    {player.name}: {player.formattedTime}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const GameScreen = () => (
    <ScrollView contentContainerStyle={styles.container}>

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
        style={styles.gameNameInput}
        placeholder="Enter game name (optional)"
        placeholderTextColor="#999"
        value={currentGameName}
        onChangeText={(text) => {
          console.log('Game name changing:', text);
          setCurrentGameName(text);
        }}
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
            <TouchableOpacity 
              style={[styles.controlButton, styles.nextButton]} 
              onPress={nextPlayer}
            >
              <Text style={styles.controlButtonText}>⏭️ Next</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.saveButton]} onPress={saveGame}>
              <Text style={styles.controlButtonText}>💾 Save</Text>
            </TouchableOpacity>
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
                <TextInput
                  style={styles.playerNameInput}
                  value={player.name}
                  onChangeText={(text) => {
                    console.log('Player name changing:', player.id, text);
                    updatePlayerName(player.id, text);
                  }}
                  autoComplete="off"
                  selectTextOnFocus={true}
                  editable={true}
                />
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
                  }
                ]}
                onPress={() => startPlayerTurn(player.id)}
                disabled={player.isActive && isRunning}
              >
                <Text style={[
                  styles.playerButtonText,
                  { color: player.isActive && isRunning ? '#ffffff' : '#ffffff' }
                ]}>
                  {player.isActive && isRunning ? '⏸️ Active Turn' : '▶️ Start Turn'}
                </Text>
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
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {currentScreen === 'home' && <HomeScreen />}
      {currentScreen === 'game' && <GameScreen />}
      {currentScreen === 'history' && <GameHistoryScreen />}
      {currentScreen === 'join' && <JoinGameScreen />}
    </View>
  );
};

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#1a1a2e',
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
    paddingVertical: 8,
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
  resetButton: {
    backgroundColor: '#ef4444',
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 160,
  },
  activePlayerCard: {
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 36,
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
    fontSize: 32,
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
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  playerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  statsContainer: {
    marginTop: 20,
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
    marginBottom: 8,
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

export default BoardGameTimer;