import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { TelloService } from '../services/TelloService';
import { ConnectionState } from '../types/tello';

// Singleton instance
let telloService: TelloService | null = null;

export function getTelloService(): TelloService {
  if (!telloService) {
    telloService = new TelloService();
  }
  return telloService;
}

export default function ConnectScreen() {
  const router = useRouter();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const tello = getTelloService();
    tello.onConnectionStateChange((state) => {
      setConnectionState(state);
      if (state === ConnectionState.CONNECTED) {
        // Navigate to fly screen after successful connection
        router.push('/fly');
      }
    });
  }, []);

  const handleConnect = async () => {
    setErrorMessage('');
    const tello = getTelloService();

    try {
      const response = await tello.connect();
      if (!response.success) {
        setErrorMessage(response.message);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const isConnecting = connectionState === ConnectionState.CONNECTING;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Connect to Tello</Text>

        <View style={styles.instructions}>
          <Text style={styles.step}>1. Power on your Tello drone</Text>
          <Text style={styles.step}>2. Go to iPhone Settings → WiFi</Text>
          <Text style={styles.step}>3. Connect to "TELLO-XXXXXX" network</Text>
          <Text style={styles.step}>4. Return to this app and tap Connect</Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, getStatusStyle(connectionState)]} />
          <Text style={styles.statusText}>{getStatusText(connectionState)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.connectButtonText}>Connect to Drone</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function getStatusText(state: ConnectionState): string {
  switch (state) {
    case ConnectionState.DISCONNECTED:
      return 'Not connected';
    case ConnectionState.CONNECTING:
      return 'Connecting...';
    case ConnectionState.CONNECTED:
      return 'Connected';
    case ConnectionState.FLYING:
      return 'Flying';
    case ConnectionState.ERROR:
      return 'Connection error';
    default:
      return 'Unknown';
  }
}

function getStatusStyle(state: ConnectionState) {
  switch (state) {
    case ConnectionState.CONNECTED:
    case ConnectionState.FLYING:
      return styles.statusConnected;
    case ConnectionState.CONNECTING:
      return styles.statusConnecting;
    case ConnectionState.ERROR:
      return styles.statusError;
    default:
      return styles.statusDisconnected;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  instructions: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  step: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDisconnected: {
    backgroundColor: '#999',
  },
  statusConnecting: {
    backgroundColor: '#FF9500',
  },
  statusConnected: {
    backgroundColor: '#34C759',
  },
  statusError: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    padding: 24,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    backgroundColor: '#999',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
