# KiJu Lager Scanner PWA

Professionelle Lagerverwaltungs-PWA für Android-Handscanner wie den **MUNBYN IPDA082P**. Die App läuft im Browser oder installiert als PWA und unterstützt Barcode-Suche, Artikelverwaltung, Lagerbestände, Vollgut/Leergut, Buchungsverlauf, CSV-Import/Export und rollenbasierten Login.

## Tech-Stack

- Next.js App Router, React, TypeScript
- PostgreSQL, Prisma ORM
- Eigene Cookie-Session-Auth mit bcrypt-Passwort-Hashing
- Docker Compose mit PostgreSQL, App und Caddy HTTPS-Reverse-Proxy
- Online-first PWA: App-Shell wird gecached, Bestandsbuchungen bleiben serverpflichtig

Der Stack bleibt monolithisch, weil Scanner-Workflows kurze Latenz, einfache Deployments und starke Transaktionssicherheit brauchen. Kamera-Scan ist in v1 bewusst nicht enthalten; der MUNBYN-Scanner wird über HID/Tastatureingabe plus manuelle Barcode-Eingabe unterstützt.

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

## Datenbank

Prisma-Modelle:

- `User`, `Role`, `Session`
- `Article`, `Barcode`, `Category`
- `Warehouse`, `Stock`, `StockMovement`
- `Settings`

Wichtig:

- Ein Artikel kann mehrere Barcodes haben.
- Bestand ist pro Artikel und Lager eindeutig.
- `fullQuantity` und `emptyQuantity` trennen Vollgut und Leergut.
- `StockMovement` ist append-only und speichert Bestand vorher/nachher.
- Artikel, Lager, Kategorien und Benutzer werden deaktiviert statt gelöscht.

Migration ausführen:

```powershell
npm run prisma:migrate
```

Admin erneut anlegen/aktualisieren:

```powershell
npm run prisma:seed
```

## Rollen

Admin:

- Artikel, Preise, Lager, Kategorien, Benutzer und Einstellungen verwalten
- Bestände buchen
- Import/Export nutzen
- Buchungsverlauf ansehen

Mitarbeiter:

- Artikel scannen/suchen
- Einbuchen, Ausbuchen, Umbuchen
- Leergut erfassen
- Bestand und Verlauf ansehen

## MUNBYN IPDA082P einrichten

1. Scanner einschalten und mit WLAN verbinden.
2. Android Chrome öffnen und die HTTPS-URL der App aufrufen.
3. Login mit dem Seed-Admin durchführen.
4. Chrome-Menü öffnen und **Zum Startbildschirm hinzufügen** wählen.
5. Die installierte PWA starten.
6. Scanner-App/Scanner-Einstellungen auf HID oder Keyboard Wedge stellen.
7. Barcode-Suffix auf `Enter` oder `Tab` setzen.
8. In der App `Artikel suchen` öffnen und einen Barcode mit dem Hardware-Scanbutton scannen.

Die App puffert schnelle Tastatureingaben, erkennt `Enter`/`Tab` als Scan-Ende und sucht den Artikel automatisch. Wenn ein Barcode unbekannt ist, bietet die Admin-Oberfläche direkt das Anlegen des Artikels an.

## USB-Verbindung SQ45S

Wenn der MUNBYN IPDA082P per USB mit Windows verbunden ist, erscheint er unter:

```text
Dieser PC\SQ45S
```

Das ist für Dateiübertragung nützlich, etwa Dokumente oder Screenshots. Für diese PWA muss keine APK übertragen werden. Die Installation erfolgt über Android Chrome direkt von der HTTPS-URL.

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
- Artikelimport als CSV mit Spalten wie `Artikelnummer;Name;Barcode;Kategorie;Einkaufspreis;Verkaufspreis;Pfandbetrag;Einheit;Leergut`

CSV-Export schützt gegen Spreadsheet-Formel-Injection.

## Tests

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
```

E2E-Tests:

```powershell
npm run test:e2e
```

Die wichtigsten Testziele sind Barcode-Normalisierung, Rollenrechte, negative Bestände, Ein-/Ausbuchung, Umbuchung, Leergut, CSV-Export und PWA-Basisverhalten.

## Sicherheit

- Login erforderlich für App und API.
- Passwörter werden mit bcrypt gehasht.
- Session-Token werden nur gehasht in der Datenbank gespeichert.
- Mutierende API-Aufrufe prüfen CSRF-Token.
- Rollen werden serverseitig geprüft.
- Bestandsänderungen laufen in PostgreSQL-Transaktionen mit Row Locking.
- Buchungsverlauf wird nicht gelöscht.
