# Andros OS — audit dei moduli open source e piano Android

Aggiornato: 11 ottobre 2026. Questa nota guida l'integrazione: non significa che i progetti citati siano stati copiati o che le loro funzioni siano già presenti in Andros.

## Decisione architetturale

Andros Android resta un'app Capacitor/React con servizi nativi Kotlin. Non sostituire l'app con un secondo prodotto completo: si perderebbero la memoria, l'archivio, il traduttore e il flusso di sincronizzazione manuale già esistenti. Riutilizzare moduli piccoli e contratti compatibili, mantenendo Android indipendente da Windows.

## Progetti esaminati

| Progetto | Licenza dichiarata | Parti da studiare/adattare | Cosa non copiare alla cieca |
|---|---|---|---|
| [Open Jarvis](https://github.com/tokenarc/open-jarvis) | MIT | Agent loop, piani d'azione, lettura accessibile, esecuzione separata, memoria e interfaccia con Termux | Il suo runtime Android completo; prima confrontare package, permessi, protocollo e codice di sicurezza con Andros |
| [Lucy Screen Agent](https://github.com/alzin/lucy-screen-agent) | MIT | Ciclo osserva → pianifica → azione → verifica, riferimenti semantici ai nodi invece di tocchi a coordinate, arresto immediato | Invia screenshot e albero Accessibilità a Gemini durante i task: è un flusso cloud e può esporre dati sullo schermo |
| [Vesta](https://github.com/RisorseArtificiali/vesta) | MIT (dichiarata nel repository) | LLM locale GGUF, memoria locale, tool schema, conferme per azioni sensibili, RAG documentale | La sua app Expo/React Native e i moduli llama.rn non sono plug-and-play dentro Capacitor |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | MIT | Inferenza locale e server OpenAI-compatible per modelli GGUF | Non presumere che ogni quantizzazione o modello sia abbastanza veloce o entri nella RAM del telefono |

Le licenze sopra sono quelle dichiarate nei repository consultati; prima di incorporare file sorgente, controllare il file LICENSE e conservare gli avvisi richiesti. La scelta preferita è adattare i principi e integrare codice solo quando è compatibile, necessario e verificato.

## Modifica già applicata in questo ramo

Le impostazioni del motore locale ora distinguono due protocolli:

- **Ollama**: endpoint /api/tags e /api/chat, predefinito http://127.0.0.1:11434.
- **llama.cpp server**: endpoint /v1/models e /v1/chat/completions, predefinito http://127.0.0.1:8080.

Le impostazioni restano locali al dispositivo. I vecchi salvataggi sono compatibili: se non hanno il campo runtime, vengono letti come Ollama. Il router non passa automaticamente a un provider cloud. Questa modifica è un adattatore di protocollo: **non installa llama.cpp, non scarica GGUF e non garantisce che un modello sia già avviato sul telefono**.

### Prova locale di llama.cpp

Se llama-server è stato compilato/installato in Termux e hai un modello GGUF compatibile con la RAM disponibile, il server locale può essere avviato con un comando simile:

    llama-server -m /percorso/al/modello.gguf --host 127.0.0.1 --port 8080

Il percorso va sostituito con quello reale del modello. Non usare un modello enorme solo perché è disponibile: il telefono può terminare il processo per mancanza di memoria o rispondere troppo lentamente. Dopo l'avvio, seleziona **llama.cpp server** in Andros e premi **Verifica**. Se il server non è installato, questo comando non funzionerà finché non si installano/compilano le dipendenze.

## Piano d'integrazione Android, in ordine

1. **Stabilizzare il motore locale**: build web, test delle risposte dei due protocolli, timeout, errori comprensibili, scelta del modello rilevato. Misurare RAM, tempi e consumo sul POCO prima di scegliere il GGUF predefinito.
2. **Agente con strumenti tipizzati**: portare dal pattern Open Jarvis un registro di strumenti con schema stretto; niente eval, shell libera o comandi eseguiti direttamente dal testo del modello.
3. **Automazione Accessibilità**: ispirarsi a Lucy, usando ID semantici dei nodi, verifica dello stato dopo ogni azione, limiti di passi, STOP globale e conferma prima di invii, acquisti, cancellazioni o pubblicazioni.
4. **Termux bridge**: processo locale autenticato, comandi allowlist, cartella di lavoro dedicata, limiti di tempo/output e anteprima delle modifiche; nessuna shell illimitata esposta alla UI web.
5. **Esclusione app finanziarie**: blocco fail-closed lato nativo, rilevazione del package prima di leggere o agire e test con package noti. Una lista euristica non può garantire il riconoscimento di ogni banca: mantenere sempre un comando STOP e non eseguire azioni se l'identificazione è incerta.
6. **Identità vocale**: separare STT da speaker verification. La trascrizione Android attuale non autentica la persona; non autorizzare azioni sensibili sulla sola voce trascritta.
7. **Memoria e RAG**: apprendimento solo da procedure approvate, niente memorizzazione automatica di password, codici, dati bancari o token; importazione documenti locale e citazioni delle fonti recuperate.
8. **Test sul dispositivo reale**: Android/HyperOS, permessi revocati, rotazione, riavvio, memoria esaurita, app protetta in primo piano, STOP durante l'azione, assenza di rete e modello mancante.

## Criteri di accettazione

- Nessun requisito di PC acceso per le funzioni dichiarate offline.
- Nessun invio a servizi cloud senza scelta esplicita dell'utente.
- Nessuna azione automatica su app bancarie/pagamento.
- Ogni azione che modifica o invia dati ha anteprima/conferma e risultato verificabile.
- STOP interrompe l'agente tra i passaggi e il servizio persistente è visibile quando serve.
- Build e test devono essere verdi prima di dichiarare una funzione completata.
- Non creare un APK finché l'utente non lo richiede esplicitamente.
