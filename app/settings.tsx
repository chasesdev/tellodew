import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, TextInput, Alert } from 'react-native';
import { getTelloService } from './connect';

export default function SettingsScreen() {
  const tello = getTelloService();
  const [loading, setLoading] = useState(false);

  // Mission Pad settings
  const [missionPadEnabled, setMissionPadEnabled] = useState(false);
  const [missionPadDirection, setMissionPadDirection] = useState<0 | 1 | 2>(0);

  // Video settings
  const [videoBitrate, setVideoBitrate] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [videoResolution, setVideoResolution] = useState<'high' | 'low'>('high');
  const [videoFPS, setVideoFPS] = useState<'high' | 'middle' | 'low'>('high');
  const [videoCameraDirection, setVideoCameraDirection] = useState<0 | 1 | 2>(0);

  // WiFi settings
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  // Query results
  const [queryResults, setQueryResults] = useState<Record<string, string>>({});

  const handleToggleMissionPads = async () => {
    setLoading(true);
    try {
      const response = missionPadEnabled
        ? await tello.disableMissionPads()
        : await tello.enableMissionPads();

      if (response.success) {
        setMissionPadEnabled(!missionPadEnabled);
        Alert.alert('Success', `Mission pads ${missionPadEnabled ? 'disabled' : 'enabled'}`);
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to toggle mission pads');
    } finally {
      setLoading(false);
    }
  };

  const handleSetMissionPadDirection = async (direction: 0 | 1 | 2) => {
    setLoading(true);
    try {
      const response = await tello.setMissionPadDetectionDirection(direction);
      if (response.success) {
        setMissionPadDirection(direction);
        const dirText = ['Downward', 'Forward', 'Both'][direction];
        Alert.alert('Success', `Detection direction set to ${dirText}`);
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set direction');
    } finally {
      setLoading(false);
    }
  };

  const handleSetVideoBitrate = async (bitrate: 0 | 1 | 2 | 3 | 4 | 5) => {
    setLoading(true);
    try {
      const response = await tello.setVideoBitrate(bitrate);
      if (response.success) {
        setVideoBitrate(bitrate);
        const bitrateText = bitrate === 0 ? 'Auto' : `${bitrate} Mbps`;
        Alert.alert('Success', `Bitrate set to ${bitrateText}`);
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set bitrate');
    } finally {
      setLoading(false);
    }
  };

  const handleSetVideoResolution = async (resolution: 'high' | 'low') => {
    setLoading(true);
    try {
      const response = await tello.setVideoResolution(resolution);
      if (response.success) {
        setVideoResolution(resolution);
        Alert.alert('Success', `Resolution set to ${resolution === 'high' ? '720p' : '480p'}`);
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set resolution');
    } finally {
      setLoading(false);
    }
  };

  const handleSetVideoFPS = async (fps: 'high' | 'middle' | 'low') => {
    setLoading(true);
    try {
      const response = await tello.setVideoFPS(fps);
      if (response.success) {
        setVideoFPS(fps);
        const fpsText = fps === 'high' ? '30fps' : fps === 'middle' ? '15fps' : '5fps';
        Alert.alert('Success', `FPS set to ${fpsText}`);
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set FPS');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCameraDirection = async (direction: 0 | 1 | 2) => {
    setLoading(true);
    try {
      const response = await tello.setVideoCameraDirection(direction);
      if (response.success) {
        setVideoCameraDirection(direction);
        const dirText = ['Forward', 'Downward', 'Both'][direction];
        Alert.alert('Success', `Camera direction set to ${dirText}`);
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set camera direction');
    } finally {
      setLoading(false);
    }
  };

  const handleMotorOn = async () => {
    setLoading(true);
    try {
      const response = await tello.turnMotorOn();
      Alert.alert(response.success ? 'Success' : 'Error', response.message);
    } catch (error) {
      Alert.alert('Error', 'Failed to turn motors on');
    } finally {
      setLoading(false);
    }
  };

  const handleMotorOff = async () => {
    setLoading(true);
    try {
      const response = await tello.turnMotorOff();
      Alert.alert(response.success ? 'Success' : 'Error', response.message);
    } catch (error) {
      Alert.alert('Error', 'Failed to turn motors off');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async (queryType: string, queryFn: () => Promise<any>) => {
    setLoading(true);
    try {
      const response = await queryFn();
      if (response.success) {
        setQueryResults({ ...queryResults, [queryType]: response.message });
      } else {
        Alert.alert('Query Failed', response.message);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to query ${queryType}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetWifiCredentials = async () => {
    if (!wifiSSID || !wifiPassword) {
      Alert.alert('Error', 'Please enter SSID and password');
      return;
    }
    setLoading(true);
    try {
      const response = await tello.setWifiCredentials(wifiSSID, wifiPassword);
      Alert.alert(response.success ? 'Success' : 'Error', response.message);
    } catch (error) {
      Alert.alert('Error', 'Failed to set WiFi credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleReboot = async () => {
    Alert.alert(
      'Reboot Drone',
      'Are you sure you want to reboot the drone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reboot',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await tello.reboot();
              Alert.alert('Rebooting', 'Drone is rebooting...');
            } catch (error) {
              Alert.alert('Error', 'Failed to reboot');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Mission Pads Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mission Pads (SDK 3.0)</Text>

          <Pressable
            style={[styles.button, missionPadEnabled && styles.buttonActive]}
            onPress={handleToggleMissionPads}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {missionPadEnabled ? 'Disable' : 'Enable'} Mission Pads
            </Text>
          </Pressable>

          <Text style={styles.label}>Detection Direction</Text>
          <View style={styles.buttonGroup}>
            {([0, 1, 2] as const).map((dir) => (
              <Pressable
                key={dir}
                style={[styles.optionButton, missionPadDirection === dir && styles.optionButtonActive]}
                onPress={() => handleSetMissionPadDirection(dir)}
                disabled={loading}
              >
                <Text style={[styles.optionButtonText, missionPadDirection === dir && styles.optionButtonTextActive]}>
                  {['Down', 'Forward', 'Both'][dir]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Video Configuration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Configuration</Text>

          <Text style={styles.label}>Bitrate</Text>
          <View style={styles.buttonGroup}>
            {([0, 1, 2, 3, 4, 5] as const).map((rate) => (
              <Pressable
                key={rate}
                style={[styles.optionButton, videoBitrate === rate && styles.optionButtonActive]}
                onPress={() => handleSetVideoBitrate(rate)}
                disabled={loading}
              >
                <Text style={[styles.optionButtonText, videoBitrate === rate && styles.optionButtonTextActive]}>
                  {rate === 0 ? 'Auto' : `${rate}M`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Resolution</Text>
          <View style={styles.buttonGroup}>
            <Pressable
              style={[styles.optionButton, videoResolution === 'high' && styles.optionButtonActive]}
              onPress={() => handleSetVideoResolution('high')}
              disabled={loading}
            >
              <Text style={[styles.optionButtonText, videoResolution === 'high' && styles.optionButtonTextActive]}>
                720p
              </Text>
            </Pressable>
            <Pressable
              style={[styles.optionButton, videoResolution === 'low' && styles.optionButtonActive]}
              onPress={() => handleSetVideoResolution('low')}
              disabled={loading}
            >
              <Text style={[styles.optionButtonText, videoResolution === 'low' && styles.optionButtonTextActive]}>
                480p
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Frame Rate</Text>
          <View style={styles.buttonGroup}>
            {(['high', 'middle', 'low'] as const).map((fps) => (
              <Pressable
                key={fps}
                style={[styles.optionButton, videoFPS === fps && styles.optionButtonActive]}
                onPress={() => handleSetVideoFPS(fps)}
                disabled={loading}
              >
                <Text style={[styles.optionButtonText, videoFPS === fps && styles.optionButtonTextActive]}>
                  {fps === 'high' ? '30' : fps === 'middle' ? '15' : '5'} fps
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Camera Direction</Text>
          <View style={styles.buttonGroup}>
            {([0, 1, 2] as const).map((dir) => (
              <Pressable
                key={dir}
                style={[styles.optionButton, videoCameraDirection === dir && styles.optionButtonActive]}
                onPress={() => handleSetCameraDirection(dir)}
                disabled={loading}
              >
                <Text style={[styles.optionButtonText, videoCameraDirection === dir && styles.optionButtonTextActive]}>
                  {['Forward', 'Down', 'Both'][dir]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Motor Control Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motor Control</Text>
          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={handleMotorOn} disabled={loading}>
              <Text style={styles.buttonText}>Motor ON</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={handleMotorOff} disabled={loading}>
              <Text style={styles.buttonText}>Motor OFF</Text>
            </Pressable>
          </View>
        </View>

        {/* Query Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drone Information</Text>

          <View style={styles.queryGrid}>
            <Pressable
              style={styles.queryButton}
              onPress={() => handleQuery('SDK Version', () => tello.querySdkVersion())}
              disabled={loading}
            >
              <Text style={styles.queryButtonText}>SDK Version</Text>
            </Pressable>
            <Pressable
              style={styles.queryButton}
              onPress={() => handleQuery('Serial Number', () => tello.querySerialNumber())}
              disabled={loading}
            >
              <Text style={styles.queryButtonText}>Serial Number</Text>
            </Pressable>
            <Pressable
              style={styles.queryButton}
              onPress={() => handleQuery('WiFi SNR', () => tello.queryWifiSNR())}
              disabled={loading}
            >
              <Text style={styles.queryButtonText}>WiFi SNR</Text>
            </Pressable>
          </View>

          {Object.keys(queryResults).length > 0 && (
            <View style={styles.queryResults}>
              {Object.entries(queryResults).map(([key, value]) => (
                <View key={key} style={styles.queryResult}>
                  <Text style={styles.queryResultLabel}>{key}:</Text>
                  <Text style={styles.queryResultValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* WiFi Configuration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WiFi Configuration</Text>

          <Text style={styles.label}>SSID</Text>
          <TextInput
            style={styles.input}
            value={wifiSSID}
            onChangeText={setWifiSSID}
            placeholder="Enter SSID"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={wifiPassword}
            onChangeText={setWifiPassword}
            placeholder="Enter password"
            placeholderTextColor="#999"
            secureTextEntry
          />

          <Pressable style={styles.button} onPress={handleSetWifiCredentials} disabled={loading}>
            <Text style={styles.buttonText}>Set WiFi Credentials</Text>
          </Pressable>
        </View>

        {/* System Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System</Text>
          <Pressable style={[styles.button, styles.dangerButton]} onPress={handleReboot} disabled={loading}>
            <Text style={styles.buttonText}>Reboot Drone</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonActive: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#555',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  queryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  queryButton: {
    backgroundColor: '#555',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  queryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  queryResults: {
    marginTop: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
  },
  queryResult: {
    marginBottom: 8,
  },
  queryResultLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  queryResultValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
});
