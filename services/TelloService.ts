import dgram from 'react-native-udp';
import type { Socket } from 'react-native-udp';
import {
  TelloConfig,
  TelloState,
  TelloResponse,
  ConnectionState,
  TelloCommand,
  DEFAULT_TELLO_CONFIG,
} from '../types/tello';

export class TelloService {
  private config: TelloConfig;
  private commandSocket: Socket | null = null;
  private stateSocket: Socket | null = null;
  private videoSocket: Socket | null = null;

  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private currentState: Partial<TelloState> = {};
  private commandQueue: Array<{
    command: TelloCommand;
    resolve: (value: TelloResponse) => void;
    reject: (reason: any) => void;
  }> = [];
  private isProcessingQueue = false;

  // Safety features
  private lowBatteryThreshold = 10;
  private autoLandOnLowBattery = true;
  private connectionCheckInterval?: NodeJS.Timeout;
  private lastStateUpdate?: number;

  // Event listeners
  private onStateUpdateCallback?: (state: Partial<TelloState>) => void;
  private onConnectionStateCallback?: (state: ConnectionState) => void;
  private onLowBatteryCallback?: (battery: number) => void;

  constructor(config?: Partial<TelloConfig>) {
    this.config = { ...DEFAULT_TELLO_CONFIG, ...config };
  }

