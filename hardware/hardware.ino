/*
 * GENIUS PLAY - HARDWARE CODE
 * Released under MIT licence
 * Maintained by caffwydev
 */

const int BUTTON1_PIN = 7;
const int BUTTON2_PIN = 8;
const int BUTTON_MISC_PIN = 2;

bool button1State = false;
bool button2State = false;
bool buttonMiscState = false;

bool button1PrevState = false;
bool button2PrevState = false;
bool buttonMiscPrevState = false;

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON1_PIN, INPUT_PULLUP);
  pinMode(BUTTON2_PIN, INPUT_PULLUP);
  pinMode(BUTTON_MISC_PIN, INPUT_PULLUP);
}

void loop() {
  checkButtons();
  handleSerialCommands();
}

void checkButtons() {
  button1State = digitalRead(BUTTON1_PIN) == LOW;
  button2State = digitalRead(BUTTON2_PIN) == LOW;
  buttonMiscState = digitalRead(BUTTON_MISC_PIN) == LOW;

  if (button1State && !button1PrevState) sendButtonPress(1);
  if (button2State && !button2PrevState) sendButtonPress(2);
  if (buttonMiscState && !buttonMiscPrevState) sendButtonPress(3);

  button1PrevState = button1State;
  button2PrevState = button2State;
  buttonMiscPrevState = buttonMiscState;
}

void sendButtonPress(int buttonID) {
  Serial.println(String(buttonID));
}

void handleSerialCommands() {
  if (!Serial.available()) return;

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command == "Ping!") {
    Serial.println("Pong!");
    return;
  }

  if (command.startsWith("PINON(")) {
    int pin = extractPinNumber(command);
    if (pin >= 0) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, HIGH);
      Serial.println("OK");
    }
    return;
  }

  if (command.startsWith("PINOFF(")) {
    int pin = extractPinNumber(command);
    if (pin >= 0) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, LOW);
      Serial.println("OK");
    }
    return;
  }

  Serial.println("ERR");
}

int extractPinNumber(const String& cmd) {
  int start = cmd.indexOf('(');
  int end = cmd.indexOf(')');

  if (start == -1 || end == -1 || end <= start + 1) return -1;

  String numStr = cmd.substring(start + 1, end);
  numStr.trim();

  return numStr.toInt();
}