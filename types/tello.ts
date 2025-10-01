// Tello SDK Types

export interface TelloState {
  pitch: number;
  roll: number;
  yaw: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  tempLow: number;
  tempHigh: number;
  tof: number; // Time of flight distance (cm)
  height: number; // Height (cm)
  battery: number; // Battery percentage
  barometer: number;
  time: number; // Motor time
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  // Mission Pad fields (SDK 3.0)
  missionPadId?: number; // Mission pad ID (1-8), -1 if not detected
  missionPadX?: number; // X position relative to mission pad (cm)
  missionPadY?: number; // Y position relative to mission pad (cm)
  missionPadZ?: number; // Z position relative to mission pad (cm)
}

export interface TelloResponse {
  success: boolean;
  message: string;
  data?: any;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FLYING = 'flying',
  ERROR = 'error',
}

export interface TelloCommand {
  command: string;
  timeout?: number;
  expectResponse?: boolean;
}

// SDK 2.0 & 3.0 Commands
export type TelloCommandType =
  // Control Commands
  | 'command' // Enter SDK mode
  | 'takeoff'
  | 'land'
  | 'streamon'
  | 'streamoff'
  | 'emergency'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'forward'
  | 'back'
  | 'cw' // Rotate clockwise
  | 'ccw' // Rotate counter-clockwise
  | 'flip'
  | 'go' // Fly to x y z at speed
  | 'curve' // Fly curve
  | 'speed' // Set speed
  // Read Commands
  | 'speed?'
  | 'battery?'
  | 'time?'
  | 'height?'
  | 'temp?'
  | 'attitude?'
  | 'baro?'
  | 'tof?'
  // SDK 3.0 Commands
  | 'motoron'
  | 'motoroff'
  | 'mdirection' // Mission pad detection direction
  | 'mon' // Mission pad detection on
  | 'moff' // Mission pad detection off
  | 'EXT'; // Extended commands for LED control

export interface TelloConfig {
  ip: string;
  commandPort: number;
  statePort: number;
  videoPort: number;
  responseTimeout: number;
}

export const DEFAULT_TELLO_CONFIG: TelloConfig = {
  ip: '192.168.10.1',
  commandPort: 8889,
  statePort: 8890,
  videoPort: 11111,
  responseTimeout: 7000,
};
