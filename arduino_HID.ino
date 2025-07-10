#include <ArduinoJson.h>
#include <Keyboard.h>
// #include <Mouse.h>
#include <MouseTo.h>

// Message types for communication
#define MSG_ACK "ack"
#define MSG_ERROR "error"
#define MSG_STATUS "status"
#define MSG_RESULT "result"

#define CMD_MOUSE_MOVE "mouse_move"
#define CMD_MOUSE_CLICK "mouse_click"
#define CMD_MOUSE_SCROLL "mouse_scroll"
#define CMD_TYPING "typing"
#define CMD_ENTER "enter"
#define CMD_COPY "copy"
#define CMD_SELECT_ALL "select_all"
#define CMD_DELETE "delete"
#define CMD_BACKSPACE "backspace"
#define CMD_TAB "tab"
#define CMD_ESCAPE "escape"
#define CMD_SPACE "space"
#define CMD_ARROW_UP "arrow_up"
#define CMD_ARROW_DOWN "arrow_down"
#define CMD_ARROW_LEFT "arrow_left"
#define CMD_ARROW_RIGHT "arrow_right"
#define CMD_PAGE_UP "page_up"
#define CMD_PAGE_DOWN "page_down"

#define MOUSE_MOVE_STEP 50

void setup() {
    Serial.begin(9600);  // UART communication
    Keyboard.begin();     // Initialize keyboard emulation
    Mouse.begin();
    MouseTo.setScreenResolution(1280, 800);
    delay(2000);  // Wait for the PC to recognize HID
}

// Send message to server with proper format
void sendMessage(const char* type, bool success, const char* message, JsonDocument* data = nullptr) {
    StaticJsonDocument<200> doc;
    
    doc["type"] = type;
    doc["success"] = success;
    doc["message"] = message;
    
    if (data != nullptr) {
        doc["data"] = data->as<JsonObject>();
    }
    
    // Send to server
    serializeJson(doc, Serial);
    Serial.println();
}

void mouseMove(int targetX, int targetY) {
    //Move the mouse to the top left of the screen
    // for (int i = 0; i < 50; i++) {
    //     Mouse.move(-100, -100);
    //     delay(5);
    // }

    // int stepX = targetX / 100, stepY = targetY / 100;

    // for(int i = 0; i < 100; i ++) {
    //   Mouse.move(stepX, stepY);
    //   delay(10);
    // }

    // stepX = targetX % 100 / 10;
    // stepY = targetY % 100 / 10;
    // for(int i = 0; i < 10; i ++) {
    //   Mouse.move(stepX, stepY);
    //   delay(10);
    // }

    // Mouse.move(targetX % 10, targetY % 10);
    // delay(10);

    MouseTo.setTarget(targetX, targetY);
    while (MouseTo.move() == false) {}
    delay(1000);
    
    sendMessage(MSG_RESULT, true, "Mouse moved");
}

void mouseClick(bool isRight = false) {
    if (isRight) {
        Mouse.click(MOUSE_RIGHT);
    } else {
        Mouse.click(MOUSE_LEFT);
    }

    delay(100);
    sendMessage(MSG_RESULT, true, "Clicked");
}

void mouseScroll(int scrollAmount) {
    Mouse.move(0, 0, scrollAmount);
    delay(100);
    sendMessage(MSG_RESULT, true, "Scrolled");
}

void typeText(const char* text) {
    Keyboard.print(text);
    delay(100);
    sendMessage(MSG_RESULT, true, "Typed");
}

void copyText() {
    Keyboard.press(KEY_LEFT_CTRL);
    Keyboard.press('c');
    delay(50);
    Keyboard.releaseAll();
    sendMessage(MSG_RESULT, true, "Copied");
}

void selectAll() {
  Keyboard.press(KEY_LEFT_CTRL);
  Keyboard.press('a');
  delay(50);
  Keyboard.releaseAll();
  sendMessage(MSG_RESULT, true, "All selected");
}

void backspace() {
  Keyboard.press(KEY_BACKSPACE);
  delay(50);
  Keyboard.releaseAll();
  sendMessage(MSG_RESULT, true, "Backspace");
}

void tab() {
  Keyboard.press(KEY_TAB);
  delay(50);
  Keyboard.releaseAll();
  sendMessage(MSG_RESULT, true, "tab");
}

void enter() {
  Keyboard.press(KEY_RETURN);
  delay(50);
  Keyboard.releaseAll();
  sendMessage(MSG_RESULT, true, "Enter");
}

void loop() {
    if (Serial.available()) {
        StaticJsonDocument<200> doc;
        
        String jsonString = Serial.readStringUntil('\n');
        
        // First, acknowledge receipt
        sendMessage(MSG_ACK, true, "Message received");
        
        DeserializationError error = deserializeJson(doc, jsonString);
        
        if (error) {
            sendMessage(MSG_ERROR, false, "Failed to parse JSON");
            return;
        }
        
        const char* command = doc["command"];
        
        if (strcmp(command, "ping") == 0) {
            StaticJsonDocument<200> data;
            data["device"] = "Arduino HID";
            data["version"] = "1.0";
            
            sendMessage(MSG_RESULT, true, "Ping successful", &data);
        } else if (strcmp(command, "login") == 0) {
            const char* username = doc["credentials"]["username"];
            const char* password = doc["credentials"]["password"];
            
            if (!username || !password) {
                sendMessage(MSG_ERROR, false, "Invalid credentials format");
                return;
            }
            
        } else if (strcmp(command, CMD_MOUSE_MOVE) == 0) {
            int x = doc["x"];
            int y = doc["y"];
            String resolution_width = doc["mouseSetting"]["resolutionWidth"];
            String resolution_height = doc["mouseSetting"]["resolutionHeight"];
            String correctionFactor = doc["mouseSetting"]["correctionFactor"];
            MouseTo.setScreenResolution(resolution_width.toFloat(), resolution_height.toFloat());
            MouseTo.setCorrectionFactor(correctionFactor.toFloat());
            mouseMove(x, y);
        } else if (strcmp(command, CMD_MOUSE_CLICK) == 0) {
            mouseClick();
        } else if (strcmp(command, CMD_MOUSE_SCROLL) == 0) {
            int scrollAmount = doc["scrollAmount"];
            mouseScroll(scrollAmount);
        } else if (strcmp(command, CMD_TYPING) == 0) {
            const char* text = doc["text"];
            typeText(text);
        } else if (strcmp(command, CMD_COPY) == 0) {
            copyText();
        } else if (strcmp(command, CMD_SELECT_ALL) == 0) {
            selectAll();
        } else if (strcmp(command, CMD_BACKSPACE) == 0) {
            backspace();
        } else if (strcmp(command, CMD_TAB) == 0) {
            tab();
        } else if (strcmp(command, CMD_ENTER) == 0) {
            enter();
        } else {
            sendMessage(MSG_ERROR, false, "Unknown command");
        }
    }
}