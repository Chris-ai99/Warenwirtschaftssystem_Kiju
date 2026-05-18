# KiJu Lager Android APK

Dieses Android-Projekt baut eine native Vollbild-App für Handscanner. Die App enthält keinen lokalen Next.js-Server und keine lokale Datenbank. Sie öffnet die zentrale KiJu-Lager-Server-URL in einer Android-WebView, damit alle Scanner denselben Online-Bestand verwenden.

Die bereitgestellte APK lädt die Warenwirtschaft unter:

```text
https://warenwirtschaft.kiju-bi.de/
```

Dadurch werden Web-Oberfläche, Workflows und Scanner-Einstellungen bei jedem Server-Deploy automatisch aktualisiert. Eine neue APK ist nur nötig, wenn sich die native Android-Hülle selbst ändert.

## Server-URL setzen

Die Zieladresse steht in:

```text
app/src/main/res/values/strings.xml
```

Für den Betrieb ist eingetragen:

```text
https://warenwirtschaft.kiju-bi.de/
```

## APK bauen

Voraussetzung:

- Android Studio oder Android SDK
- Gradle oder ein von Android Studio erzeugter Gradle Wrapper
- Java 17

Mit Android Studio:

1. Ordner `android` als Projekt öffnen.
2. Warten, bis Gradle Sync fertig ist.
3. `Build > Build Bundle(s) / APK(s) > Build APK(s)` ausführen.

Mit Gradle:

```powershell
cd android
gradle :app:assembleDebug
```

Die Debug-APK liegt danach hier:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Für das Web-Deployment wird die aktuelle APK zusätzlich nach `public/downloads/kiju-lager-scanner.apk` kopiert. Diese Datei wird im Adminbereich unter `Admin > Scanner` verlinkt und über die Subdomain ausgeliefert.

Installation per USB:

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Scanner-Einstellungen

- Scanner-Modus: `HID`, `Keyboard Wedge` oder Tastatureingabe
- Barcode-Suffix: `Enter` oder `Tab`
- App auf dem Gerät starten und einloggen
- In KiJu Lager den passenden Scan-Workflow öffnen

## Urovo DT40 Intent-Modus

Die App registriert zusätzlich den Broadcast-Intent `android.intent.ACTION_DECODE_DATA`. Für Urovo DT40 / ScanWedge kann dadurch ein Scan die App öffnen oder in den Vordergrund holen und den Barcode direkt an die WebView weiterreichen.

Empfohlen:

1. ScanWedge öffnen.
2. Output Mode auf `Intent` stellen.
3. Action: `android.intent.ACTION_DECODE_DATA`.
4. Barcode-Extra: `barcode_string`.
5. KiJu Lager starten und einloggen.

Die WebView empfängt native Scans als Browser-Event `kiju-native-scan`; die Web-App nutzt denselben Workflow wie bei HID-Scans.

## Auto-Open Grenzen

Automatisches Öffnen beim Scan funktioniert nur zuverlässig, wenn das Gerät Scan-Intents sendet oder per Kiosk/MDM dafür sorgt, dass KiJu Lager im Vordergrund bleibt. Reines HID/Keyboard-Wedge kann eine geschlossene App nicht öffnen, weil Android die Tastenfolge an die aktuell aktive App liefert.

## Vollbild und Kiosk

Die App blendet Status- und Navigationsleisten im Vollbildmodus aus. Für echten Kiosk-Betrieb kann zusätzlich Android-Bildschirmfixierung, ein MDM oder der Lock-Task-Modus des Geräts verwendet werden.
