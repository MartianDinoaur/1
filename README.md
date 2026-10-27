# Favorite Things Poll

A poll site for meat, vegetables, desserts, and animals. Votes are sent to a Node.js API, which stores shared vote counts and serves the latest results.

## Hosting the shared poll

The [Render Blueprint](./render.yaml) deploys the Node.js site and poll API. The Pages site is a separate static frontend; both frontends send votes to the Render API. To keep shared votes and accumulated server uptime across Render restarts, the API needs permission to write its data file to this GitHub repository.

### Deploy and enable persistent data

1. Push the project to the `main` branch of [MartianDinoaur/1](https://github.com/MartianDinoaur/1).
2. Deploy the [Render Blueprint](https://render.com/deploy?repo=https://github.com/MartianDinoaur/1). Sign in to Render, connect the GitHub repository if prompted, and apply the blueprint. The blueprint configures the service to use branch `main` and repository file `poll-data.json`. It also asks for the `POLL_GITHUB_TOKEN` environment variable; you can create the token in the next steps before completing setup.
3. Create a GitHub fine-grained personal access token from [GitHub's token creation page](https://github.com/settings/personal-access-tokens/new). Give it a descriptive name such as `Render favorite poll`, choose an expiration that you can maintain, and set **Resource owner** to the account that owns this repository.
4. Under **Repository access**, choose **Only select repositories**, then select `MartianDinoaur/1`. Under **Repository permissions**, set **Contents** to **Read and write**. No other repository permissions are needed. See GitHub's [fine-grained token instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) and [permission reference](https://docs.github.com/en/rest/overview/permissions-required-for-fine-grained-personal-access-tokens) if the settings look different.
5. Generate the token and copy it while GitHub shows it. Treat it like a password: do not put it in `server.js`, `api-config.js`, a commit, or a chat message.
6. In Render, open the service's **Environment** settings (or enter the value in the blueprint form), add `POLL_GITHUB_TOKEN`, paste the token as its value, and save. Render may restart/redeploy the service to apply the change. See Render's [environment variable documentation](https://render.com/docs/configure-environment-variables). The token belongs only in Render's server-side environment, never in the browser or GitHub Pages settings.
7. Wait for the service to finish deploying. Its default address is [martiandinoaur-favorite-poll.onrender.com](https://martiandinoaur-favorite-poll.onrender.com). If the chosen Render service has a different name, update `window.POLL_API_BASE_URL` in [api-config.js](./api-config.js) to that service's HTTPS origin and push the change so GitHub Pages uses the right API.

### What gets saved and how to verify it

Vote changes are written to the configured data file as they happen. Every ten minutes, the server also checkpoints the poll data and accumulated uptime to `poll-data.json` on the `main` branch; a clean server shutdown triggers a final checkpoint too. After a restart, the API loads that saved data before it starts accepting requests, so votes and saved uptime are available again. Uptime is cumulative server running time: it continues from the last checkpoint, but does not count time while the Render service is stopped or asleep. An abrupt stop may lose up to ten minutes of uptime since the most recent checkpoint.

To check persistence, cast a test vote, then open the repository's [`poll-data.json`](https://github.com/MartianDinoaur/1/blob/main/poll-data.json) after a vote or the next ten-minute checkpoint. GitHub should show a commit updating the file. The file may not exist until the first successful save. To check the service, open the [Render dashboard](https://dashboard.render.com/), select the poll service, and review its **Events** and **Logs** for a successful deploy and any GitHub API errors. If saves fail, confirm that the token has not expired or been revoked, it is authorized for `MartianDinoaur/1` with **Contents: Read and write**, and `POLL_GITHUB_TOKEN` is saved in the service environment; then redeploy/restart the service.

Without a valid token, the app falls back to `POLL_DATA_FILE`, which the blueprint places at `/tmp/poll-data.json`. Render's temporary filesystem can be lost on restart, so this fallback is not persistent storage. The frontend displays uptime from `/api/uptime`, refreshes it when the page loads and once per minute while open, and Render uses that endpoint for its health check.

GitHub Pages publishes the static frontend when frontend files are pushed. The first request to a sleeping free Render service may take about a minute. See Render's [free-instance limitations](https://render.com/docs/free); free services can sleep or be suspended at usage limits.

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
