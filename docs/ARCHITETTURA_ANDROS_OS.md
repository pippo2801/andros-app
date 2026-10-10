# Architettura ANDROS OS — stato integrazioni

## Provider AI
- Ollama è il provider locale predefinito.
- `aiRouter.ts` classifica il compito e seleziona un modello Ollama installato.
- `gemini.ts` è un provider opzionale per Gemini 2.5 Flash, chiamato solo se la chiave è stata configurata in sessione e la strategia lo consente.
- In modalità automatica il codice privilegia Ollama; Gemini gestisce gli altri compiti se attivato. Sono previsti fallback trasparenti.
- ChatGPT e Copilot vengono aperti tramite browser e i loro archivi possono essere importati; non sono collegati alle API consumer private. Nessuna password o cookie viene estratto.

## Google OAuth e Drive
- Plugin: `@capacitor-community/generic-oauth2`, flusso authorization code con PKCE.
- Scopes: `openid email profile https://www.googleapis.com/auth/drive.appdata`.
- Il token d'accesso è mantenuto in memoria, senza refresh token persistente.
- `googleDriveSync.ts` unisce archivi e regole per ID in un file JSON visibile creato da Andros nella cartella Drive dell'utente.
- La sincronizzazione richiede un Client ID OAuth configurato in Google Cloud e un test reale su Android; le credenziali del progetto non possono essere inventate o create da questo repository.
- Il backup contiene dati personali: l'utente deve autorizzare il progetto e decidere consapevolmente se sincronizzarli.

## Import archivio
- JSON compatibile con il formato ChatGPT `mapping` e schemi generici `messages`/`turns`.
- ZIP: ricerca `conversations.json` e varianti numerate; se non presenti, tenta file HTML pertinenti Gemini/Copilot.
- CSV: interpreta colonne riconosciute come prompt/question e response/answer; in assenza usa il testo della riga come riferimento.
- TXT/MD/HTML: parser testuale generico; alcuni export provider possono richiedere ulteriore normalizzazione. Verificare i contenuti importati.

## Test richiesti prima della release
1. Build web Vite e sync Capacitor.
2. Build APK debug in GitHub Actions.
3. Installazione e avvio sul telefono fisico.
4. Test chat Ollama e fallback Gemini.
5. Login OAuth Google con Client ID e SHA-1 corretti.
6. Sync su due dispositivi con lo stesso account e verifica deduplicazione.
7. Test import ZIP ChatGPT, export Gemini Takeout e CSV Copilot con archivi reali privi di dati sensibili.
8. Test di disconnessione e revoca autorizzazioni Google.

## Limiti
Nessun servizio API è illimitato. Il livello gratuito Gemini è soggetto a limiti e condizioni. La sola autenticazione Google non concede accesso alla cronologia di ChatGPT/Copilot. La build CI non dimostra da sola che le credenziali OAuth del proprietario siano corrette.
