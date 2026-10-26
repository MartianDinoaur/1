# Favorite Things Poll

A server-backed poll for meat, vegetables, desserts, and animals, with shared result charts and server statistics.

**Windows 10 download:** [Download FavoriteThingsPoll-Windows.zip](https://github.com/TheNamelessEvilNamedNag/1/raw/main/downloads/FavoriteThingsPoll-Windows.zip)

## Run

```bash
npm install
npm start
```

Then visit `http://localhost:4173`. Other devices on the same network can visit `http://<computer-ip>:4173`; for example, this computer is `10.0.1.129`. The server binds to all network interfaces. Each poll includes an Other option. Custom answers are normalized and grouped regardless of capitalization, while the first spelling is retained in the chart legend.

The API reports today, 7-day, this-month, this-year, and overall completions, with separate submission totals for every poll. “Completed form” means one browser session has answered all four polls.

Data is stored in `poll-data.json`. Set `POLL_DATA_FILE` to place it elsewhere and keep the file on persistent storage so poll totals survive restarts. Every accepted vote is written atomically and synced before the browser receives confirmation, including a filesystem sync to preserve it across process or host restarts. Render's configured disk mount provides this persistence.
## Start automatically on Windows 10

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
