# Architettura e piano tecnico ANDROS OS

## Principi

1. Gratuità prima di tutto: strumenti open source, modelli locali e nessun servizio a pagamento obbligatorio.
2. Nessun falso collegamento: un provider viene dichiarato connesso solo dopo una verifica reale.
3. Dati dell'utente sotto controllo: regole permanenti approvate esplicitamente, archivio locale, esportazione manuale e nessuna password di servizi terzi raccolta da Andros.
4. Moduli separati: UI, routing AI, memoria, archivio e connettori devono poter essere testati indipendentemente.

## Stato della build di test

- UI Android React/Capacitor: presente.
- Chat e cronologia locale: implementate.
- Regole permanenti approvate: implementate.
- Router deterministico dei modelli Ollama installati: implementato.
- Archivio locale importabile e ricercabile: implementato per JSON/TXT/MD/HTML/CSV.
- Google Sign-In / Drive sync: non implementato in questa build; richiede credenziali OAuth del progetto e implementazione nativa compatibile con Android.
- Connettori ChatGPT/Copilot/Gemini: non collegati alle cronologie degli account. Le esportazioni supportate possono essere importate localmente.
- Backend centrale di sincronizzazione: non presente; nessun database remoto viene creato in automatico.

## Percorso di completamento

1. Mantenere il percorso locale funzionante e verificabile.
2. Aggiungere test automatici per routing, parsing degli archivi e memoria.
3. Implementare un provider adapter per ciascun servizio solo tramite API ufficiali e condizioni compatibili con il requisito di costo zero.
4. Configurare Google Identity con il tipo di client corretto e consensi minimi; separare autenticazione (identità) da autorizzazione (Drive/backup).
5. Sincronizzare esclusivamente i dati Andros approvati in una destinazione scelta dall'utente, con cifratura e conflitti gestiti.
6. Verificare build debug, installazione su dispositivo fisico, avvio, chat, memoria, importazione, ricerca ed esportazione.

## Build Android

Il workflow `.github/workflows/build-apk.yml` compila il frontend e produce un APK debug come artefatto GitHub Actions. Una build CI riuscita dimostra la compilazione, non sostituisce il test di installazione e uso sul telefono fisico.
