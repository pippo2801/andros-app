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


## Native Accessibility foundation (branch di sviluppo)

Il branch `feat/native-accessibility-foundation` aggiunge un primo servizio Android
abilitabile soltanto dall'utente, con pannello Impostazioni per controllare lo stato
e aprire le impostazioni Accessibilità del sistema.

- Il servizio registra soltanto il package dell'app in primo piano.
- La lista protetta contiene package bancari/pagamento noti e controlli conservativi
  sui nomi dei package.
- Non legge il testo delle schermate, non effettua tocchi, non scrive testo e non
  invia dati dello schermo.
- Il bridge TypeScript dichiara esplicitamente `canAutomate: false`.
- L'utente deve attivare il servizio manualmente nelle impostazioni Android.

Questa è soltanto la base nativa di stato e consenso. Il controllo effettivo delle app
richiede in seguito autenticazione attendibile, denylist configurabile, verifiche
per azione, cancellazione immediata e test su dispositivo. Non va considerato ancora
un assistente autonomo pronto all'uso.


## Voice input/output (branch di sviluppo)

Il branch aggiunge un pulsante di dettatura Android con permesso microfono richiesto
dal sistema e la lettura ad alta voce delle risposte tramite Text-to-Speech. La
trascrizione viene inserita nel campo di testo e deve essere controllata dall'utente
prima dell'invio.

**La trascrizione non identifica la persona che parla.** Questa versione non implementa
ancora wake word sempre attiva, riconoscimento biometrico della voce o verifica
anti-registrazione. Non usare la dettatura come unica autorizzazione per azioni
sensibili. L'automazione resta disabilitata nel bridge Accessibilità iniziale.