  /**
   * Initialize connection to Tello drone
   */
  async connect(): Promise<TelloResponse> {
    try {
      this.setConnectionState(ConnectionState.CONNECTING);

      // Create command socket
      this.commandSocket = dgram.createSocket({
        type: 'udp4',
        reusePort: true,
      });

      // Create state telemetry socket
      this.stateSocket = dgram.createSocket({
        type: 'udp4',
        reusePort: true,
      });

      // Bind sockets
      await this.bindSocket(this.commandSocket, this.config.commandPort);
      await this.bindSocket(this.stateSocket, this.config.statePort);

      // Set up listeners
      this.setupStateListener();
      this.setupCommandListener();

      // Enter SDK mode
      const response = await this.sendCommand({ command: 'command' });

      if (response.success) {
        this.setConnectionState(ConnectionState.CONNECTED);
        this.startConnectionMonitoring();
      } else {
        this.setConnectionState(ConnectionState.ERROR);
      }

      return response;
    } catch (error) {
      this.setConnectionState(ConnectionState.ERROR);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Disconnect from Tello drone
   */
  disconnect(): void {
    this.stopConnectionMonitoring();

    if (this.commandSocket) {
      this.commandSocket.close();
      this.commandSocket = null;
    }

    if (this.stateSocket) {
      this.stateSocket.close();
      this.stateSocket = null;
    }

    if (this.videoSocket) {
      this.videoSocket.close();
      this.videoSocket = null;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send command to Tello
   */
  async sendCommand(cmd: TelloCommand): Promise<TelloResponse> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command: cmd, resolve, reject });
      this.processCommandQueue();
    });
  }

  /**
   * Process command queue sequentially
   */
  private async processCommandQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift();
      if (!item) continue;

      const { command, resolve, reject } = item;

      try {
        const response = await this.executeCommand(command);
        resolve(response);
      } catch (error) {
        reject(error);
      }

      // Small delay between commands
      await new Promise((r) => setTimeout(r, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single command
   */
  private executeCommand(cmd: TelloCommand): Promise<TelloResponse> {
    return new Promise((resolve, reject) => {
      if (!this.commandSocket) {
        reject(new Error('Not connected'));
        return;
      }

      const timeout = cmd.timeout || this.config.responseTimeout;
      const message = Buffer.from(cmd.command);
      let timeoutId: NodeJS.Timeout;
      let responseHandler: (msg: Buffer) => void;

      // Set up response handler
      responseHandler = (msg: Buffer) => {
        clearTimeout(timeoutId);
        this.commandSocket?.removeListener('message', responseHandler);

        const response = msg.toString().trim();
        resolve({
          success: response === 'ok',
          message: response,
        });
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        this.commandSocket?.removeListener('message', responseHandler);
        resolve({
          success: false,
          message: 'Command timeout',
        });
      }, timeout);

      // Send command
      this.commandSocket.send(
        message,
        0,
        message.length,
        this.config.commandPort,
        this.config.ip,
        (err) => {
          if (err) {
            clearTimeout(timeoutId);
            this.commandSocket?.removeListener('message', responseHandler);
            reject(err);
          }
        }
      );

      // Listen for response if expected
      if (cmd.expectResponse !== false) {
        this.commandSocket.on('message', responseHandler);
      } else {
        clearTimeout(timeoutId);
        resolve({ success: true, message: 'Command sent' });
      }
    });
  }

  /**
   * Bind socket to port
   */
  private bindSocket(socket: Socket, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.bind(port, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Set up state telemetry listener
   */
  private setupStateListener(): void {
    if (!this.stateSocket) return;

    this.stateSocket.on('message', (msg: Buffer) => {
      const stateString = msg.toString();
      const state = this.parseStateString(stateString);

      this.currentState = state;
      this.lastStateUpdate = Date.now();

      // Check battery level
      if (state.battery !== undefined) {
        this.checkBatteryLevel(state.battery);
      }

      if (this.onStateUpdateCallback) {
        this.onStateUpdateCallback(state);
      }
    });
  }

  /**
   * Set up command socket listener
   */
  private setupCommandListener(): void {
    if (!this.commandSocket) return;

    this.commandSocket.on('error', (err) => {
      console.error('Command socket error:', err);
      this.setConnectionState(ConnectionState.ERROR);
    });
  }

  /**
   * Parse state string from Tello
   * Format: "pitch:%d;roll:%d;yaw:%d;..."
   */
  private parseStateString(stateString: string): Partial<TelloState> {
    const state: Partial<TelloState> = {};
    const pairs = stateString.split(';');

    for (const pair of pairs) {
      const [key, value] = pair.split(':');
      if (!key || !value) continue;

      const numValue = parseFloat(value);

      switch (key) {
        case 'pitch':
          state.pitch = numValue;
          break;
        case 'roll':
          state.roll = numValue;
          break;
        case 'yaw':
          state.yaw = numValue;
          break;
        case 'vgx':
          state.speedX = numValue;
          break;
        case 'vgy':
          state.speedY = numValue;
          break;
        case 'vgz':
          state.speedZ = numValue;
          break;
        case 'templ':
          state.tempLow = numValue;
          break;
        case 'temph':
          state.tempHigh = numValue;
          break;
        case 'tof':
          state.tof = numValue;
          break;
        case 'h':
          state.height = numValue;
          break;
        case 'bat':
          state.battery = numValue;
          break;
        case 'baro':
          state.barometer = numValue;
          break;
        case 'time':
          state.time = numValue;
          break;
        case 'agx':
        case 'agy':
        case 'agz':
          if (!state.acceleration) {
            state.acceleration = { x: 0, y: 0, z: 0 };
          }
          if (key === 'agx') state.acceleration.x = numValue;
          if (key === 'agy') state.acceleration.y = numValue;
          if (key === 'agz') state.acceleration.z = numValue;
          break;
        case 'mid':
          state.missionPadId = numValue;
          break;
        case 'x':
          state.missionPadX = numValue;
          break;
        case 'y':
          state.missionPadY = numValue;
          break;
        case 'z':
          state.missionPadZ = numValue;
          break;
      }
    }

    return state;
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback(state);
    }
  }

  // Public API methods

  /**
   * Takeoff
   */
  async takeoff(): Promise<TelloResponse> {
    const response = await this.sendCommand({ command: 'takeoff', timeout: 20000 });
    if (response.success) {
      this.setConnectionState(ConnectionState.FLYING);
    }
    return response;
  }

  /**
   * Land
   */
  async land(): Promise<TelloResponse> {
    const response = await this.sendCommand({ command: 'land', timeout: 20000 });
    if (response.success) {
      this.setConnectionState(ConnectionState.CONNECTED);
    }
    return response;
  }

  /**
   * Emergency stop
   */
  async emergency(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'emergency', expectResponse: false });
  }

  /**
   * Start video stream
   */
  async streamOn(): Promise<TelloResponse> {
    try {
      // Create and bind video socket if not already created
      if (!this.videoSocket) {
        this.videoSocket = dgram.createSocket({
          type: 'udp4',
          reusePort: true,
        });

        await this.bindSocket(this.videoSocket, this.config.videoPort);

        // Set up video socket error handling
        this.videoSocket.on('error', (err) => {
          console.error('Video socket error:', err);
        });

        this.videoSocket.on('message', (msg: Buffer) => {
          // Video data is received here
          // react-native-video will handle the UDP stream directly
          // This listener is mainly for debugging/logging
          console.log(`Received video packet: ${msg.length} bytes`);
        });
      }

      // Send streamon command to drone
      return this.sendCommand({ command: 'streamon' });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start video stream',
      };
    }
  }

  /**
   * Stop video stream
   */
  async streamOff(): Promise<TelloResponse> {
    const response = await this.sendCommand({ command: 'streamoff' });

    // Close video socket
    if (this.videoSocket) {
      this.videoSocket.close();
      this.videoSocket = null;
    }

    return response;
  }

  /**
   * Move in direction
   */
  async move(direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'back', distance: number): Promise<TelloResponse> {
    if (distance < 20 || distance > 500) {
      return { success: false, message: 'Distance must be 20-500cm' };
    }
    return this.sendCommand({ command: `${direction} ${distance}` });
  }

  /**
   * Rotate
   */
  async rotate(direction: 'cw' | 'ccw', degrees: number): Promise<TelloResponse> {
    if (degrees < 1 || degrees > 360) {
      return { success: false, message: 'Degrees must be 1-360' };
    }
    return this.sendCommand({ command: `${direction} ${degrees}` });
  }

  /**
   * Flip
   */
  async flip(direction: 'l' | 'r' | 'f' | 'b'): Promise<TelloResponse> {
    return this.sendCommand({ command: `flip ${direction}` });
  }

  /**
   * Set speed (cm/s)
   */
  async setSpeed(speed: number): Promise<TelloResponse> {
    if (speed < 10 || speed > 100) {
      return { success: false, message: 'Speed must be 10-100 cm/s' };
    }
    return this.sendCommand({ command: `speed ${speed}` });
  }

  /**
   * Send RC control with velocities for smooth joystick control
   * @param leftRight - Left/Right velocity (-100 to 100)
   * @param forwardBackward - Forward/Backward velocity (-100 to 100)
   * @param upDown - Up/Down velocity (-100 to 100)
   * @param yaw - Yaw velocity (-100 to 100, negative=CCW, positive=CW)
   */
  sendRCControl(
    leftRight: number,
    forwardBackward: number,
    upDown: number,
    yaw: number
  ): void {
    // Clamp values to -100 to 100
    const clamp = (val: number) => Math.max(-100, Math.min(100, Math.round(val)));

    const a = clamp(leftRight);
    const b = clamp(forwardBackward);
    const c = clamp(upDown);
    const d = clamp(yaw);

    // Send RC command without waiting for response (fire and forget for smooth control)
    const command = `rc ${a} ${b} ${c} ${d}`;

    if (!this.commandSocket) {
      console.warn('Cannot send RC control: not connected');
      return;
    }

    const message = Buffer.from(command);
    this.commandSocket.send(
      message,
      0,
      message.length,
      this.config.commandPort,
      this.config.ip,
      (err) => {
        if (err) {
          console.error('RC control send error:', err);
        }
      }
    );
  }

  /**
   * Stop all movement and hover in place
   */
  async stop(): Promise<TelloResponse> {
    // Send zero velocities to stop
    this.sendRCControl(0, 0, 0, 0);
    return { success: true, message: 'Stopped' };
  }

  // ====== SDK 3.0 Mission Pad Commands ======

  /**
   * Enable mission pad detection
   */
  async enableMissionPads(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'mon' });
  }

  /**
   * Disable mission pad detection
   */
  async disableMissionPads(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'moff' });
  }

  /**
   * Set mission pad detection direction
   * @param direction 0=downward, 1=forward, 2=both
   */
  async setMissionPadDetectionDirection(direction: 0 | 1 | 2): Promise<TelloResponse> {
    return this.sendCommand({ command: `mdirection ${direction}` });
  }

  /**
   * Fly to x y z position relative to mission pad at speed
   * @param x -500 to 500 cm
   * @param y -500 to 500 cm
   * @param z -500 to 500 cm
   * @param speed 10-100 cm/s
   * @param mid Mission pad ID (1-8)
   */
  async goXYZSpeedMid(x: number, y: number, z: number, speed: number, mid: number): Promise<TelloResponse> {
    if (x < -500 || x > 500 || y < -500 || y > 500 || z < -500 || z > 500) {
      return { success: false, message: 'Coordinates must be -500 to 500 cm' };
    }
    if (speed < 10 || speed > 100) {
      return { success: false, message: 'Speed must be 10-100 cm/s' };
    }
    if (mid < 1 || mid > 8) {
      return { success: false, message: 'Mission pad ID must be 1-8' };
    }
    return this.sendCommand({ command: `go ${x} ${y} ${z} ${speed} m${mid}` });
  }

  /**
   * Fly a curve relative to mission pad
   * @param x1, y1, z1 First coordinate (-500 to 500 cm)
   * @param x2, y2, z2 Second coordinate (-500 to 500 cm)
   * @param speed 10-60 cm/s
   * @param mid Mission pad ID (1-8)
   */
  async curveXYZSpeedMid(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    speed: number,
    mid: number
  ): Promise<TelloResponse> {
    if (x1 < -500 || x1 > 500 || y1 < -500 || y1 > 500 || z1 < -500 || z1 > 500 ||
        x2 < -500 || x2 > 500 || y2 < -500 || y2 > 500 || z2 < -500 || z2 > 500) {
      return { success: false, message: 'Coordinates must be -500 to 500 cm' };
    }
    if (speed < 10 || speed > 60) {
      return { success: false, message: 'Speed must be 10-60 cm/s for curves' };
    }
    if (mid < 1 || mid > 8) {
      return { success: false, message: 'Mission pad ID must be 1-8' };
    }
    return this.sendCommand({ command: `curve ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${speed} m${mid}` });
  }

  /**
   * Jump between mission pads
   * @param x, y, z Position relative to mid2 (-500 to 500 cm)
   * @param speed 10-100 cm/s
   * @param yaw Target yaw angle
   * @param mid1 Starting mission pad ID
   * @param mid2 Target mission pad ID
   */
  async jump(x: number, y: number, z: number, speed: number, yaw: number, mid1: number, mid2: number): Promise<TelloResponse> {
    if (x < -500 || x > 500 || y < -500 || y > 500 || z < -500 || z > 500) {
      return { success: false, message: 'Coordinates must be -500 to 500 cm' };
    }
    if (speed < 10 || speed > 100) {
      return { success: false, message: 'Speed must be 10-100 cm/s' };
    }
    if (mid1 < 1 || mid1 > 8 || mid2 < 1 || mid2 > 8) {
      return { success: false, message: 'Mission pad IDs must be 1-8' };
    }
    return this.sendCommand({ command: `jump ${x} ${y} ${z} ${speed} ${yaw} m${mid1} m${mid2}` });
  }

  // ====== Advanced Movement Commands ======

  /**
   * Fly to x y z position at speed (no mission pad)
   * @param x -500 to 500 cm
   * @param y -500 to 500 cm
   * @param z -500 to 500 cm
   * @param speed 10-100 cm/s
   */
  async goXYZSpeed(x: number, y: number, z: number, speed: number): Promise<TelloResponse> {
    if (x < -500 || x > 500 || y < -500 || y > 500 || z < -500 || z > 500) {
      return { success: false, message: 'Coordinates must be -500 to 500 cm' };
    }
    if (speed < 10 || speed > 100) {
      return { success: false, message: 'Speed must be 10-100 cm/s' };
    }
    return this.sendCommand({ command: `go ${x} ${y} ${z} ${speed}` });
  }

  /**
   * Fly a curve (no mission pad)
   * @param x1, y1, z1 First coordinate (-500 to 500 cm)
   * @param x2, y2, z2 Second coordinate (-500 to 500 cm)
   * @param speed 10-60 cm/s
   */
  async curveXYZSpeed(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    speed: number
  ): Promise<TelloResponse> {
    if (x1 < -500 || x1 > 500 || y1 < -500 || y1 > 500 || z1 < -500 || z1 > 500 ||
        x2 < -500 || x2 > 500 || y2 < -500 || y2 > 500 || z2 < -500 || z2 > 500) {
      return { success: false, message: 'Coordinates must be -500 to 500 cm' };
    }
    if (speed < 10 || speed > 60) {
      return { success: false, message: 'Speed must be 10-60 cm/s for curves' };
    }
    return this.sendCommand({ command: `curve ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${speed}` });
  }

  // ====== Video Configuration Commands ======

  /**
   * Set video bitrate
   * @param bitrate 0=auto, 1-5 = 1-5 Mbps
   */
  async setVideoBitrate(bitrate: 0 | 1 | 2 | 3 | 4 | 5): Promise<TelloResponse> {
    return this.sendCommand({ command: `setbitrate ${bitrate}` });
  }

  /**
   * Set video resolution
   * @param resolution 'high'=720p, 'low'=480p
   */
  async setVideoResolution(resolution: 'high' | 'low'): Promise<TelloResponse> {
    return this.sendCommand({ command: `setresolution ${resolution}` });
  }

  /**
   * Set video FPS
   * @param fps 'high'=30fps, 'middle'=15fps, 'low'=5fps
   */
  async setVideoFPS(fps: 'high' | 'middle' | 'low'): Promise<TelloResponse> {
    return this.sendCommand({ command: `setfps ${fps}` });
  }

  /**
   * Set video camera direction
   * @param direction 0=forward, 1=downward, 2=both (if available)
   */
  async setVideoCameraDirection(direction: 0 | 1 | 2): Promise<TelloResponse> {
    return this.sendCommand({ command: `downvision ${direction}` });
  }

  // ====== Motor Control Commands ======

  /**
   * Turn motors on (without takeoff)
   */
  async turnMotorOn(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'motoron' });
  }

  /**
   * Turn motors off
   */
  async turnMotorOff(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'motoroff' });
  }

  // ====== Query Commands ======

  /**
   * Query SDK version
   */
  async querySdkVersion(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'sdk?' });
  }

  /**
   * Query serial number
   */
  async querySerialNumber(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'sn?' });
  }

  /**
   * Query WiFi signal-to-noise ratio
   */
  async queryWifiSNR(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'wifi?' });
  }

  /**
   * Query current speed setting
   */
  async querySpeed(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'speed?' });
  }

  /**
   * Query battery percentage
   */
  async queryBattery(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'battery?' });
  }

  /**
   * Query flight time
   */
  async queryTime(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'time?' });
  }

  /**
   * Query current height
   */
  async queryHeight(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'height?' });
  }

  /**
   * Query temperature range
   */
  async queryTemp(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'temp?' });
  }

  /**
   * Query attitude (pitch, roll, yaw)
   */
  async queryAttitude(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'attitude?' });
  }

  /**
   * Query barometer reading
   */
  async queryBarometer(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'baro?' });
  }

  /**
   * Query time-of-flight distance
   */
  async queryTOF(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'tof?' });
  }

  // ====== WiFi Configuration Commands ======

  /**
   * Set WiFi credentials for drone AP mode
   * @param ssid Network SSID
   * @param password Network password
   */
  async setWifiCredentials(ssid: string, password: string): Promise<TelloResponse> {
    return this.sendCommand({ command: `wifi ${ssid} ${password}` });
  }

  /**
   * Connect to WiFi network in station mode
   * @param ssid Network SSID
   * @param password Network password
   */
  async connectToWifi(ssid: string, password: string): Promise<TelloResponse> {
    return this.sendCommand({ command: `ap ${ssid} ${password}` });
  }

  // ====== Special Commands ======

  /**
   * Reboot the drone
   */
  async reboot(): Promise<TelloResponse> {
    return this.sendCommand({ command: 'reboot', expectResponse: false });
  }

  /**
   * Throw and go takeoff mode
   */
  async throwTakeoff(): Promise<TelloResponse> {
    const response = await this.sendCommand({ command: 'throwfly', timeout: 15000 });
    if (response.success) {
      this.setConnectionState(ConnectionState.FLYING);
    }
    return response;
  }

  /**
   * Send expansion command (for LED matrix, etc.)
   * @param cmd Expansion command string
   */
  async sendExpansionCommand(cmd: string): Promise<TelloResponse> {
    return this.sendCommand({ command: `EXT ${cmd}` });
  }

  // Getters
  getState(): Partial<TelloState> {
    return this.currentState;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Event listeners
  onStateUpdate(callback: (state: Partial<TelloState>) => void): void {
    this.onStateUpdateCallback = callback;
  }

  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateCallback = callback;
  }

  onLowBattery(callback: (battery: number) => void): void {
    this.onLowBatteryCallback = callback;
  }

  // Safety features

  /**
   * Start monitoring connection and battery
   */
  private startConnectionMonitoring(): void {
    this.stopConnectionMonitoring();

    this.connectionCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpdate = this.lastStateUpdate
        ? now - this.lastStateUpdate
        : Infinity;

      // Check for connection loss (no state updates in 5 seconds)
      if (timeSinceLastUpdate > 5000) {
        console.warn('Connection loss detected - no state updates');
        if (this.connectionState === ConnectionState.FLYING) {
          // Auto-land on connection loss
          this.land().catch(console.error);
        }
        this.setConnectionState(ConnectionState.ERROR);
      }
    }, 1000);
  }

  /**
   * Stop connection monitoring
   */
  private stopConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }
  }

  /**
   * Check battery level and trigger low battery actions
   */
  private checkBatteryLevel(battery: number): void {
    if (battery <= this.lowBatteryThreshold) {
      console.warn(`Low battery: ${battery}%`);

      if (this.onLowBatteryCallback) {
        this.onLowBatteryCallback(battery);
      }

      // Auto-land if flying and battery is critically low
      if (
        this.autoLandOnLowBattery &&
        this.connectionState === ConnectionState.FLYING
      ) {
        console.warn('Auto-landing due to low battery');
        this.land().catch(console.error);
      }
    }
  }

  /**
   * Set low battery threshold (default 10%)
   */
  setLowBatteryThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 100) {
      this.lowBatteryThreshold = threshold;
    }
  }

  /**
   * Enable/disable auto-land on low battery
   */
  setAutoLandOnLowBattery(enabled: boolean): void {
    this.autoLandOnLowBattery = enabled;
  }
}
