# 📘 GUIDA DEPLOYMENT ORDERFLOW PRO
## Vercel + Upstash Redis - Passo dopo Passo

---

## 🎯 COSA OTTERRAI

✅ App OrderFlow online 24/7
✅ Database cloud sicuro
✅ URL pubblico (es: orderflow-pro.vercel.app)
✅ Totalmente GRATIS (per uso normale)
✅ Backup automatici
✅ SSL/HTTPS incluso

---

## 📋 PREREQUISITI

Prima di iniziare, assicurati di avere:

1. ✅ **Node.js installato** (versione 18+)
   - Scarica da: https://nodejs.org
   - Verifica: apri terminale → `node --version`

2. ✅ **Account GitHub** (opzionale ma consigliato)
   - Registrati su: https://github.com

3. ✅ **File del progetto**
   - Estrai `orderflow-vercel.zip` in una cartella

---

## 🚀 PASSO 1: SETUP UPSTASH REDIS

### 1.1 Crea Account Upstash

1. Vai su: **https://upstash.com**
2. Clicca **"Sign Up"**
3. Registrati con:
   - Email
   - Oppure GitHub (consigliato)

### 1.2 Crea Database Redis

1. Dopo il login, clicca **"Create Database"**

2. Compila il form:
   ```
   Name: orderflow-db
   Type: Regional
   Region: eu-west-1 (o la più vicina a te)
   Primary Region: (lascia default)
   Read Region: (opzionale)
   TLS: ✅ Enabled (lascia attivo)
   Eviction: ❌ Disabled
   ```

3. Clicca **"Create"**

### 1.3 Ottieni Credenziali

1. Nella dashboard del database, vai sul tab **"REST API"**
   
2. Vedrai due valori:
   ```
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   ```

3. **COPIA ENTRAMBI** (li userai dopo)
   - Clicca sulle icone 📋 per copiarli

---

## 🚀 PASSO 2: SETUP LOCALE

### 2.1 Apri Terminale

**Windows:**
- Premi `Win + R`
- Digita `cmd` → Enter

**Mac:**
- Premi `Cmd + Space`
- Digita `terminal` → Enter

**Linux:**
- `Ctrl + Alt + T`

### 2.2 Vai nella Cartella del Progetto

```bash
# Esempio Windows:
cd C:\Users\TuoNome\Desktop\orderflow-vercel

# Esempio Mac/Linux:
cd ~/Desktop/orderflow-vercel
```

### 2.3 Installa Dipendenze

```bash
npm install
```

Aspetta che finisca (circa 1-2 minuti)

### 2.4 Configura Variabili d'Ambiente

1. **Crea file `.env.local`**:

**Windows:**
```bash
copy .env.example .env.local
notepad .env.local
```

**Mac/Linux:**
```bash
cp .env.example .env.local
nano .env.local
```

2. **Modifica il file** inserendo le credenziali Upstash:

```env
UPSTASH_REDIS_REST_URL=https://YOUR-DB-NAME.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaaaAAaaAaAAAaaaAAA...
```

3. **Salva e chiudi**:
   - Windows: `Ctrl+S` → Chiudi
   - Mac/Linux: `Ctrl+O` → Enter → `Ctrl+X`

---

## 🚀 PASSO 3: TEST LOCALE (Opzionale)

Prima del deploy, testa in locale:

```bash
npm install -g vercel
vercel dev
```

Apri browser: **http://localhost:3000**

Se funziona, premi `Ctrl+C` per fermare.

---

## 🚀 PASSO 4: DEPLOY SU VERCEL

### 4.1 Login Vercel

```bash
vercel login
```

Ti chiederà come autenticarti:
```
? Log in to Vercel 
❯ Continue with GitHub
  Continue with GitLab  
  Continue with Email
```

Scegli **GitHub** (consigliato) o **Email**

Il browser si aprirà → Autorizza

### 4.2 Deploy Progetto

```bash
vercel
```

Rispondi alle domande:

```
? Set up and deploy "~/orderflow-vercel"? [Y/n]
→ Premi Y

? Which scope do you want to deploy to?
→ Scegli il tuo account

? Link to existing project? [y/N]
→ Premi N

? What's your project's name?
→ orderflow-pro (o quello che vuoi)

? In which directory is your code located?
→ ./  (premi Enter)

? Want to override the settings? [y/N]
→ Premi N
```

**Aspetta il deploy** (30-60 secondi)

Vedrai:
```
✅ Deployed to production
🔗 https://orderflow-pro.vercel.app
```

**COPIA QUESTO URL!**

---

