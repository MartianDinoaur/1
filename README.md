# Favorite Things Poll

A poll site for meat, vegetables, desserts, and animals. Votes are sent to a Node.js API, which stores shared vote counts and serves the latest results.

## Hosting the shared poll

GitHub Pages hosts the website files, but it cannot run the API. The API must run separately. The following no-cost hobby setup uses a Render free web service and GitHub repository storage:

1. Create a GitHub fine-grained personal access token for this repository only, with **Contents: Read and write** permission. Do not paste the token into chat or commit it to the repository.
2. In Render, create a **Web Service** from this repository's `main` branch. Use build command `npm ci`, start command `npm start`, and the **Free** instance type.
3. Add these environment variables to the Render service:
   - `POLL_REQUIRE_GITHUB_STORAGE` = `true`
   - `POLL_GITHUB_TOKEN` = the token from step 1 (enter it as a secret in Render)
   - `POLL_GITHUB_REPOSITORY` = `TheNamelessEvilNamedNag/1`
   - `POLL_GITHUB_BRANCH` = `main`
   - `POLL_ALLOWED_ORIGINS` = `https://thenamelessevilnamednag.github.io`
4. Turn off automatic deploys for Git commits in Render. The API saves votes by committing `poll-data.json` to the repository; automatic API deploys on those data commits are unnecessary.
5. After Render deploys, open `https://<your-render-service>.onrender.com/api/stats` and confirm it returns JSON. In `api-config.js`, set `POLL_API_BASE_URL` to the service origin, for example `https://favorite-things-poll-api.onrender.com` (no path or trailing slash).
6. Commit and push that configuration. The GitHub Pages workflow publishes the frontend, which then sends votes to the Render API.

The GitHub token stays on Render and is never sent to website visitors. Vote data is stored in `poll-data.json` in this repository. The Render free tier sleeps when idle, so the first request after a while may take about a minute. Render documents the free tier as intended for hobby/testing rather than production; free-service limits can suspend service, so review the current [free-instance limitations](https://render.com/docs/free) before relying on it. Do not add a payment method if you want to avoid charges.

## Run locally

```bash
npm start
```

Then visit `http://localhost:4173`.

Each visitor can submit one answer per poll, and that answer can be changed by submitting another choice. Vote counts and results are shared across visitors. The browser stores a random session ID; clearing site data starts a new voting session. Custom answers are stored along with the built-in choices.

## Start automatically on Windows 10

This optional setup serves the site and API locally.

Run these commands in Windows PowerShell, after opening the project folder:

```cmd
setup-windows.cmd
```

Running this installer creates and starts autostart automatically. Install Node.js LTS from https://nodejs.org/ before running it. The installer uses standard Windows Task Scheduler commands, does not request administrator access, and does not change Windows Firewall settings.

To recreate or inspect the default-on task afterward:

```powershell
npm run autostart:on
```

This creates a per-user Windows Task Scheduler task named `FavoriteThingsPoll`. It starts after sign-in, listens on port `4173`, and restarts up to three times after a crash. You do not need to keep a terminal or browser tab open.

Stop the server and disable automatic startup:

```powershell
npm run autostart:off
```

Check the task state:

```powershell
npm run autostart:status
```

Windows may ask for your account password or permission to create a scheduled task. Keep the project folder in place and leave the computer awake and connected to the network for LAN access.
