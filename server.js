const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataFile = process.env.POLL_DATA_FILE || path.join(root, "poll-data.json");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const categories = {
  meat: ["Chicken", "Beef", "Pork", "Fish", "Lamb"],
  vegetables: ["Broccoli", "Carrots", "Corn", "Potatoes", "Spinach"],
  desserts: ["Cake", "Cookies", "Ice Cream", "Pie", "Brownies"],
  animals: ["Dog", "Cat", "Lion", "Elephant", "Penguin"]
};

function emptyData() {
  return { votes: [], sessions: {}, migrations: 0 };
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return emptyData();
  }
}

let data = loadData();
let writeQueue = Promise.resolve();
async function writeDurableFile() {
  await fs.promises.mkdir(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp-${process.pid}-${Date.now()}`;
  const handle = await fs.promises.open(temporaryFile, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(data));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.promises.rename(temporaryFile, dataFile);
  const directory = await fs.promises.open(path.dirname(dataFile), "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

function saveData() {
  writeQueue = writeQueue.then(writeDurableFile);
  return writeQueue;
}

async function handleShutdown(signal) {
  console.log(`Received ${signal}; waiting for poll data writes to finish.`);
  await writeQueue.catch(error => console.error("Could not flush poll data:", error));
  server.close(() => process.exit(0));
}

function normalize(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function displayChoice(choice, customAnswer) {
  if (choice === "__other__") return customAnswer.trim().replace(/\s+/g, " ");
  return choice;
}

function sessionId(req) {
  const cookie = (req.headers.cookie || "").split(";").find(part => part.trim().startsWith("poll_sid="));
  const existing = cookie?.split("=")[1];
  return existing && /^[a-zA-Z0-9_-]{24,80}$/.test(existing) ? existing : crypto.randomBytes(24).toString("base64url");
}

function setCookie(res, id) {
  res.setHeader("Set-Cookie", `poll_sid=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request too large");
  }
  return body ? JSON.parse(body) : {};
}

async function receiveVote(req, res) {
  const id = sessionId(req);
  setCookie(res, id);
  const { category, choice, customAnswer = "" } = await readJson(req);
  if (!Object.hasOwn(categories, category)) return sendJson(res, 400, { error: "Unknown category" });

  const isCustom = choice === "__other__";
  const label = displayChoice(choice, customAnswer);
  if (!isCustom && !categories[category].includes(choice)) return sendJson(res, 400, { error: "Unknown choice" });
  if (isCustom && !normalize(label)) return sendJson(res, 400, { error: "Custom answer is required" });

  const key = isCustom ? `__other__:${normalize(label)}` : choice;
  const now = new Date();
  const session = data.sessions[id] ||= { answers: {}, completedAt: null, startedAt: now.toISOString() };
  const previous = session.answers[category];
  if (previous?.key === key) return sendJson(res, 200, { ok: true, choice: previous.label });

  if (previous) {
    const previousIndex = data.votes.findLastIndex(vote => vote.sessionId === id && vote.category === category);
    if (previousIndex >= 0) data.votes.splice(previousIndex, 1);
  }
  session.answers[category] = { key, label, updatedAt: now.toISOString() };
  data.votes.push({ sessionId: id, category, key, label, timestamp: now.toISOString() });

  if (!session.completedAt && Object.keys(categories).every(name => session.answers[name])) {
    session.completedAt = now.toISOString();
  }
  await saveData();
  sendJson(res, 200, { ok: true, choice: label, completed: Boolean(session.completedAt) });
}

function isAfter(timestamp, start) {
  return new Date(timestamp) >= start;
}

function completionStats(now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(week.getDate() - 6);
  const month = new Date(today); month.setDate(1);
  const year = new Date(today.getFullYear(), 0, 1);
  const sessions = Object.values(data.sessions);

  const count = start => sessions.filter(session => session.completedAt && isAfter(session.completedAt, start)).length;
  return {
    today: count(today),
    week: count(week),
    month: count(month),
    year: count(year),
    overall: sessions.filter(session => session.completedAt).length
  };
}

function pollStats(now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(week.getDate() - 6);
  const month = new Date(today); month.setDate(1);
  const year = new Date(today.getFullYear(), 0, 1);
  const result = {};

  for (const category of Object.keys(categories)) {
    const entries = data.votes.filter(vote => vote.category === category);
    const count = start => entries.filter(vote => isAfter(vote.timestamp, start)).length;
    const choices = entries.reduce((choicesByKey, vote) => {
      const current = choicesByKey.get(vote.key) || { key: vote.key, label: vote.label, votes: 0 };
      current.votes += 1;
      choicesByKey.set(vote.key, current);
      return choicesByKey;
    }, new Map());
    result[category] = {
      today: count(today), week: count(week), month: count(month), year: count(year), overall: entries.length,
      choices: [...choices.values()].sort((a, b) => b.votes - a.votes)
    };
  }
  return result;
}

function sevenMonthChart(now = new Date()) {
  const monthLabels = [];
  const values = [];
  for (let offset = 6; offset >= 0; offset--) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    monthLabels.push(start.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }));
    values.push(Object.values(data.sessions).filter(session => {
      if (!session.completedAt) return false;
      const completed = new Date(session.completedAt);
      return completed >= start && completed < end;
    }).length);
  }
  return { labels: monthLabels, values };
}

function statsPage(now = new Date()) {
  return { completed: completionStats(now), polls: pollStats(now), chart: sevenMonthChart(now) };
}

const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };
async function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || path.basename(file).startsWith(".")) return false;
  try {
    const body = await fs.promises.readFile(file);
    res.writeHead(200, { "Content-Type": `${mime[path.extname(file)] || "application/octet-stream"}; charset=utf-8` });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST" && url.pathname === "/api/vote") return await receiveVote(req, res);
    if (req.method === "GET" && url.pathname === "/api/stats") return sendJson(res, 200, statsPage());
    if (await serveStatic(req, res)) return;
    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, error instanceof SyntaxError ? 400 : 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Favorite Things running at http://${host}:${port}`);
});

process.once("SIGTERM", () => handleShutdown("SIGTERM"));
process.once("SIGINT", () => handleShutdown("SIGINT"));
