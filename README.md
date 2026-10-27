# Favorite Things Poll

A poll site for meat, vegetables, desserts, and animals. Votes are sent to the Node.js server, which stores the shared vote count and serves the latest results.

## Hosting

The site and API must be served by the Node.js server at the same origin. GitHub Pages can publish the static files, but it does not run the API, so votes and shared results will not work there by themselves. Do not put a GitHub token in client-side files.

By default, the server writes votes to `poll-data.json` in the project directory. For durable shared storage on hosts with an ephemeral filesystem, set `POLL_GITHUB_TOKEN` on the server and configure `POLL_GITHUB_REPOSITORY` if needed. The token must have permission to read and update `POLL_GITHUB_DATA_PATH` on `POLL_GITHUB_BRANCH`.

## Run locally

```bash
npm start
```

Then visit `http://localhost:4173`.

Each visitor can submit one answer per poll, and that answer can be changed by submitting another choice. Vote counts and results are shared across visitors. The server identifies returning visitors with a browser cookie; clearing site data starts a new voting session. Custom answers are stored along with the built-in choices.

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
