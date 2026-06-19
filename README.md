# Soundusic

App musicale che riproduce musica da YouTube usando yt-dlp. Web + iOS.

## Setup locale

```bash
# Installa yt-dlp (se non presente)
pip install yt-dlp

# Installa dipendenze
cd server && npm install
cd web && npm install
cd ios && npm install    # Solo per iOS (richiede Expo CLI)
```

## Avvio (stabile)

```bash
# Unico comando — apre http://localhost:3001
npm start
```

Non serve Vite né altro. Il server Express serve sia le API che il frontend web già compilato nella cartella `web/dist/`.

## iOS

```bash
cd ios && npx expo start
```

## API

- `GET /api/search?q=<query>&type=all|track` — Cerca brani (artisti estratti dai brani)
- `GET /api/stream/:id` — Redirect allo streaming audio
- `GET /api/stream/url/:id` — URL diretto dello stream
- `GET /api/info/:id` — Info dettagliate sul video

## Deploy su VPS (OVH)

### 1. Connessione SSH

```bash
ssh root@<IP_VPS>
```

### 2. Installa dipendenze di sistema

```bash
apt update && apt upgrade -y
apt install -y nodejs npm python3 python3-pip ffmpeg postgresql postgresql-contrib nginx git
pip3 install yt-dlp
```

### 3. Configura PostgreSQL

```bash
# Avvia PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Crea database e utente
sudo -u postgres psql -c "CREATE USER soundusic WITH PASSWORD 'ScegliUnaPasswordFortepoiCambiala';"
sudo -u postgres psql -c "CREATE DATABASE soundusic OWNER soundusic;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE soundusic TO soundusic;"
```

### 4. Prepara l'app

```bash
cd /opt
git clone <URL_DEL_TUO_REPO> soundusic
cd soundusic

# Installa dipendenze
cd server && npm install
cd ../web && npm install
cd ..

# Crea file .env del server
cat > server/.env << EOF
DATABASE_URL=postgresql://soundusic:ScegliUnaPasswordFortepoiCambiala@localhost:5432/soundusic
PORT=3001
EOF

# Build frontend
cd web && npm run build
cd ..
```

### 5. Avvia con PM2

```bash
npm install -g pm2
pm2 start server/server.js --name soundusic -i 1 --wait-ready
pm2 save
pm2 startup   # Segui le istruzioni per abilitare l'avvio automatico
```

### 6. Configura Nginx (reverse proxy)

```bash
cat > /etc/nginx/sites-available/soundusic << 'EOF'
server {
    listen 80;
    server_name tuo-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
EOF

ln -s /etc/nginx/sites-available/soundusic /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7. (Opzionale) SSL con Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tuo-dominio.com
```

### Primo avvio

Al primo avvio il server genera automaticamente:
- **Password admin** (stampata nei log: `pm2 logs soundusic`)
- **API key** per il web-ui

Vai su `http://tuo-dominio.com/admin` per il pannello admin.
