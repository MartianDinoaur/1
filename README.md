# Favorite Things Poll

A poll site for meat, vegetables, desserts, and animals. Votes are sent to a Node.js API, which stores shared vote counts and serves the latest results.

## Hosting the shared poll

The included [Render Blueprint](./render.yaml) deploys the complete site and API together, without a separate database or GitHub token. Render's free web service uses temporary storage: votes can be lost whenever the service sleeps, restarts, or redeploys. The Pages site can also send votes to the Render API.

To launch it, first push the repository changes to `main`, then [deploy the Render Blueprint](https://render.com/deploy?repo=https://github.com/TheNamelessEvilNamedNag/1) and authorize Render to access the repository. Applying the blueprint creates a free web service named `nameless-evil-nag-poll-1`; the configured site URL is `https://nameless-evil-nag-poll-1.onrender.com`. If Render reports that this service name is unavailable, choose another name and update `api-config.js` to its corresponding `https://<name>.onrender.com` URL before pushing.

The GitHub Pages workflow publishes the static frontend when the changes are pushed. Once the Render service finishes its initial deploy, both the Render-hosted site and Pages site can submit votes. The first request after Render has slept may take about a minute. Render describes its free tier as intended for hobby/testing rather than production, and its free services may be suspended at usage limits; see [free-instance limitations](https://render.com/docs/free). Do not add a payment method if you want to avoid charges.

## Run locally

```bash
npm start
```

Then visit `http://localhost:4173`.

Each visitor can submit one answer per poll, and that answer can be changed by submitting another choice or withdrawn with `POST /api/vote/withdraw` using the same `X-Poll-Session` ID and a JSON `category`. Vote counts and results are shared across visitors. The browser stores a random session ID; clearing site data starts a new voting session. Custom answers are stored along with the built-in choices.

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
