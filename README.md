# Tello EDU - iOS Drone Control App

React Native app for controlling DJI Tello EDU drones with Expo SDK 54.

## Features

- ✈️ Full flight control (takeoff, land, movement, rotation)
- 📹 Real-time H.264 video streaming
- 📊 Live telemetry display (battery, altitude, temperature)
- 🛡️ Safety features (auto-land on low battery, connection loss detection)
- 🎮 Virtual joystick controls
- 🚨 Emergency stop
- 📡 Tello SDK 2.0 & 3.0 support

## Prerequisites

- macOS with Xcode installed
- Node.js 20.19.4+
- iOS device (simulator won't work for UDP/video streaming)
- DJI Tello EDU drone

## Installation

```bash
# Install dependencies
npm install

# Run prebuild to generate native iOS project
npx expo prebuild

# Run on iOS device
npx expo run:ios
```

## Usage

1. Power on your Tello EDU drone
2. Connect your iPhone to the Tello WiFi network (TELLO-XXXXXX)
3. Open the app
4. Tap "Connect to Drone"
5. Once connected, navigate to flight control
6. Enable video stream to see live feed
7. Use controls to fly

## Development

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Build for production
eas build --platform ios --profile production
```

## EAS Build Configuration

The app is configured for EAS Build with profiles for:
- Development builds (internal testing)
- Preview builds (TestFlight beta)
- Production builds (App Store)

To build and submit to TestFlight:

```bash
eas build --platform ios --profile production --auto-submit
```

## Project Structure

```
tellodew/
├── app/               # Expo Router screens
│   ├── _layout.tsx    # Root layout
│   ├── index.tsx      # Home screen
│   ├── connect.tsx    # Connection screen
│   └── fly.tsx        # Flight control screen
├── services/          # Business logic
│   └── TelloService.ts # Tello SDK implementation
├── types/             # TypeScript types
│   └── tello.ts       # Tello-specific types
└── app.json           # Expo configuration
```

## Safety Features

- Auto-land when battery drops below 10%
- Auto-land on connection loss (5s timeout)
- Keep-awake to prevent screen sleep during flight
- Emergency stop button
- Connection state monitoring

## Technical Details

- **Expo SDK**: 54.0.10
- **React Native**: 0.81.4
- **Navigation**: Expo Router 6.0
- **Video**: react-native-video 6.16 with AVPlayer
- **Networking**: react-native-udp 4.1.7
- **Architecture**: New Architecture enabled

## Tello Communication

- **IP**: 192.168.10.1
- **Command Port**: 8889 (UDP)
- **State Port**: 8890 (UDP)
- **Video Port**: 11111 (UDP H.264 stream)

## License

MIT
