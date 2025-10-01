# Tello EDU iOS App - Expo SDK 54 Implementation Plan

## Project Overview
React Native revival of DJI Tello EDU drone control app using Expo SDK 54, focusing on iOS release with SDK 2.0/3.0 API support.

## Research Summary

### Tello EDU SDK
- **SDK 2.0**: Standard for Tello EDU
- **SDK 3.0**: Available with firmware v02.05.01.17+ (adds mission pads, swarm, EXT commands)
- **Communication**: UDP protocol over WiFi (192.168.10.1)
  - Port 8889: Commands (send) & responses (receive)
  - Port 8890: State telemetry stream
  - Port 11111: H.264 video stream (960x720 @ 25fps)

### Tech Stack for SDK 54
- **Expo SDK 54**: React Native 0.81, React 19.1
- **react-native-udp**: UDP sockets (works via Interop Layer, requires prebuild)
- **react-native-video**: H.264 playback via iOS AVPlayer (native support)
- **expo-router**: File-based navigation
- **expo-keep-awake**: Prevent screen sleep during flight

### iOS-Specific Considerations
- ✅ Native H.264 support via AVPlayer (easier than Android)
- ✅ TestFlight job type in SDK 54 for automated distribution
- ⚠️ No UDP background mode - app must stay foreground during flight
- ⚠️ WiFi disconnects when screen locks (use expo-keep-awake)
- ⚠️ RN 0.81.0 has TestFlight submission bug (use 0.81.1+)

### Background Tasks Reality
Expo has `expo-background-task` BUT:
- ❌ No real-time UDP support in background (iOS limitation)
- ❌ WiFi disconnects on screen lock
- ❌ System-controlled timing (not immediate)
- ✅ Use expo-keep-awake instead for active flight sessions
- ✅ Optional: Silent audio background mode trick

---

## Implementation Plan

### Phase 1: Expo SDK 54 iOS Project Setup
1. Create project: `npx create-expo-app@latest tellodew --template blank-typescript`
2. Upgrade to SDK 54 with RN 0.81.1+ (avoid 0.81.0 TestFlight bug)
3. Install dependencies:
   ```bash
   npx expo install react-native-udp react-native-video expo-router expo-keep-awake
   ```
4. Configure `app.json` for iOS bundle ID + permissions
5. Run `npx expo prebuild` to generate iOS project (CNG workflow)

### Phase 2: iOS Configuration & Permissions
1. Add to `app.json` config plugins:
   ```json
   {
     "ios": {
       "infoPlist": {
         "NSLocalNetworkUsageDescription": "This app needs local network access to communicate with your Tello drone via WiFi",
         "UIRequiresPersistentWiFi": true,
         "UIBackgroundModes": ["audio"]
       }
     }
   }
   ```
2. Implement keep-awake during active flight sessions
3. WiFi connection monitoring (detect Tello network)
4. Local network permission handling (triggers on first UDP send)

### Phase 3: Tello SDK Service Layer (TypeScript)
1. Create `TelloService` class supporting SDK 2.0/3.0 commands
2. UDP socket implementation (react-native-udp):
   - Port 8889: Command socket (takeoff, land, flip, move, etc.)
   - Port 8890: State telemetry (battery, temp, altitude, speed)
   - Port 11111: H.264 video stream receiver
3. Async command queue with timeout/retry logic
4. Connection state machine (disconnected/connecting/connected/flying)
5. TypeScript types for all commands and responses

**Key Commands:**
- Control: `takeoff`, `land`, `up`, `down`, `left`, `right`, `forward`, `back`, `cw`, `ccw`
- Video: `streamon`, `streamoff`
- SDK 3.0: `motoron`, `motoroff`, mission pad commands, EXT LED control

### Phase 4: Video Streaming (iOS Native H.264)
1. Configure `react-native-video` with AVPlayer backend
2. UDP video source: `udp://@0.0.0.0:11111`
3. Stream lifecycle management:
   - Send `streamon` command to start
   - Bind UDP socket to port 11111
   - Feed to video player component
   - Send `streamoff` on cleanup
