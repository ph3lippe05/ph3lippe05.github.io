# 21CHIPS - Blackjack Table Companion 🎰

> **W pełni darmowy, wirtualny bankroll i żetony do gry w Blackjacka ze znajomymi.**  
> Zastępuje fizyczne żetony – wystarczy talia prawdziwych kart i smartfony graczy!

---

## 🚀 Dlaczego ta aplikacja nie wymaga backendu?
Aplikacja została zaprojektowana w 100% jako rozwiązanie **Serverless P2P (WebRTC)**:
- Urządzenie **Krupiera (Hosta)** staje się lokalnym serwerem w pamięci przeglądarki.
- Gracze łączą się bezpośrednio ze stołem krupiera za pomocą **WebRTC DataChannels** (przez darmowy broker PeerJS).
- Zero kosztów utrzymania, zero baz danych, brak konieczności rejestracji kont.
- Aplikację można w całości wrzucić na **GitHub Pages** jako statyczne pliki HTML/CSS/JS!

---

## ✨ Kluczowe funkcje

### 🎩 Dla Krupiera (Host / Stół):
1. **Błyskawiczne tworzenie stołu:**
   - Dowolna liczba żetonów początkowych (np. 1000).
   - Minimalny i maksymalny zakład.
   - Wybór wypłaty za Blackjacka (**3:2** standard lub **6:5** kasyno).
2. **Dołączanie kodem QR i numerem:**
   - 4-cyfrowy kod pokoju.
   - Dynamiczny kod QR (gracz nakierowuje aparat telefonu i od razu wchodzi do pokoju).
   - Bezpośredni link do udostępnienia (np. na Messengerze / WhatsAppie).
3. **Zarządzanie rundą:**
   - **Faza 1: Zakłady** – podgląd stawek graczy w czasie rzeczywistym. Przycisk *"🔒 Zablokuj Zakłady"*.
   - **Faza 2: Rozgrywka** – gracze grają fizycznymi kartami na stole. Możliwość oznaczenia **Double Down** lub **Split**.
   - **Faza 3: Rozliczenie:**
     - 🟢 **Wygrana (1:1)** – zwrot stawki + 1:1 zysku.
     - 👑 **Blackjack (3:2)** – zwrot stawki + 1.5x zysku.
     - 🟡 **Remis (Push)** – zwrot postawionej stawki.
     - 🔴 **Przegrana** – krupier zgarnia stawkę.
     - Pełna obsługa **Splitu** (niezależne rozliczenie Ręki 1 i Ręki 2!).
     - Błyskawiczne przyciski globalne: *"Krupier ma BJ"*, *"Krupier Fura (Bust)"*.
4. **Bankroll & Rebuys:**
   - Panel zarządzania żetonami każdego gracza (szybkie dokupienie: +250, +500, +1000 lub korekta).
   - Tabela statystyk zysków i strat z całej sesji.

---

### 📱 Dla Gracza (Smartfon):
1. **Wirtualna tacka żetonów:**
   - Realistyczne żetony 3D (nominały: 10, 25, 50, 100, 500) z dźwiękiem brzęku ceramiki (Web Audio API) i haptyką (wibracje).
   - Wybór awatara i nicku (zapisywane w pamięci telefonu).
   - Przyciski szybkiego czyszczenia i powtórzenia poprzedniego zakładu (*Repeat*).
2. **Akcje w trakcie rozdania:**
   - **Double Down** – podwojenie zakładu jednym kliknięciem.
   - **Split** – podział na dwie ręce przy parze w kartach.
3. **Powiadomienia i animacje:**
   - Efektowne banery wygranej/Blackjacka wraz z dźwiękowymi fanfarami kasynowymi.

---

## 📦 Jak uruchomić aplikację?

### Opcja 1: Lokalnie (np. z XAMPP)
Pliki znajdują się w katalogu:
```
C:\xampp\htdocs\blackjack
```
Wystarczy uruchomić Apache w XAMPP i wejść w przeglądarce pod adres:
```
http://localhost/blackjack/
```

### Opcja 2: Publikacja za darmo na GitHub Pages (Zalecane)
1. Utwórz nowe publiczne repozytorium na swoim koncie GitHub (np. `blackjack-companion`).
2. Wrzuć zawartość tego katalogu (`index.html`, `style.css`, folder `js/`) do repozytorium.
3. W GitHub przejdź do: **Settings ➔ Pages ➔ Source: Deploy from a branch (main / root) ➔ Save**.
4. Po minucie Twoja aplikacja będzie dostępna publicznie pod darmowym adresem:
   `https://twoj-login.github.io/blackjack-companion/`
5. Każdy znajomy może wejść na ten link ze swojego telefonu z dowolnego miejsca na świecie!

---

## 📂 Struktura plików
- [`index.html`](file:///c:/xampp/htdocs/blackjack/index.html) – kompletna struktura ekranów, modal QR, panele gracza i krupiera.
- [`style.css`](file:///c:/xampp/htdocs/blackjack/style.css) – luksusowy design kasynowy (ciemnozielone sukno, złote detale, żetony 3D).
- [`js/audio.js`](file:///c:/xampp/htdocs/blackjack/js/audio.js) – syntezator dźwięków Web Audio API (brzęk żetonów, wygrane, wibracje).
- [`js/peer-manager.js`](file:///c:/xampp/htdocs/blackjack/js/peer-manager.js) – bezserwerowa komunikacja WebRTC (PeerJS).
- [`js/game-state.js`](file:///c:/xampp/htdocs/blackjack/js/game-state.js) – oficjalna logika zasad Blackjacka, split, double, rozliczenia 3:2 i 1:1.
- [`js/app.js`](file:///c:/xampp/htdocs/blackjack/js/app.js) – główny kontroler UI, obsługa zdarzeń i synchronizacja stołu.
