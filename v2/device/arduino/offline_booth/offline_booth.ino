// Offline booth: RFID RC522 only (UNO)
// RC522: MISO 12, MOSI 11, SCK 13, SDA/SS 10, RST 9, 3.3V, GND

#include <SPI.h>
#include <MFRC522.h>

#define RFID_SS 10
#define RFID_RST 9

MFRC522 rfid(RFID_SS, RFID_RST);
unsigned long lastHeartbeatAt = 0;
String lastUid = "";
unsigned long lastUidPrintedAt = 0;
unsigned long lastUidSeenAt = 0;
const unsigned long UID_REPEAT_MS = 3000;
const unsigned long RFID_REINIT_IDLE_MS = 12000;

// Initialize serial and RFID reader.
void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  delay(120);
  lastUidSeenAt = millis();
  Serial.println("BOOT:RC522 ready");
}

// Poll RFID reader and emit serial messages.
void loop() {
  const unsigned long now = millis();
  if (now - lastHeartbeatAt >= 2000) {
    lastHeartbeatAt = now;
    Serial.println("STATUS:READY");
  }
  if (now - lastUidSeenAt >= RFID_REINIT_IDLE_MS) {
    rfid.PCD_Init();
    lastUidSeenAt = now;
    Serial.println("STATUS:RFID_REINIT");
  }

  const bool isNewCard = rfid.PICC_IsNewCardPresent();
  if (!isNewCard && !rfid.PICC_ReadCardSerial()) {
    delay(80);
    return;
  }
  if (isNewCard && !rfid.PICC_ReadCardSerial()) {
    delay(80);
    return;
  }

  String uidHex = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uidHex += "0";
    }
    uidHex += String(rfid.uid.uidByte[i], HEX);
  }

  uidHex.toUpperCase();
  if (uidHex != lastUid || now - lastUidPrintedAt >= UID_REPEAT_MS) {
    Serial.print("RFID:");
    Serial.println(uidHex);
    lastUid = uidHex;
    lastUidPrintedAt = now;
    lastUidSeenAt = now;
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(120);
}
