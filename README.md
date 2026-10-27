# Favorite Things Poll

A static poll site for meat, vegetables, desserts, and animals. Votes are saved in each visitor's browser, so publishing requires no backend, token, or external service.

## Publish on GitHub Pages

For free GitHub Pages hosting, this repository needs to be public.

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Push to the `main` branch or run the **Deploy to GitHub Pages** workflow from the Actions tab.

The workflow publishes the site at `https://<owner>.github.io/<repository>/`.

## Run locally

```bash
npm start
```

Then visit `http://localhost:4173`.

Each browser can save one answer per poll, and that answer can be changed. Results are private to that browser and are not shared across visitors or devices. Clearing the browser's site data removes its saved votes. Custom answers are stored along with the built-in choices.

## Start automatically on Windows 10

This optional setup serves a local copy of the site; votes are still saved in each browser.

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
