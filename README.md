# ANDROS OS — assistente personale Android

Andros OS è un'app Android basata su React, Vite e Capacitor, progettata per restare utilizzabile senza abbonamenti obbligatori. La modalità locale usa Ollama; Gemini API è un provider facoltativo con livello gratuito e limiti propri.

## Funzioni disponibili in questa versione

- Chat locale e cronologia persistente sul dispositivo.
- Regole permanenti salvate solo dopo approvazione esplicita.
- Router automatico: distingue attività di codice, ragionamento, scrittura, visione e richieste generali.
- Ollama locale, con scelta tra i modelli già installati.
- Provider Gemini 2.5 Flash facoltativo, attivabile con una chiave API ottenuta da Google AI Studio. La chiave resta in `sessionStorage`, non viene inserita nei file del repository e viene richiesta nuovamente in una nuova sessione.
- Strategia AI selezionabile: automatica, solo Ollama oppure Gemini. In modalità automatica Andros privilegia Ollama per il codice e può usare Gemini per altri compiti quando è configurato; in caso di errore locale può ripiegare su Gemini.
- Archivio locale: importazione JSON, TXT, MD, HTML, CSV e ZIP. Può leggere direttamente gli ZIP ChatGPT che contengono `conversations.json`; supporta CSV con colonne prompt/response e dati testuali generici. Ricerca, ripristino, salvataggio della chat corrente ed esportazione.
- Accesso OAuth Google e backup/sincronizzazione dell'archivio e delle regole tramite la cartella privata `appDataFolder` di Drive, dopo la configurazione del progetto OAuth.
- Collegamenti per aprire ChatGPT, Copilot e Gemini nei rispettivi servizi, senza fingere un accesso alle loro chat private.

## Installazione e build

Prerequisiti: Node.js 22, npm, JDK 21, Android SDK e, per la modalità locale, Ollama.

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`.

Il workflow GitHub Actions **Build Android APK** produce l'artefatto `ANDROS-OS-debug-apk`. La build CI dimostra che il progetto si compila; non sostituisce il test di login e sincronizzazione su un telefono fisico.

## Collegare Ollama

1. Avvia Ollama sul dispositivo o sul PC e installa almeno un modello.
2. Se Ollama gira sul PC, configura l'indirizzo IP del PC raggiungibile dal telefono e la porta 11434.
3. Premi **Verifica** nelle impostazioni.

`127.0.0.1` indica il dispositivo stesso, non il PC. Non esporre Ollama direttamente a Internet.

## Attivare Gemini (opzionale)

1. Crea una chiave in [Google AI Studio](https://aistudio.google.com/apikey).
2. In Andros apri **Impostazioni → Chiave Gemini API**, inserisci la chiave e premi **Applica chiave**.
3. Scegli **Automatica** o **Gemini API**.

La chiave resta nella sessione corrente. Il livello gratuito è soggetto a disponibilità, limiti e condizioni Google; non inviare contenuti sensibili se non hai verificato le condizioni del provider. Se non configuri la chiave, Andros continua a usare Ollama.

## Attivare Google Drive Sync

Il login è reale, ma richiede la configurazione OAuth del proprietario del progetto: nessuna app può autenticarsi con il tuo account senza che il progetto abbia un client OAuth valido.

1. In Google Cloud crea un progetto e abilita **Google Drive API**.
2. Configura la schermata di consenso OAuth e aggiungi l'account di test.
3. Crea il client OAuth Android con package `com.andros.app` e il certificato SHA-1 della build che stai installando. La configurazione di debug e quella di release possono avere SHA-1 diversi.
4. Inserisci il Client ID completo nelle impostazioni **Account Google e sincronizzazione**.
5. Premi **Accedi con Google**, autorizza l'ambito minimo richiesto e poi **Sincronizza**.

Andros richiede `openid`, `email`, `profile` e `drive.appdata`. La sincronizzazione salva archivio e regole approvate nell'area dati privata di Andros su Drive, non legge tutta la cartella Drive. Il token d'accesso resta in memoria durante la sessione e non viene salvato su disco. Per usare la sincronizzazione su più dispositivi, configura lo stesso progetto OAuth e autorizza l'account su ciascuno. Il primo login va verificato su dispositivo reale: le impostazioni OAuth e il certificato devono corrispondere alla build.

## ChatGPT, Gemini e Copilot: cosa può importare Andros

- **ChatGPT:** esporta i dati da Impostazioni → Controlli dei dati → Esporta, estrai lo ZIP e puoi importarlo direttamente nell'archivio Andros.
- **Gemini:** usa Google Takeout per esportare i dati Gemini; il formato esatto può variare, quindi verifica il contenuto dopo l'importazione.
- **Copilot:** la cronologia di attività personale può essere esportata dal dashboard privacy Microsoft in CSV; per Copilot/Microsoft 365 usa l'esportazione disponibile per il tuo account.

Le esportazioni sono file forniti dall'utente. L'autenticazione Google **non** autorizza Andros a leggere automaticamente le chat di ChatGPT o Copilot. ChatGPT e Copilot non sono collegati come provider API automatici in questa versione; i pulsanti aprono i servizi ufficiali e l'archivio permette l'importazione dei file esportati. Non automatizziamo l'estrazione di cookie, password o sessioni private.

## Costi e limiti

- Ollama: software gratuito/open source; il costo hardware/energia resta a carico dell'utente.
- Gemini API: piano gratuito disponibile per alcuni modelli con limiti e condizioni del provider; non è una garanzia di disponibilità illimitata.
- OAuth e Drive: uso dell'area dati di Drive secondo le quote Google. La configurazione OAuth deve essere eseguita dal proprietario del progetto.
- ChatGPT/Copilot: collegamento diretto alle API consumer non disponibile in questa build; apertura web e importazione export non richiedono un'API a pagamento.

## Sicurezza e stato

- Nessuna password Google, ChatGPT o Microsoft viene chiesta all'interno di Andros.
- Le chiavi API non devono essere committate nel repository.
- I backup cloud includono le conversazioni archiviate e le regole approvate: importa e sincronizza solo contenuti che vuoi conservare su Drive.
- Questa è una build di test. Login e sync vanno verificati con il Client ID OAuth del progetto e su dispositivo fisico prima di considerare completata la release.