4. Video overlay controls (pause, quality, fullscreen)
5. **Must test on physical iOS device** (simulator doesn't support H.264 UDP)

### Phase 5: UI/UX with Expo Router
1. App structure:
   - `app/index.tsx` - Home/connection screen
   - `app/connect.tsx` - WiFi setup guide
   - `app/fly.tsx` - Main flight control + video
   - `app/settings.tsx` - SDK 3.0 features config

2. Flight screen (`app/fly.tsx`) components:
   - Virtual joystick for RPYT control (Roll, Pitch, Yaw, Throttle)
   - Telemetry HUD overlay (battery %, altitude, speed, temperature)
   - Quick action buttons (takeoff, land, emergency stop)
   - Full-screen video feed with transparent controls
   - Keep-awake activation when entering flight mode

3. Connection flow:
   - Guide user to connect iPhone to Tello WiFi
   - Detect Tello network connection
   - Initialize UDP sockets
   - Send SDK mode command

### Phase 6: Advanced Tello EDU Features (SDK 3.0)
1. **Mission Pads**: Detection & waypoint navigation UI
2. **Swarm Mode**: Preparation interface (multi-drone support)
3. **EXT Commands**: LED matrix control panel
4. **Flight Recording**: Record command sequences for replay
5. **Mission Mode**: Pre-programmed autonomous flight paths

### Phase 7: Safety & Edge Cases
1. Auto-land on low battery (<10%)
2. Emergency stop button (immediate `emergency` command)
3. Connection loss handling (auto-land after 5s timeout)
4. WiFi disconnection detection (monitor network changes)
5. Screen lock prevention during flight (expo-keep-awake)
6. Command timeout & retry logic
7. Video stream error recovery

### Phase 8: iOS Build & TestFlight Distribution
1. Configure `eas.json`:
   ```json
   {
     "build": {
       "production": {
         "ios": {
           "buildConfiguration": "Release",
           "distribution": "store"
         }
       }
     }
   }
   ```
2. Add `expo-build-properties` to ensure RN 0.81.1+:
   ```json
   {
     "plugins": [
       [
         "expo-build-properties",
         {
           "ios": {
             "buildReactNativeFromSource": false
           }
         }
       ]
     ]
   }
   ```
3. First build: `eas build --platform ios --profile production`
4. TestFlight job setup for automated distribution
5. Scheduled workflows for nightly/weekly builds
6. App Store submission preparation

---

## Key Technical Decisions

### ✅ Why This Stack Works for iOS
1. **AVPlayer native H.264**: No complex decoding needed
2. **react-native-udp Interop**: Works via backward compatibility layer
3. **CNG workflow**: Easier upgrades, no manual native maintenance
4. **expo-keep-awake**: Simpler than background mode hacks
5. **TestFlight job**: Automated distribution built into SDK 54

### ⚠️ Known Limitations
1. App must stay in foreground during flight (iOS UDP restriction)
2. Screen must stay on (use keep-awake)
3. No internet while connected to Tello WiFi (normal behavior)
4. Physical device required for testing (simulator lacks H.264 UDP)
5. react-native-udp unmaintained but functional via Interop

### 🚀 iOS Advantages Over Android
- Native H.264 decoding (AVPlayer handles everything)
- Cleaner permissions model (single local network dialog)
- TestFlight distribution workflow integrated
- Better UDP socket stability in foreground

---

## Development Workflow

1. **Local Development**:
   ```bash
   npx expo prebuild
   npx expo run:ios
   ```

2. **Connect to Tello**:
   - Power on Tello drone
   - iPhone Settings → WiFi → Connect to "TELLO-XXXXXX"
   - Return to app → Initialize connection

3. **Testing**:
   - Must use physical iPhone (simulator won't work)
   - Test video stream separately from controls
   - Verify keep-awake prevents screen sleep
   - Test emergency stop and auto-land

4. **Build & Deploy**:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios
   ```

---

## Next Steps

1. Initialize Expo SDK 54 project
2. Set up basic UDP socket connection test
3. Implement video stream display
4. Build flight control UI
5. Add safety features
6. TestFlight beta release
7. Add SDK 3.0 advanced features
