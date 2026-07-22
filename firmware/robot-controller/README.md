# Robot controller firmware (ESP32)

Turns an ESP32 into a WiFi-controlled remote-control receiver for a physical
combat robot, paired with the "physical" battle mode in the Proof of Battle
mobile app.

## Flashing

1. Arduino IDE (or `arduino-cli`) → install board support: **esp32 by Espressif Systems**.
2. Install libraries: **WebSockets** (Links2004) and **ArduinoJson** (Benoit Blanchon).
3. Open `robot-controller.ino`, select your ESP32 board + port, upload.

## Before your first real match

Open `robot-controller.ino` and adjust the placeholders for **your** robot:

- `PIN_LEFT_IN1/IN2/PWM`, `PIN_RIGHT_IN1/IN2/PWM` — match your H-bridge driver's actual wiring.
- `PIN_WEAPON` — only relevant if your robot has a weapon/servo actuator; remove if not.
- The `left`/`right`/`spin` mappings in `applyMotorCommand()` — flip signs if a turn spins the wrong way once you test it.
- `AP_SSID` — give each robot a unique name if you're running more than one.

## Pairing with the app

1. Power on the robot. It starts a WiFi hotspot named `POB-ROBOT-01` (password `battle1234`).
2. On the phone: connect to that WiFi network (outside the app, in system WiFi settings).
3. In the app's battle screen (physical mode, as the commander), open the hardware control panel — it defaults to `192.168.4.1`, the standard ESP32 AP address, so pairing is just tapping "Connect".

## Safety

The firmware has a 500ms watchdog: if it stops receiving commands (app closed,
phone out of range, WiFi drops), it force-stops the motors. The app resends
the held action repeatedly while a button is pressed specifically to keep
this watchdog satisfied — don't remove that behavior from the app side
without keeping some other keep-alive in place.
