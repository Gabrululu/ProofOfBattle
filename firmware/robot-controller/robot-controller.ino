// Proof of Battle — physical robot remote-control firmware (ESP32).
//
// Runs its own WiFi access point and a WebSocket server on port 81. The
// mobile app (pob-mobile HardwareControlPanel / useRobotHardware.ts) connects
// directly to this AP and sends JSON commands:
//
//   {"action": "forward"|"back"|"left"|"right"|"spin"|"attack"|"defend"|"stop",
//    "intensity": 0-100}
//
// This is the SAME action vocabulary bridge/agents/battle_agent.py already
// uses for the simulated (Webots) robots, so the command "language" stays
// consistent between online and physical mode — only the transport differs.
//
// Libraries (install via Arduino Library Manager):
//   - WebSockets (Links2004 / arduinoWebSockets)
//   - ArduinoJson (Benoit Blanchon)
//
// !! Motor pin numbers and PWM ranges below are placeholders for a generic
// dual H-bridge (L298N-style) driver — adjust applyMotorCommand() to match
// your actual robot's wiring before relying on this for a real match.

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// ─── WiFi access point config ────────────────────────────────────────────────
const char* AP_SSID     = "POB-ROBOT-01";   // rename per-robot if running several
const char* AP_PASSWORD = "battle1234";     // 8+ chars required by WiFi AP mode
const IPAddress AP_IP(192, 168, 4, 1);      // default ESP32 AP gateway — matches
                                             // the mobile app's default pairing IP

// ─── Motor driver pins (placeholder — adjust to your H-bridge wiring) ───────
const int PIN_LEFT_IN1  = 16;
const int PIN_LEFT_IN2  = 17;
const int PIN_LEFT_PWM  = 18;   // ENA
const int PIN_RIGHT_IN1 = 19;
const int PIN_RIGHT_IN2 = 21;
const int PIN_RIGHT_PWM = 22;   // ENB
const int PIN_WEAPON    = 23;   // optional actuator/servo for "attack", if fitted

const int PWM_FREQ_HZ   = 5000;
const int PWM_RESOLUTION_BITS = 8; // 0-255 duty cycle

// ─── Safety watchdog ──────────────────────────────────────────────────────────
// If no command arrives within this window, force a stop. Prevents a runaway
// robot if the phone disconnects, backgrounds, or the app crashes mid-match.
// The mobile app resends the held action at ~8Hz specifically to keep this fed.
const unsigned long WATCHDOG_TIMEOUT_MS = 500;
unsigned long lastCommandMillis = 0;

WebSocketsServer webSocket(81);

// ─── Motor control ────────────────────────────────────────────────────────────

void setMotor(int in1Pin, int in2Pin, int pwmPin, int speedPercent) {
  // speedPercent: -100..100. Sign selects direction, magnitude sets PWM duty.
  bool forward = speedPercent >= 0;
  int duty = map(abs(constrain(speedPercent, -100, 100)), 0, 100, 0, 255);
  digitalWrite(in1Pin, forward ? HIGH : LOW);
  digitalWrite(in2Pin, forward ? LOW : HIGH);
  analogWrite(pwmPin, duty);
}

void stopMotors() {
  setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, 0);
  setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, 0);
  digitalWrite(PIN_WEAPON, LOW);
}

// Maps the shared {action, intensity} vocabulary onto left/right motor speeds.
// Adjust the specific mappings below to match how your robot is actually
// wired (e.g. which side spins which way for a clean pivot turn).
void applyMotorCommand(const String& action, int intensity) {
  int speed = constrain(intensity, 0, 100);

  if (action == "forward") {
    setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, speed);
    setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, speed);
  } else if (action == "back") {
    setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, -speed);
    setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, -speed);
  } else if (action == "left") {
    setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, -speed / 2);
    setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, speed);
  } else if (action == "right") {
    setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, speed);
    setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, -speed / 2);
  } else if (action == "spin") {
    setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, speed);
    setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, -speed);
  } else if (action == "attack") {
    setMotor(PIN_LEFT_IN1, PIN_LEFT_IN2, PIN_LEFT_PWM, 100);
    setMotor(PIN_RIGHT_IN1, PIN_RIGHT_IN2, PIN_RIGHT_PWM, 100);
    digitalWrite(PIN_WEAPON, HIGH);
  } else if (action == "defend" || action == "stop" || action == "idle") {
    stopMotors();
  } else {
    stopMotors(); // unrecognized action — fail safe
  }
}

// ─── WebSocket event handling ─────────────────────────────────────────────────

void handleCommand(const uint8_t* payload, size_t length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("JSON parse error: %s\n", err.c_str());
    return;
  }

  const char* action = doc["action"] | "stop";
  int intensity = doc["intensity"] | 0;

  lastCommandMillis = millis();
  applyMotorCommand(String(action), intensity);
}

void onWebSocketEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.printf("Client %u connected\n", client);
      lastCommandMillis = millis(); // don't immediately trip the watchdog on connect
      break;
    case WStype_DISCONNECTED:
      Serial.printf("Client %u disconnected\n", client);
      stopMotors();
      break;
    case WStype_TEXT:
      handleCommand(payload, length);
      break;
    default:
      break;
  }
}

// ─── Setup / loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  pinMode(PIN_LEFT_IN1, OUTPUT);
  pinMode(PIN_LEFT_IN2, OUTPUT);
  pinMode(PIN_RIGHT_IN1, OUTPUT);
  pinMode(PIN_RIGHT_IN2, OUTPUT);
  pinMode(PIN_WEAPON, OUTPUT);

  analogWriteResolution(PIN_LEFT_PWM, PWM_RESOLUTION_BITS);
  analogWriteResolution(PIN_RIGHT_PWM, PWM_RESOLUTION_BITS);
  analogWriteFrequency(PIN_LEFT_PWM, PWM_FREQ_HZ);
  analogWriteFrequency(PIN_RIGHT_PWM, PWM_FREQ_HZ);

  stopMotors();

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.printf("AP started: %s — connect the phone to this network, then\n", AP_SSID);
  Serial.printf("open the control panel (default target ws://%s:81)\n", AP_IP.toString().c_str());

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
}

void loop() {
  webSocket.loop();

  // Safety watchdog: no command recently -> force stop.
  if (millis() - lastCommandMillis > WATCHDOG_TIMEOUT_MS) {
    stopMotors();
  }
}
