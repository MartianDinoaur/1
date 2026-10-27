# Favorite Things Poll

A shared poll site for meat, vegetables, desserts, and animals. Votes are saved in this repository and results are visible to all visitors.

## Publish on GitHub Pages

For free GitHub Pages hosting, this repository needs to be public.

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Deploy the `render.yaml` web service on Render. Create a GitHub fine-grained personal access token with **Contents: read and write** permission for this repository, then set it as the Render `POLL_GITHUB_TOKEN` secret. Do not put this token in the site or a GitHub Pages variable.
4. Copy the Render service URL (for example, `https://favorite-things-poll.onrender.com`) into the repository's **Settings → Secrets and variables → Actions → Variables** as `POLL_API_URL`.
5. Push to the `main` branch or run the **Deploy to GitHub Pages** workflow from the Actions tab.

The workflow publishes the site at `https://<owner>.github.io/<repository>/`.
The Render service allows requests from this repository's GitHub Pages origin. If you use a custom Pages domain, update `POLL_ALLOWED_ORIGINS` in Render to match that site's origin.

## Run locally

```bash
npm start
```

Then visit `http://localhost:4173`.

Each browser can save one answer per poll, and that answer can be changed. Votes are committed to `poll-data.json` in this repository; results show the shared totals. A browser session identifier is stored locally so a visitor can change their vote. Custom answers are normalized and grouped.

## Start automatically on Windows 10

This optional setup serves a local copy of the site. Without the GitHub token configured, local votes are stored in `poll-data.json` on that computer.

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
