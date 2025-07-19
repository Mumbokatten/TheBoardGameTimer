import React from 'react';
import { View } from 'react-native';
import BoardGameTimer from '../components/BoardGameTimer';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <BoardGameTimer />
    </View>
  );
}