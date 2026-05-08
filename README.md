# KiJu Lager Scanner PWA

Professionelle Lagerverwaltungs-PWA für Android-Handscanner wie den **MUNBYN IPDA082P**. Die App läuft im Browser oder installiert als PWA und unterstützt Barcode-Suche, Artikelverwaltung, Lagerbestände, Vollgut/Leergut, Buchungsverlauf, Import/Export, Admin-Konfiguration und rollenbasierten Login.

## Tech-Stack

- Next.js App Router, React, TypeScript
- PostgreSQL, Prisma ORM
- Eigene Cookie-Session-Auth mit bcrypt-Passwort-Hashing
- Docker Compose mit PostgreSQL, App und Caddy HTTPS-Reverse-Proxy
- Online-first PWA: App-Shell wird gecached, Bestandsbuchungen bleiben serverpflichtig

Der Stack bleibt monolithisch, weil Scanner-Workflows kurze Latenz, einfache Deployments und starke Transaktionssicherheit brauchen. Der MUNBYN-Scanner wird über HID/Tastatureingabe plus manuelle Barcode-Eingabe unterstützt.

## Installation

```powershell
copy .env.example .env
npm install
npm run prisma:generate
```

Für lokale Entwicklung eine PostgreSQL-Datenbank bereitstellen und `DATABASE_URL` in `.env` setzen. Danach:

```powershell
npm run prisma:dev
npm run prisma:seed
npm run dev
```

Die App läuft lokal auf `http://localhost:3000`.

## Scanner im lokalen Netzwerk

Damit der MUNBYN IPDA082P die App erreicht, muss der Dev-Server auf allen Netzwerkadressen lauschen:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Dann auf dem Scanner die LAN-Adresse des PCs öffnen, zum Beispiel:

```text
http://192.168.178.98:3000
```

PC und Scanner müssen im selben WLAN sein. Falls Windows fragt, Node.js/Next.js im privaten Netzwerk zulassen.

## Admin-System

Der Adminbereich ist unter `/admin` erreichbar und enthält ein zentrales Dashboard mit Kacheln und responsive Bedienung für PC und Scanner.

Verwaltbare Bereiche:

- Artikel und Produkte mit Barcodes, Preisen, Pfand, Mindestbestand, Einheiten und Aktivstatus
- Lager mit Lagerart, Standardlager, Sichtbarkeit, Standort-Zuordnung und Aktivstatus
- Standorte mit Standardstandort und Sortierung
- Kategorien mit Farbe/Icon, Standardwerten, Pfand- und Leergut-Optionen
- Verpackungseinheiten/Gebindegrößen mit Stückzahl und Kategoriebezug
- Benutzer mit Rolle, Aktivstatus, letztem Login sowie Lager- und Standortzugriff
- Rollen, Rechte und Rollen-Rechte-Zuordnung
- Buchungsarten und Buchungsgründe mit Pflichtnotiz und Aktivstatus
- Scanner-Einstellungen für HID/Tastatureingabe, Enter-Suffix, Mindestlänge, Zeitfenster, Ton, Vibration und Standardmenge
- Pfand/Leergut-Einstellungen inklusive Standard-Leergutlager und Pfandwerte
- Systemtexte, Button- und Menübezeichnungen
- Menü-Konfiguration mit Sichtbarkeit, Reihenfolge, Rollen/Rechten und Startbildschirm-Logik
- Systemeinstellungen wie Firmenname, Logo, Sprache, Währung, Datumsformat, Theme, Session-Dauer, Wartungsmodus und Systemstatus
- Import/Export und Protokolle/Historie

Alle Adminbereiche werden serverseitig durch Rechte geschützt. Normale Mitarbeiter sehen keine Admin-Navigation und können Admin-APIs nicht nutzen.

## Rollen und Rechte

Rollen werden in der Datenbank verwaltet. Der Seed legt sinnvolle Standardrollen an:

- `ADMIN`
- `MITARBEITER`
- `LAGERARBEITER`
- `NUR_LESEN`
- `SCANNER_BENUTZER`

Rechte sind granular, zum Beispiel `article:read`, `article:write`, `warehouse:write`, `stock:book`, `stock:transfer`, `stock:empty`, `role:write`, `settings:write`, `scanner:write`, `menu:write`, `audit:read` und weitere Adminrechte.

## Datenbank

Wichtige Prisma-Modelle:

- `User`, `Role`, `Permission`, `RolePermission`, `Session`
- `Article`, `Barcode`, `Category`, `PackagingUnit`, `ProductPackagingUnit`
- `Location`, `Warehouse`, `Stock`
- `StockMovement`, `StockMovementBatch`, `BookingReason`
- `Settings`, `UiLabel`, `MenuConfig`, `AuditLog`

Wichtig:

- Ein Artikel kann mehrere Barcodes haben.
- Bestand ist pro Artikel und Lager eindeutig.
- `fullQuantity` und `emptyQuantity` trennen Vollgut und Leergut.
- `StockMovement` ist append-only und speichert Bestand vorher/nachher.
- Artikel, Lager, Kategorien, Rollen, Benutzer und andere Stammdaten werden deaktiviert statt hart gelöscht, wenn Historie oder abhängige Daten vorhanden sind.
- Adminänderungen werden in `AuditLog` protokolliert.

Migration ausführen:

```powershell
npm run prisma:migrate
```

Admin, Rollen, Rechte und Standardwerte erneut anlegen/aktualisieren:

```powershell
npm run prisma:seed
```

## MUNBYN IPDA082P einrichten

