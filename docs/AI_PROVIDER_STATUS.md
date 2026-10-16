# Andros OS — stato verificabile dei provider AI

Aggiornato: 2026-10-16. Questo documento distingue le funzioni presenti nel codice da quelle ancora da verificare sul dispositivo.

## Provider AI: stato attuale

- [x] **Ollama**: il client Android/Web chiama l'endpoint Ollama configurato e usa il modello locale scelto. Modello predefinito nel codice: `qwen2.5-coder:7b`.
- [x] **Google Gemini**: chiamata diretta a Gemini API con chiave fornita dall'utente; la chiave è conservata nella sessione, non come segreto incorporato nell'app.
- [x] **Router locale deterministico**: seleziona un modello Ollama installato in base alla categoria stimata della richiesta. Il matching è a parole chiave normalizzate, non una comprensione semantica completa.
- [x] **Fallback in modalità automatica**: il codice prova l'altro provider configurato quando il primo fallisce e le condizioni lo consentono.
- [ ] **Verifica end-to-end sul telefono**: non considerare i controlli di compilazione equivalenti a una prova reale di chat, rete, persistenza e gestione degli errori.
- [ ] **Immagini in ingresso**: implementazione presente nella PR #27 (`feat/image-attachments`), ma la PR è ancora aperta e in bozza; non va considerata integrata in `main` finché non viene verificata e unita.
- [ ] **Generazione/modifica immagini**: non è la stessa cosa dell'allegare un'immagine alla chat; resta un modulo distinto.

## Sincronizzazione Google Drive

- [x] Il codice della sincronizzazione ora include chat attive, archivio conversazioni e regole permanenti nel file Andros su Drive.
- [x] Il merge usa gli ID e i timestamp disponibili; in caso di parità o timestamp assente privilegia la copia locale. I backup degli schemi 1 e 2 vengono letti e migrati allo schema 3 al successivo salvataggio.
- [x] Le chat eliminate generano tombstone locali persistenti e il registro viene incluso nel backup Drive; la sincronizzazione tratta la cancellazione come autoritativa per quell'ID, evitando la ricomparsa anche se un altro dispositivo conserva una copia modificata dopo l'eliminazione. Se trova più file di backup con lo stesso nome su Drive, interrompe la sincronizzazione invece di sceglierne uno arbitrariamente. È una protezione implementata nel codice, non ancora validata con due dispositivi reali.
- [x] La ricerca dei backup scorre tutte le pagine restituite da Drive. Prima di aggiornare un backup esistente, Andros confronta versione e data di modifica con i metadati più recenti e interrompe l'operazione se rileva una modifica concorrente. Questa verifica è preventiva, non atomica: non elimina completamente la finestra di gara tra controllo e scrittura.
- [x] La sincronizzazione rifiuta registri delle cancellazioni, archivi o regole locali malformati invece di interpretarli come liste vuote; così evita di avviare una sincronizzazione distruttiva quando lo stato locale non è leggibile.
- [x] Anche le chat locali e i record scaricati da Drive vengono controllati prima di preparare il nuovo backup; chat, archivio o regole incompleti causano l'interruzione anziché essere scartati silenziosamente dopo la scrittura.
- [ ] **Test reale OAuth/Drive**: non ancora verificato con un Client ID OAuth Android valido e un account Google.
- [ ] **Test delle cancellazioni tra dispositivi**: provare su due dispositivi login, sincronizzazione, eliminazione offline e sincronizzazione successiva; verificare anche conflitti e recupero da interruzioni.
- [ ] **Limiti di spazio e grandi archivi**: testare dimensioni, errori di quota e recupero dopo interruzioni prima di affidarsi alla sincronizzazione come unico backup.

## CI e creazione APK

