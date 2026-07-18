# Deploy this app

## Option 1: Render (recommended, free tier)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Create the Web Service on Render

1. Go to [render.com](https://render.com) and sign in (or sign up with GitHub).
2. Click **New → Web Service**.
3. Connect your GitHub account if needed, then select the repo that contains this project.
4. Render will pick up `render.yaml` and set:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app --bind 0.0.0.0:$PORT`
5. **Do not click Create Web Service yet** — set environment variables first (step 3).

### 3. Set environment variables (required for login & multiplayer)

In the same “Create Web Service” screen, find **Environment** or **Environment Variables**.

| Key            | Value        | Notes |
|----------------|-------------|--------|
| `SECRET_KEY`   | (see below) | **Required.** Used for login sessions. |

**Generate a secret key** (pick one method):

- **Option A:** Run in terminal: `python -c "import secrets; print(secrets.token_hex(32))"` and paste the output as `SECRET_KEY`.
- **Option B:** Use any long random string (e.g. 32+ random letters/numbers). Don’t share it or commit it.

Add it in Render:

- **Key:** `SECRET_KEY`
- **Value:** the string you generated

Then click **Create Web Service**.

### 4. (Optional) Use Postgres so accounts and games persist

By default the app uses SQLite. On Render’s free tier the filesystem can reset, so accounts and games might be lost on restart. For real multiplayer across devices, use Postgres:

1. In the Render dashboard: **New → PostgreSQL**. Create a free database.
2. After it’s created, open it and copy the **Internal Database URL** (or **External** if you prefer).
3. Open your **Web Service** (the app you created).
4. Go to **Environment** and add:
   - **Key:** `DATABASE_URL`
   - **Value:** paste the database URL (starts with `postgres://` or `postgresql://`).

Save. Render will redeploy; the app will create tables in Postgres and use it instead of SQLite.

### 5. First deploy and cold start

- The first build installs dependencies and may take a few minutes.
- The first time the app runs it downloads the GloVe 50D model; the first request can be slow. After that it uses an in-memory cache.
- Word definitions come from the free [Dictionary API](https://dictionaryapi.dev/) (no API key).

### Quick checklist

- [ ] Repo pushed to GitHub  
- [ ] Web Service created and connected to that repo  
- [ ] `SECRET_KEY` set in Environment  
- [ ] (Optional) Postgres created and `DATABASE_URL` set  
- [ ] Deploy succeeded; open the app URL and try **Play Online** (register, create game, join with code)

---

## Option 2: Railway

1. Install the [Railway CLI](https://docs.railway.app/develop/cli) or use the dashboard.
2. In the project folder, run `railway init` and link a new or existing project.
3. Run `railway up` to deploy.  
   Railway will use the `Procfile`. Set the **PORT** variable in the dashboard if needed (Railway usually sets it automatically).

---

## Option 3: Run locally (production-style)

```bash
pip install -r requirements.txt
$env:PORT=5000; gunicorn app:app --bind 0.0.0.0:5000
```

On Linux/macOS: `PORT=5000 gunicorn app:app --bind 0.0.0.0:$PORT`

---

**Note:** The app uses **GloVe** for word vectors (first cold start is slow; then cached). Definitions come from the free Dictionary API (no API key).