## 🚀 PASSO 5: CONFIGURA VARIABILI SU VERCEL

### 5.1 Vai su Dashboard

1. Apri: **https://vercel.com/dashboard**
2. Trova il progetto **"orderflow-pro"**
3. Cliccaci sopra

### 5.2 Aggiungi Variabili d'Ambiente

1. Clicca **"Settings"** (in alto)
2. Nel menu laterale: **"Environment Variables"**
3. Clicca **"Add"**

**Prima variabile:**
```
Key: UPSTASH_REDIS_REST_URL
Value: [INCOLLA URL DA UPSTASH]
Environments: ✅ Production ✅ Preview ✅ Development
```
Clicca **Save**

**Seconda variabile:**
```
Key: UPSTASH_REDIS_REST_TOKEN
Value: [INCOLLA TOKEN DA UPSTASH]
Environments: ✅ Production ✅ Preview ✅ Development
```
Clicca **Save**

### 5.3 Redeploy con Variabili

Torna al terminale:

```bash
vercel --prod
```

Aspetta il redeploy.

---

## 🚀 PASSO 6: INIZIALIZZA DATABASE

### 6.1 Vai all'URL di Inizializzazione

Apri browser:
```
https://orderflow-pro.vercel.app/api/init
```
(Sostituisci con il TUO URL)

Dovresti vedere:
```json
{
  "success": true,
  "message": "Database inizializzato con successo",
  "info": {
    "admin": "Creato (username: admin, password: admin123)"
  }
}
```

**✅ DATABASE PRONTO!**

---

## 🚀 PASSO 7: ACCEDI ALL'APP

### 7.1 Apri App

```
https://orderflow-pro.vercel.app
```

### 7.2 Login Iniziale

```
Username: admin
Password: admin123
```

### 7.3 CAMBIA PASSWORD ADMIN

**IMPORTANTE!**

1. Clicca sull'icona **👥 Utenti** (in alto a destra)
2. Trova "admin" → Clicca icona **🔑**
3. Inserisci nuova password sicura
4. Salva

---

## 🎉 COMPLETO!

L'app è online e funzionante!

**URL pubblico:** https://orderflow-pro.vercel.app

---

## 📊 COSA MONITORARE

### Upstash Dashboard
- Vai su: https://console.upstash.com
- Monitora:
  - Storage usato
  - Numero richieste
  - Latenza

### Vercel Dashboard
- Vai su: https://vercel.com/dashboard
- Monitora:
  - Visite
  - Performance
  - Errori

---

## 🔄 AGGIORNAMENTI FUTURI

Quando modifichi il codice:

```bash
# 1. Salva modifiche

# 2. Testa in locale
vercel dev

# 3. Deploy produzione
vercel --prod
```

---

## 🆘 RISOLUZIONE PROBLEMI

### Errore: "Cannot connect to Redis"

**Soluzione:**
1. Verifica variabili ambiente su Vercel
2. Controlla che database Upstash sia attivo
3. Redeploy: `vercel --prod`

### App mostra pagina bianca

**Soluzione:**
1. Apri F12 → Console
2. Cerca errori
3. Verifica URL API: `/api/init`
4. Controlla log: `vercel logs`

### Dati non si salvano

**Soluzione:**
1. F12 → Network → Cerca chiamate API
2. Verifica che ritornino 200 OK
3. Controlla dashboard Upstash

### "User admin already exists"

**Normale!** 
- Database già inizializzato
- Puoi procedere al login

---

## 📞 SUPPORTO

**Problemi tecnici?**

1. Controlla log:
```bash
vercel logs --follow
```

2. Verifica variabili:
   - Vercel Settings → Environment Variables

3. Testa API manualmente:
   - https://your-app.vercel.app/api/init

**Tutto ok?**

✅ Inizia a usare OrderFlow Pro!

---

## 💡 TIPS

1. **Backup Regolari**
   - Usa "Esporta Backup" dall'app
   - Salva il JSON in sicurezza

2. **Performance**
   - Upstash è velocissimo (< 50ms)
   - Vercel CDN globale

3. **Sicurezza**
   - HTTPS automatico
   - Database crittografato
   - Log di tutte le azioni

4. **Costi**
   - Free tier generoso
   - Upgrade solo se necessario

---

## 🎯 PROSSIMI PASSI

1. ✅ Crea altri utenti (Gestione Utenti)
2. ✅ Importa ordini da Google Sheets
3. ✅ Personalizza articoli e kit
4. ✅ Esplora tutte le funzionalità!

**Buon lavoro con OrderFlow Pro! 🚀**