- [x] Il workflow `.github/workflows/build-apk.yml` è manuale (`workflow_dispatch`): i normali commit non devono creare APK.
- [x] Il workflow `.github/workflows/verify.yml` esegue `npm install` e `npm run build` senza compilare APK.
- [x] Rimossi dal repository i contenuti generati `node_modules/` e `dist/` e aggiunto `.gitignore`, così le dipendenze e l'output di build non vengono versionati; la build CI ha confermato che il progetto si ricostruisce dal sorgente: [run riuscito](https://github.com/pippo2801/andros-app/actions/runs/38816474774).
- [x] Trasferimento manuale JSON collegato alle impostazioni: include chat corrente, archivio e regole; valida i pacchetti e impedisce di superare i limiti senza avvisare.
- [x] L’invio della chat conserva gli spazi iniziali e finali dei prompt (importanti per frammenti di codice), rifiutando soltanto input vuoti o composti da spazi.
- [x] La memoria permanente impedisce di aggiungere più di 500 regole e verifica il limite di 500 caratteri prima del salvataggio, allineandosi al formato di sincronizzazione.
- [x] I messaggi riservano spazio al comando Copia e mostrano un avviso accessibile se il browser non riesce a copiare il testo.
- [x] I blocchi delimitati da triple backtick vengono visualizzati in pannelli monospaziati con copia dedicata sia nell’intestazione sia in fondo al blocco; il codice viene renderizzato come testo React, senza interpretarlo come HTML.
- [x] L’archivio locale rifiuta nuove aggiunte oltre 300 conversazioni invece di scartare automaticamente quelle precedenti.
- [x] L’importazione JSON/CSV applica limiti espliciti alle conversazioni e ai messaggi; gli ZIP controllano anche il totale aggregato riconosciuto.
- [x] L’importazione delle conversazioni ChatGPT e dei formati JSON/CSV/testuali non tronca più silenziosamente messaggi troppo lunghi: segnala il limite e interrompe l'importazione, e controlla anche il numero di nodi/messaggi per conversazione.
- [x] I metadati delle conversazioni importate ora rispettano anche i limiti locali per titolo e origine, evitando che un nome lungo faccia fallire il salvataggio dell'intero archivio; build verificata: [run riuscito](https://github.com/pippo2801/andros-app/actions/runs/38817962303).
- [x] Il registro delle chat eliminate applica limiti agli ID e al numero di voci, deduplica gli ID conservando la cancellazione più recente e interrompe la sincronizzazione se il registro supera il limite, invece di perdere tombstone in silenzio.
- [x] La build web è riuscita sul commit `ba2c5902ceca53a94ff4ff06f256a60bf4d967cd`, con limiti e validazioni del registro delle cancellazioni sincronizzato: [apri il run](https://github.com/pippo2801/andros-app/actions/runs/38815862652).
- [x] La validazione dei dati sincronizzati controlla anche lunghezza degli ID/titoli, dimensioni dei messaggi archiviati e timestamp opzionali prima di preparare il backup.
- [x] La build web è riuscita sul commit `03c48182e3871b1a2fde1e04914039791bd61e27`, dopo le correzioni che impediscono di troncare silenziosamente i messaggi durante l'importazione: [apri il run](https://github.com/pippo2801/andros-app/actions/runs/38816291684).
- [ ] **Debito tecnico**: `package.json` e `package-lock.json` non sono sincronizzati. Per questo il workflow usa temporaneamente `npm install` invece di `npm ci`; la correzione definitiva del lockfile resta da fare.
- [ ] La compilazione Android e il test sul POCO restano verifiche distinte, da eseguire quando richiesto.

## Valutazione di FreeLLMAPI

Repository esaminato: [RealTask/free-llm-api](https://github.com/RealTask/free-llm-api).

FreeLLMAPI è un progetto Python che raccoglie adapter per provider, selezione/fallback, cache, limiti di frequenza e un server API. **Non è, di per sé, un endpoint pubblico gratuito già pronto da inserire nell'app Android.** Per usarlo occorrerebbe eseguire e mantenere il suo backend, verificare dipendenze e provider reali, configurare eventuali chiavi personali e collegare Andros al server. Le quote gratuite e i modelli elencati nel suo README sono dichiarazioni del progetto e possono cambiare: non sono una garanzia di disponibilità o di uso illimitato.

Decisione tecnica:
1. Non sostituire Ollama come base locale/offline: resta il percorso senza costo per richiesta e senza invio obbligatorio di prompt a terzi.
2. FreeLLMAPI è un router API, non un agente di sviluppo che modifica repository o avvia compilazioni GitHub da solo. Per far lavorare un agente sul repository serve un runtime/integrazione GitHub con permessi e credenziali; il workflow CI separato esegue i test e la build.
3. Se si intende usare Claude Code/GitHub Action, la sua integrazione ufficiale richiede l'autenticazione supportata da Anthropic (API key o token OAuth previsto dalla documentazione); un endpoint OpenAI-compatibile come FreeLLMAPI non è automaticamente intercambiabile. Non aggiungerlo come sostituto senza verificare compatibilità, autenticazione e costi/limiti reali.
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