1. Scanner einschalten und mit WLAN verbinden.
2. Android Chrome öffnen und die App-URL aufrufen.
3. Login durchführen.
4. Chrome-Menü öffnen und **Zum Startbildschirm hinzufügen** wählen.
5. Die installierte PWA starten.
6. Scanner-App/Scanner-Einstellungen auf HID oder Keyboard Wedge stellen.
7. Barcode-Suffix auf `Enter` aktivieren.
8. In `Admin > Scanner` Mindestlänge, Zeitfenster, Standardmenge, Ton/Vibration und Testbereich prüfen.
9. In der App scannen. Bekannte Barcodes öffnen den passenden Scan-Workflow; unbekannte Barcodes können je nach Einstellung ins Anlegen-Menü führen.

## Urovo DT40 / native APK

Die Neben-Branch `codex/scanner-workflow-urovo` wurde in den Main-Stand übernommen, soweit sie sauber zum Admin-System passt. Zusätzlich zur PWA liegt im Ordner `android` eine native Vollbild-APK-Struktur für Urovo-Geräte. Die APK enthält keinen lokalen Server, sondern lädt die zentrale KiJu-Lager-URL in einer Android-WebView.

APK bauen:

```powershell
cd android
gradle :app:assembleDebug
```

Installation per USB:

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Für Urovo ScanWedge/Intent-Modus nutzt die APK den Broadcast `android.intent.ACTION_DECODE_DATA` und liest u. a. `barcode_string`. HID/Keyboard-Wedge bleibt weiterhin unterstützt, wenn KiJu Lager geöffnet und fokussiert ist.

## Batch-Einbuchung

`/scan/einbuchen` nutzt jetzt eine Scanliste:

- mehrere Artikel nacheinander scannen
- gleiche Artikel/Gebinde werden zusammengefasst
- Menge direkt per Hardware-Numpad ändern
- `Enter` bestätigt die aktive Position
- alles gemeinsam über `/api/stock/in/batch` buchen

Das ist auf dem Scanner robuster als jede Position einzeln zu speichern und vermeidet Abbrüche bei längeren Wareneingängen.

## Workflows

- Artikel suchen: Barcode scannen oder manuell eingeben.
- Artikel anlegen: Barcode, Artikelnummer, Name, Kategorie, Preise, Pfand, Einheit und Leergut-Kennzeichnung speichern.
- Einbuchen: Artikel scannen, Lager wählen, Menge erfassen.
- Ausbuchen: Artikel scannen, Lager wählen, Menge und Grund erfassen.
- Umbuchen: Quelllager, Ziellager und Menge erfassen.
- Leergut: Leergut zurück oder raus buchen, Pfandwert wird angezeigt.
- Verlauf: alle Buchungen mit Benutzer, Lager, Menge, Grund und Bestand vorher/nachher.

## Import / Export

Adminbereich `Import/Export`:

- Artikelexport: `/api/export/articles.csv`
- Bestandsliste: `/api/export/stock.csv`
- Buchungsverlauf: `/api/export/movements.csv`
- Protokolle als JSON über den Adminbereich
- Artikelimport als CSV mit Vorschau/Fehlerausgabe über die bestehende Import-API

CSV-Dateien können direkt mit Excel geöffnet und bearbeitet werden. CSV-Export schützt gegen Spreadsheet-Formel-Injection.

## Sicherheit und Datenintegrität

- Login erforderlich für App und API.
- Passwörter werden mit bcrypt gehasht.
- Session-Token werden nur gehasht in der Datenbank gespeichert.
- Mutierende API-Aufrufe prüfen CSRF-Token.
- Rollen und Rechte werden serverseitig geprüft.
- Bestandsänderungen laufen in PostgreSQL-Transaktionen mit Row Locking.
- Keine direkte Löschung von Buchungen; Korrekturen laufen über Gegen- oder Korrekturbuchungen.
- Keine negativen Bestände, außer das entsprechende Adminrecht/Systemsetting erlaubt es.
- Kritische Stammdaten werden deaktiviert, wenn Historie erhalten bleiben muss.

## Docker / VPS

Für Produktion oder einen VPS:

1. `.env` anpassen:
   - `CADDY_DOMAIN=lager.deine-domain.de`
   - `NEXT_PUBLIC_APP_URL=https://lager.deine-domain.de`
   - starkes `POSTGRES_PASSWORD`
   - starkes `AUTH_SECRET`
   - sicheres `ADMIN_PASSWORD`
2. DNS-A-Record der Domain auf den VPS setzen.
3. Ports `80` und `443` öffnen.
4. Starten:

```powershell
docker compose up --build
```

Compose startet PostgreSQL, führt Migrationen und Seed aus, startet die Next.js-App und stellt sie über Caddy per HTTPS bereit.

## Umgebungsvariablen

- `DATABASE_URL`: PostgreSQL-Verbindungsstring
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: Datenbank für Compose
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: initialer Admin-Benutzer
- `AUTH_SECRET`: langer zufälliger Produktions-Secret
- `ALLOW_NEGATIVE_STOCK`: Standard `false`
- `LOW_STOCK_THRESHOLD_DEFAULT`: Standard-Warnbestand
- `NEXT_PUBLIC_APP_URL`: öffentliche HTTPS-URL
- `CADDY_DOMAIN`: Domain für Caddy/HTTPS
- `SEED_DEMO_DATA`: optional `true` für Demo-Artikel

## Tests

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E-Tests:

```powershell
npm run test:e2e
```

Die wichtigsten Testziele sind Barcode-Normalisierung, Rollenrechte, negative Bestände, Ein-/Ausbuchung, Umbuchung, Leergut, CSV-Export und PWA-Basisverhalten.
