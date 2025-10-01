import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tello EDU</Text>
        <Text style={styles.subtitle}>Drone Control App</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Control your DJI Tello EDU drone with advanced SDK 2.0 and 3.0 features
        </Text>

        <View style={styles.features}>
          <Text style={styles.featureItem}>✓ Real-time video streaming</Text>
          <Text style={styles.featureItem}>✓ Flight control and telemetry</Text>
          <Text style={styles.featureItem}>✓ Mission pad support</Text>
          <Text style={styles.featureItem}>✓ LED control (EXT commands)</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Link href="/connect" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Connect to Drone</Text>
          </Pressable>
        </Link>

        <Text style={styles.instructions}>
          Make sure your device is connected to the Tello WiFi network before proceeding.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 32,
  },
  features: {
    gap: 12,
  },
  featureItem: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  actions: {
    padding: 24,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
