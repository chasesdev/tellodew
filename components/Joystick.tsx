import { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';

interface JoystickProps {
  size?: number;
  onMove: (x: number, y: number) => void; // Values from -100 to 100
  onRelease?: () => void;
}

export function Joystick({ size = 150, onMove, onRelease }: JoystickProps) {
  const [active, setActive] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const maxDistance = size / 2 - 20; // Maximum distance from center

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        setActive(true);
      },

      onPanResponderMove: (_, gesture) => {
        // Calculate distance from center
        const distance = Math.sqrt(
          gesture.dx * gesture.dx + gesture.dy * gesture.dy
        );

        // Limit to max distance (circular boundary)
        let x = gesture.dx;
        let y = gesture.dy;

        if (distance > maxDistance) {
          const angle = Math.atan2(gesture.dy, gesture.dx);
          x = Math.cos(angle) * maxDistance;
          y = Math.sin(angle) * maxDistance;
        }

        // Update visual position
        pan.setValue({ x, y });

        // Convert to -100 to 100 range
        const normalizedX = (x / maxDistance) * 100;
        const normalizedY = -(y / maxDistance) * 100; // Invert Y (up = positive)

        onMove(normalizedX, normalizedY);
      },

      onPanResponderRelease: () => {
        setActive(false);

        // Animate back to center
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();

        // Reset to zero
        onMove(0, 0);
        onRelease?.();
      },
    })
  ).current;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer circle (base) */}
      <View style={[styles.base, active && styles.baseActive]} />

      {/* Crosshair guides */}
      <View style={styles.crosshair}>
        <View style={styles.crosshairLine} />
        <View style={[styles.crosshairLine, styles.crosshairLineVertical]} />
      </View>

      {/* Inner circle (stick) */}
      <Animated.View
        style={[
          styles.stick,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
          active && styles.stickActive,
        ]}
        {...panResponder.panHandlers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  base: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  baseActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  crosshair: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairLine: {
    position: 'absolute',
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  crosshairLineVertical: {
    width: 1,
    height: '60%',
  },
  stick: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  stickActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
    borderColor: 'rgba(0, 122, 255, 0.8)',
  },
});
