# Andros OS — stato verificabile dei provider AI

Aggiornato: 2026-10-15. Questo documento distingue le funzioni presenti nel codice da quelle ancora da verificare sul dispositivo.

## Provider AI: stato attuale

- [x] **Ollama**: il client Android/Web chiama l'endpoint Ollama configurato e usa il modello locale scelto. Modello predefinito nel codice: `qwen2.5-coder:7b`.
- [x] **Google Gemini**: chiamata diretta a Gemini API con chiave fornita dall'utente; la chiave è conservata nella sessione, non come segreto incorporato nell'app.
- [x] **Router locale deterministico**: seleziona un modello Ollama installato in base alla categoria stimata della richiesta.
- [x] **Fallback in modalità automatica**: il codice prova l'altro provider configurato quando il primo fallisce e le condizioni lo consentono.
- [ ] **Verifica end-to-end sul telefono**: non considerare i controlli di compilazione equivalenti a una prova reale di chat, rete, persistenza e gestione degli errori.
- [ ] **Immagini in ingresso**: implementazione presente nella PR #27 (`feat/image-attachments`), ma la PR è ancora aperta e in bozza; non va considerata integrata in `main` finché non viene verificata e unita.
- [ ] **Generazione/modifica immagini**: non è la stessa cosa dell'allegare un'immagine alla chat; resta un modulo distinto.

## CI e creazione APK

- [x] Il workflow `.github/workflows/build-apk.yml` è manuale (`workflow_dispatch`): i normali commit non devono creare APK.
- [x] Il workflow `.github/workflows/verify.yml` esegue `npm ci` e `npm run build` senza compilare APK, per controllare le modifiche web.
- [ ] La verifica CI del workflow separato deve concludersi con successo dopo il commit che lo introduce.
- [ ] La compilazione Android e il test sul POCO restano verifiche distinte, da eseguire quando richiesto.

## Valutazione di FreeLLMAPI

Repository esaminato: [RealTask/free-llm-api](https://github.com/RealTask/free-llm-api).

FreeLLMAPI è un progetto Python che raccoglie adapter per provider, selezione/fallback, cache, limiti di frequenza e un server API. **Non è, di per sé, un endpoint pubblico gratuito già pronto da inserire nell'app Android.** Per usarlo occorrerebbe eseguire e mantenere il suo backend, verificare dipendenze e provider reali, configurare eventuali chiavi personali e collegare Andros al server. Le quote gratuite e i modelli elencati nel suo README sono dichiarazioni del progetto e possono cambiare: non sono una garanzia di disponibilità o di uso illimitato.

Decisione tecnica:
1. Non sostituire Ollama come base locale/offline: resta il percorso senza costo per richiesta e senza invio obbligatorio di prompt a terzi.
2. Non aggiungere FreeLLMAPI come provider primario finché il backend non è installato e testato. Sarebbe una falsa integrazione e introdurrebbe un servizio di rete necessario.
3. Valutare FreeLLMAPI come **router cloud opzionale** solo dopo aver verificato su Termux l'installazione, un provider gratuito realmente accessibile, timeout, rate limit, privacy e fallback.
4. Non inserire API key nel repository, nel bundle frontend o in file committati. Le chiavi di provider cloud devono restare configurabili dall'utente; per un backend condiviso usare variabili d'ambiente.

## Checklist generale prima di dichiarare Andros pronto

- [x] Codice client Ollama presente.
- [x] Integrazione diretta Gemini presente.
- [x] Salvataggio locale delle conversazioni e regole permanenti presente nel codice.
- [x] Conferme prima della cancellazione della chat implementate in `main`.
- [ ] Build Android verificata sul commit finale e artefatto installato sul POCO.
- [ ] Test manuali: avvio senza rete, Ollama raggiungibile/non raggiungibile, Gemini con chiave valida/non valida, cambio provider e recupero errori.
- [ ] Verifica della persistenza dopo chiusura forzata e riavvio.
- [ ] Sincronizzazione cloud verificata separatamente dal salvataggio locale.
- [ ] Moduli immagini, ricerca web, traduzione a schermo e strumenti di repository verificati singolarmente: non segnare completato solo perché esiste un pulsante o una schermata.

**Regola di rilascio:** nessuna funzione viene dichiarata completata al 100% senza test riproducibile. Nessun APK viene creato in questa fase senza richiesta esplicita.
