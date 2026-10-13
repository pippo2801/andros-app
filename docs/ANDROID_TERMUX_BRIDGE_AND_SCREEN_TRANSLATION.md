# Andros Android: Termux bridge e traduzione dello schermo

Stato: specifica tecnica, non implementazione. Questa nota definisce un percorso realistico per due funzioni mancanti senza attribuire ad Andros permessi che Android non concede automaticamente.

## 1. Ponte sicuro con Termux

### Obiettivo
Consentire ad Andros, solo dopo un collegamento esplicito, di leggere o scrivere file autorizzati e avviare operazioni di sviluppo utili senza esporre una shell arbitraria all'app.

### Architettura proposta
- App Andros (Capacitor) come client.
- Un piccolo servizio companion avviato dall'utente in Termux, in ascolto esclusivamente su `127.0.0.1` per impostazione predefinita.
- Associazione esplicita: Termux mostra un codice temporaneo; l'utente lo inserisce in Andros. Scambiare il codice con un token casuale di sessione, con scadenza e revoca.
- Se in futuro si abilita l'accesso LAN, richiedere un'impostazione separata, mostrare l'indirizzo esposto e richiedere autenticazione forte; mai aprire una porta pubblica per default.
- Protocollo versionato con endpoint limitati, ad esempio health, elenco file autorizzati, lettura file, proposta di modifica e applicazione della modifica approvata.

### Regole di sicurezza obbligatorie
1. Nessuna esecuzione arbitraria di comandi ricevuti dal modello o dalla rete.
2. Usare operazioni tipizzate e una allowlist di comandi Git/strumenti; rifiutare shell, pipe, sostituzioni di comando, path traversal e opzioni non previste.
3. Limitare le operazioni a cartelle selezionate dall'utente; canonicalizzare i percorsi e verificare che restino dentro la radice autorizzata.
4. Prima di scrivere un file, mostrare diff e percorso completo; richiedere conferma. Per modifiche a file esistenti, offrire un backup ripristinabile.
5. Richiedere conferma distinta per commit, push, cancellazioni, sovrascritture e operazioni di rete.
6. Non salvare token, chiavi API o contenuti sensibili nei log. Il token di associazione deve poter essere revocato.
7. Restituire risultati strutturati, codici di errore e output con dimensione massima; niente esecuzione in background non visibile.
8. Disconnettere il ponte quando l'utente lo disattiva o la sessione scade.

### API minima proposta
- `GET /v1/health`: versione e stato del servizio, senza informazioni sensibili.
- `GET /v1/capabilities`: elenco delle operazioni effettivamente disponibili.
- `POST /v1/files/list`: elenco in una directory già autorizzata.
- `POST /v1/files/read`: lettura di un file autorizzato con limite di dimensione.
- `POST /v1/files/preview-write`: restituisce un diff senza scrivere.
- `POST /v1/files/apply-write`: applica soltanto una proposta identificata e approvata dall'utente.
- `POST /v1/git/status` e `POST /v1/git/diff`: sola lettura.
- Commit e push, se aggiunti, richiedono conferma esplicita separata.

Questi endpoint sono una proposta, non sono ancora presenti nel codice.

### Fasi d'implementazione
1. Companion Termux con health check, token temporaneo e bind localhost.
2. Client Andros con stato collegato/scollegato e verifica protocollo.
3. Elenco e lettura file in una cartella scelta.
4. Diff e scrittura con backup e conferma.
5. Git status/diff e solo successivamente operazioni di commit/push confermate.
6. Test negativi: token mancante/scaduto, path traversal, file troppo grande, directory non autorizzata, payload malformato, servizio non raggiungibile.

## 2. Traduzione dello schermo Android

### Limiti reali della piattaforma
Una pagina web/Capacitor non può leggere liberamente lo schermo di altre app. La traduzione di altre app richiede una funzione nativa Android e consenso esplicito. Non va simulata con un semplice caricamento di immagini.

### Flusso minimo proposto
1. L'utente tocca «Traduci schermo» e sceglie la lingua di destinazione.
2. Android mostra il consenso MediaProjection per la cattura dello schermo; Andros non deve aggirarlo.
3. Catturare solo mentre la sessione è attiva e mostrare un indicatore chiaro con comando Stop.
4. Estrarre il testo con OCR locale quando possibile; offrire un provider AI solo come alternativa esplicita, avvisando che l'immagine/testo lascia il dispositivo.
5. Mostrare una traduzione leggibile in un pannello Andros. L'overlay sopra altre app è una fase separata: richiede permesso Android dedicato e deve poter essere disattivato subito.
6. Eliminare i frame temporanei appena elaborati, salvo scelta esplicita dell'utente di salvarli.
7. Non registrare audio/video, non acquisire continuamente in background e non inviare schermate a servizi cloud senza un'azione visibile.

### Fasi d'implementazione
- Prima fase: traduzione di screenshot selezionati dall'utente, riutilizzando il flusso immagini già presente.
- Seconda fase: modulo Android nativo per cattura singola con MediaProjection e OCR.
- Terza fase: traduzione ripetuta su richiesta durante una sessione visibile.
- Overlay flottante soltanto dopo aver verificato permessi, comportamento con altre app, consumi e arresto immediato.

### Criteri di accettazione
- L'utente vede quando la cattura è attiva e può interromperla.
- Rifiutare il permesso non blocca il resto di Andros.
- Nessun frame viene salvato o inviato in background senza consenso.
- Funziona con rete assente per il percorso OCR/traduzione locale, se il modello necessario è installato; altrimenti il limite è dichiarato.
- Testare permessi negati, cambio app, rotazione schermo, memoria insufficiente, stop della sessione e revoca del permesso.

## Stato
Questa specifica non implementa ancora il bridge Termux né la cattura dello schermo. La UI e i permessi Android dovranno essere implementati e verificati nella fase di sviluppo/test dedicata. Nessun APK viene creato da questa attività.
