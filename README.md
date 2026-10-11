# ANDROS OS — assistente personale Android

Andros OS è un'app Android basata su React, Vite e Capacitor, pensata per funzionare senza abbonamenti obbligatori. La modalità AI attuale usa Ollama: il modello gira su un dispositivo o un PC controllato dall'utente e non richiede una chiave API a pagamento.

## Funzioni implementate

- Chat locale con cronologia persistente sul dispositivo.
- Memoria di regole permanenti: una regola entra in memoria solo quando l'utente la salva e approva.
- Router automatico locale: classifica la richiesta (codice, ragionamento, scrittura, visione o generale) e sceglie tra i modelli Ollama installati.
- Configurazione dell'endpoint Ollama e scelta del modello preferito.
- Archivio conversazioni locale: importazione JSON/TXT/MD/HTML/CSV, ricerca full-text, salvataggio della chat corrente, ripristino di una conversazione ed esportazione dell'archivio.
- Nessun obbligo di account o API a pagamento per la modalità locale.

## Avvio sviluppo

Prerequisiti: Node.js 22, npm, JDK 21, Android SDK e un'installazione di Ollama raggiungibile dalla rete.

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Scaricare un APK di test

Il workflow GitHub Actions `Build Android APK` compila la UI, sincronizza Capacitor, costruisce l'APK debug e lo carica come artefatto `ANDROS-OS-debug-apk`. Gli artefatti temporanei hanno una durata limitata; per scaricare l'APK apri il workflow della build riuscita, sezione Artifacts.

## Collegare Ollama

1. Avvia Ollama sul dispositivo o sul PC.
2. Installa almeno un modello gratuito, ad esempio un modello coder adatto alla memoria disponibile.
3. Se Ollama gira sul PC, fai in modo che il telefono raggiunga l'indirizzo IP del PC e configura l'endpoint nelle impostazioni dell'app (porta predefinita 11434).
4. Usa **Verifica** per vedere i modelli installati.

L'endpoint `127.0.0.1` indica il dispositivo stesso: non punta automaticamente al PC. Non esporre Ollama direttamente su Internet; su reti non fidate usa una rete privata e regole firewall appropriate.

## Archivio delle vecchie chat

L'archivio è locale e non accede autonomamente agli account di ChatGPT, Copilot o Gemini. Per ChatGPT, importa `conversations.json` estratto dall'esportazione dati. Per altri servizi, importa un file JSON o testuale compatibile. L'accesso Google non conferisce da solo permessi alle conversazioni di altri fornitori.

## Stato dichiarato con trasparenza

- Il router attuale sceglie tra i modelli locali Ollama installati; non chiama automaticamente le app consumer ChatGPT, Copilot o Gemini.
- Il pulsante di accesso Google e la sincronizzazione cloud non sono attivi in questa build: richiedono un client OAuth configurato e un flusso Android supportato. Non simuliamo un login e non chiediamo password Google nell'app.
- L'archivio è locale fino a quando non si esporta o copia il file su un altro dispositivo.
- Questa è una build di test, non una release firmata per distribuzione.

## Sicurezza

Non inserire chiavi API nel codice o committarle nel repository. Se una chiave è stata esposta nella cronologia Git, revocala nel relativo provider. Prima di importare archivi, considera che possono contenere dati personali. L'archivio resta sul dispositivo finché l'utente non lo esporta.


## Native Accessibility and screen translation (branch di sviluppo)

Il servizio Accessibilità deve essere attivato manualmente dall'utente. Legge testo
accessibile dalle app non protette in memoria volatile e non esegue tocchi né scrive
nelle altre app. I package bancari/pagamento riconosciuti vengono esclusi; nessuna
lista euristica può garantire di riconoscere ogni app finanziaria esistente.

Il traduttore offre rilevamento automatico della lingua, selezione della destinazione,
copia e lettura vocale. La traduzione del testo inserito usa il modello Ollama
configurato. La traduzione live dello schermo usa invece OCR e traduzione on-device
ML Kit, senza chiavi API a pagamento. I modelli linguistici di ML Kit possono essere
scaricati alla prima esecuzione; per il download iniziale serve una connessione.

