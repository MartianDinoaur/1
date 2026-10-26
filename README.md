# Favorite Things Poll

A server-backed poll for meat, vegetables, desserts, and animals, with shared result charts and server statistics.

## Run

```bash
npm install
npm start
```

Then visit `http://localhost:4173`. Other devices on the same network can visit `http://<computer-ip>:4173`; for example, this computer is `10.0.1.129`. The server binds to all network interfaces. Each poll includes an Other option. Custom answers are normalized and grouped regardless of capitalization, while the first spelling is retained in the chart legend.

The API reports today, 7-day, this-month, this-year, and overall completions, with separate submission totals for every poll. “Completed form” means one browser session has answered all four polls.

Data is stored in `poll-data.json`. Set `POLL_DATA_FILE` to place it elsewhere and keep the file on persistent storage so poll totals survive restarts. Every accepted vote is written atomically and synced before the browser receives confirmation, including a filesystem sync to preserve it across process or host restarts. Render's configured disk mount provides this persistence.
