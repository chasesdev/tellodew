import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView } from 'react-native';
import Video from 'react-native-video';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { getTelloService } from './connect';
import { TelloState, ConnectionState } from '../types/tello';
import { Joystick } from '../components/Joystick';

export default function FlyScreen() {
  const tello = getTelloService();
  const [state, setState] = useState<Partial<TelloState>>({});
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.CONNECTED
  );
  const [isFlying, setIsFlying] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [controlMode, setControlMode] = useState<'buttons' | 'joystick'>('joystick');
  const rcIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Keep screen awake during flight
    activateKeepAwakeAsync();

    // Set up state listener
    tello.onStateUpdate((newState) => {
      setState(newState);
    });

    tello.onConnectionStateChange((newState) => {
      setConnectionState(newState);
      setIsFlying(newState === ConnectionState.FLYING);
    });

    return () => {
      deactivateKeepAwake();
      // Stop video stream on unmount
      if (videoEnabled) {
        tello.streamOff();
      }
    };
  }, []);

  const handleTakeoff = async () => {
    const response = await tello.takeoff();
    if (response.success) {
      setIsFlying(true);
    }
  };

  const handleLand = async () => {
    const response = await tello.land();
    if (response.success) {
      setIsFlying(false);
    }
  };

  const handleEmergency = async () => {
    await tello.emergency();
    setIsFlying(false);
  };

  const handleToggleVideo = async () => {
    if (videoEnabled) {
      await tello.streamOff();
      setVideoEnabled(false);
    } else {
      const response = await tello.streamOn();
      if (response.success) {
        setVideoEnabled(true);
      }
    }
  };

  const handleMove = async (
    direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'back'
  ) => {
    await tello.move(direction, 50); // Move 50cm
  };

  const handleRotate = async (direction: 'cw' | 'ccw') => {
    await tello.rotate(direction, 90); // Rotate 90 degrees
  };

  const handleFlip = async (direction: 'l' | 'r' | 'f' | 'b') => {
    await tello.flip(direction);
  };

  const handleStop = async () => {
    await tello.stop();
  };

  // RC Control handlers for joysticks
  const leftStickValues = useRef({ x: 0, y: 0 });
  const rightStickValues = useRef({ x: 0, y: 0 });

  const handleLeftJoystick = (x: number, y: number) => {
    // Left stick: x = left/right strafe, y = throttle (up/down)
    leftStickValues.current = { x, y };
    sendRCControl();
  };

  const handleRightJoystick = (x: number, y: number) => {
    // Right stick: x = yaw (rotate), y = pitch (forward/back)
    rightStickValues.current = { x, y };
    sendRCControl();
  };

  const sendRCControl = () => {
    const leftRight = leftStickValues.current.x;
    const upDown = leftStickValues.current.y;
    const forwardBackward = rightStickValues.current.y;
    const yaw = rightStickValues.current.x;

    tello.sendRCControl(leftRight, forwardBackward, upDown, yaw);
  };

  const battery = state.battery ?? 0;
  const height = state.height ?? 0;
  const temperature = state.tempLow ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Video Stream */}
      <View style={styles.videoContainer}>
        {videoEnabled ? (
          <Video
            source={{ uri: 'udp://@0.0.0.0:11111' }}
            style={styles.video}
            resizeMode="contain"
            paused={false}
          />
        ) : (
          <View style={styles.noVideo}>
            <Text style={styles.noVideoText}>Video Stream Disabled</Text>
            <Text style={styles.noVideoSubtext}>Tap "Enable Video" to start</Text>
          </View>
        )}

        {/* Telemetry HUD Overlay */}
        <View style={styles.hudOverlay}>
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>Battery</Text>
              <Text style={styles.telemetryValue}>{battery}%</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>Height</Text>
              <Text style={styles.telemetryValue}>{height}cm</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>Temp</Text>
              <Text style={styles.telemetryValue}>{temperature}°C</Text>
            </View>
          </View>

          {/* Mission Pad Detection */}
          {state.missionPadId !== undefined && state.missionPadId >= 0 && (
            <View style={styles.missionPadInfo}>
              <Text style={styles.missionPadTitle}>Mission Pad {state.missionPadId}</Text>
              <View style={styles.missionPadCoords}>
                <Text style={styles.missionPadCoord}>X: {state.missionPadX ?? 0}cm</Text>
                <Text style={styles.missionPadCoord}>Y: {state.missionPadY ?? 0}cm</Text>
                <Text style={styles.missionPadCoord}>Z: {state.missionPadZ ?? 0}cm</Text>
              </View>
            </View>
          )}

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, isFlying && styles.statusFlying]} />
            <Text style={styles.statusText}>{isFlying ? 'FLYING' : 'LANDED'}</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Primary Actions */}
        <View style={styles.primaryActions}>
          {!isFlying ? (
            <Pressable style={styles.takeoffButton} onPress={handleTakeoff}>
              <Text style={styles.buttonText}>Takeoff</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.landButton} onPress={handleLand}>
              <Text style={styles.buttonText}>Land</Text>
            </Pressable>
          )}

          <Pressable style={styles.emergencyButton} onPress={handleEmergency}>
            <Text style={styles.emergencyButtonText}>EMERGENCY</Text>
          </Pressable>

          <Pressable style={styles.videoButton} onPress={handleToggleVideo}>
            <Text style={styles.buttonText}>{videoEnabled ? 'Disable' : 'Enable'} Video</Text>
          </Pressable>
        </View>

        {/* Flight Controls */}
        {isFlying && (
          <ScrollView style={styles.flightControls}>
            {/* Control Mode Toggle */}
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeButton, controlMode === 'joystick' && styles.modeButtonActive]}
                onPress={() => setControlMode('joystick')}
              >
                <Text style={[styles.modeButtonText, controlMode === 'joystick' && styles.modeButtonTextActive]}>
                  Joystick
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, controlMode === 'buttons' && styles.modeButtonActive]}
                onPress={() => setControlMode('buttons')}
              >
                <Text style={[styles.modeButtonText, controlMode === 'buttons' && styles.modeButtonTextActive]}>
                  Buttons
                </Text>
              </Pressable>
            </View>

            {/* Joystick Controls */}
            {controlMode === 'joystick' ? (
              <View style={styles.joystickContainer}>
                <View style={styles.joystickWrapper}>
                  <Text style={styles.joystickLabel}>Left/Right + Throttle</Text>
                  <Joystick size={140} onMove={handleLeftJoystick} />
                </View>
                <View style={styles.joystickWrapper}>
                  <Text style={styles.joystickLabel}>Yaw + Pitch</Text>
                  <Joystick size={140} onMove={handleRightJoystick} />
                </View>
              </View>
            ) : (
              /* Button Controls */
              <View style={styles.movementControls}>
                <Text style={styles.controlsTitle}>Movement</Text>
                <View style={styles.dpad}>
                  <Pressable style={styles.dpadButton} onPress={() => handleMove('forward')}>
                    <Text style={styles.dpadText}>↑ FWD</Text>
                  </Pressable>
                  <View style={styles.dpadMiddleRow}>
                    <Pressable style={styles.dpadButton} onPress={() => handleMove('left')}>
                      <Text style={styles.dpadText}>← LEFT</Text>
                    </Pressable>
                    <Pressable style={styles.dpadButton} onPress={() => handleMove('up')}>
                      <Text style={styles.dpadText}>⬆ UP</Text>
                    </Pressable>
                    <Pressable style={styles.dpadButton} onPress={() => handleMove('right')}>
                      <Text style={styles.dpadText}>→ RIGHT</Text>
                    </Pressable>
                  </View>
                  <View style={styles.dpadBottomRow}>
                    <Pressable style={styles.dpadButton} onPress={() => handleMove('back')}>
                      <Text style={styles.dpadText}>↓ BACK</Text>
                    </Pressable>
                    <Pressable style={styles.dpadButton} onPress={() => handleMove('down')}>
                      <Text style={styles.dpadText}>⬇ DOWN</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.rotateButtons}>
                  <Pressable style={styles.rotateButton} onPress={() => handleRotate('ccw')}>
                    <Text style={styles.dpadText}>↺ CCW</Text>
                  </Pressable>
                  <Pressable style={styles.rotateButton} onPress={() => handleRotate('cw')}>
                    <Text style={styles.dpadText}>↻ CW</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Flip Controls */}
            <View style={styles.flipControls}>
              <Text style={styles.controlsTitle}>Flip</Text>
              <View style={styles.flipButtons}>
                <Pressable style={styles.flipButton} onPress={() => handleFlip('l')}>
                  <Text style={styles.dpadText}>← LEFT</Text>
                </Pressable>
                <View style={styles.flipVertical}>
                  <Pressable style={styles.flipButton} onPress={() => handleFlip('f')}>
                    <Text style={styles.dpadText}>↑ FWD</Text>
                  </Pressable>
                  <Pressable style={styles.flipButton} onPress={() => handleFlip('b')}>
                    <Text style={styles.dpadText}>↓ BACK</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.flipButton} onPress={() => handleFlip('r')}>
                  <Text style={styles.dpadText}>→ RIGHT</Text>
                </Pressable>
              </View>
            </View>

            {/* Stop Button */}
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.stopButtonText}>STOP (Hover)</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  noVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  noVideoSubtext: {
    color: '#999',
    fontSize: 14,
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  telemetryItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  telemetryLabel: {
    color: '#999',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  telemetryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  statusFlying: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  missionPadInfo: {
    backgroundColor: 'rgba(139, 92, 246, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  missionPadTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  missionPadCoords: {
    flexDirection: 'row',
    gap: 12,
  },
  missionPadCoord: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  controls: {
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  takeoffButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  landButton: {
    flex: 1,
    backgroundColor: '#FF9500',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  emergencyButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  videoButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  movementControls: {
    gap: 12,
  },
  controlsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  dpad: {
    gap: 8,
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dpadBottomRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-around',
  },
  dpadButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dpadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  rotateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rotateButton: {
    flex: 1,
    backgroundColor: '#555',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  flightControls: {
    maxHeight: 500,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#555',
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  modeButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  joystickContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    gap: 16,
  },
  joystickWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  joystickLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  flipControls: {
    marginTop: 16,
  },
  flipButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  flipVertical: {
    gap: 8,
  },
  flipButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  stopButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