La traduzione live richiede:
- servizio Accessibilità Andros attivo per sospendere l'OCR sulle app protette;
- permesso Android per mostrare una sovrapposizione;
- consenso di sistema alla cattura schermo per ogni sessione;
- notifica persistente con comando **Arresta** durante l'acquisizione.

L'OCR prova prima il modello latino e, se non trova testo, modelli per cinese,
giapponese, coreano e devanagari. La copertura non è universale: alcuni caratteri,
testi piccoli, video, animazioni o app con protezioni possono non essere letti.
L'acquisizione avviene in memoria e non salva screenshot su disco. La traduzione
live è una funzione sperimentale da verificare sul dispositivo reale; controlla
sempre i permessi e arresta la sessione dalla notifica quando hai finito.

La voce trascritta non autentica la persona che parla. Wake word, verifica biometrica
della voce e automazione autonoma delle app non sono ancora implementate. Questa
build resta di test finché non è stata installata e verificata sul telefono target.

## Voice input/output (branch di sviluppo)

Il branch aggiunge un pulsante di dettatura Android con permesso microfono richiesto
dal sistema e la lettura ad alta voce delle risposte tramite Text-to-Speech. La
trascrizione viene inserita nel campo di testo e deve essere controllata dall'utente
prima dell'invio.

**La trascrizione non identifica la persona che parla.** Questa versione non implementa
ancora wake word sempre attiva, riconoscimento biometrico della voce o verifica
anti-registrazione. Non usare la dettatura come unica autorizzazione per azioni
sensibili. L'automazione resta disabilitata nel bridge Accessibilità iniziale.




## Indipendenza Android: il PC non è un requisito

Andros Android è un'app autonoma: non richiede che il PC Windows sia acceso, collegato via USB, raggiungibile in rete o abbia Ollama avviato. L'endpoint predefinito `127.0.0.1:11434` indica il telefono stesso; non va sostituito con l'IP del PC come requisito generale.

- Chat, cronologia, regole e impostazioni locali restano sul telefono.
- Un endpoint Ollama su PC è soltanto un'opzione avanzata, non la configurazione obbligatoria.
- Se sul telefono non è disponibile un provider AI locale, l'interfaccia e i dati restano disponibili ma le risposte AI richiedono un provider configurato (per esempio Gemini facoltativo, se supportato e abilitato). Non viene dichiarata una modalità AI offline completa finché non è verificato un modello realmente eseguibile sul telefono.
- La versione Windows ha processi, configurazione e archivio separati; non viene avviata né controllata dall'app Android.
- I dati non vengono sincronizzati tra Android e Windows automaticamente. Ogni futura importazione o sincronizzazione deve essere esplicita e non distruttiva.

**APK:** non generare né caricare una nuova APK durante questo lavoro. La build Android verrà richiesta dall'utente in un momento successivo.


## Sincronizzazione manuale (Android)

La UI Android include il pulsante **Sincronizza**. Aprirlo non trasferisce nulla automaticamente:
- **Esporta pacchetto** crea/condivide un JSON con chat corrente, regole permanenti approvate e archivio.
- **Importa e unisci** richiede di scegliere un file e confermare prima di applicare i dati.
- L'importazione conserva la chat corrente, unisce regole e conversazioni evitando duplicati semplici e non trasferisce l'endpoint Ollama del dispositivo.
- Se i limiti locali non consentono di conservare tutti i dati, l'importazione viene rifiutata invece di eliminare silenziosamente dati esistenti.

Questo è trasferimento manuale tramite file, non sincronizzazione cloud in tempo reale. Il supporto d'import/export nel client Windows deve ancora essere collegato allo stesso formato prima di poter trasferire i dati tra Android e Windows.

## APK sotto controllo dell'utente

Il workflow `.github/workflows/build-apk.yml` è solo manuale (`workflow_dispatch`). Le modifiche al codice non avviano automaticamente la creazione di una APK. Il workflow `web-checks.yml` controlla solo la build web e non produce APK.
