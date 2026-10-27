const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataFile = process.env.POLL_DATA_FILE || path.join(root, "poll-data.json");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const githubToken = process.env.POLL_GITHUB_TOKEN;
const githubRepository = process.env.POLL_GITHUB_REPOSITORY || "TheNamelessEvilNamedNag/1";
const githubBranch = process.env.POLL_GITHUB_BRANCH || "main";
const githubDataPath = process.env.POLL_GITHUB_DATA_PATH || "poll-data.json";
const requireGithubStorage = process.env.POLL_REQUIRE_GITHUB_STORAGE === "true";
const allowedOrigins = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  ...(process.env.POLL_ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean)
]);
const categories = {
  meat: ["Chicken", "Beef", "Pork", "Fish", "Lamb"],
  vegetables: ["Broccoli", "Carrots", "Corn", "Potatoes", "Spinach"],
  desserts: ["Cake", "Cookies", "Ice Cream", "Pie", "Brownies"],
  animals: ["Dog", "Cat", "Lion", "Elephant", "Penguin"]
};

function emptyData() {
  return { votes: [], sessions: {}, migrations: 0 };
}

function anonymizeSessionIds(value) {
  const hash = id => /^[a-f0-9]{64}$/.test(id)
    ? id
    : crypto.createHash("sha256").update(String(id)).digest("hex");
  value.sessions = Object.fromEntries(
    Object.entries(value.sessions).map(([id, session]) => [hash(id), session])
  );
  value.votes = value.votes.map(vote => ({ ...vote, sessionId: hash(vote.sessionId) }));
  return value;
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return emptyData();
    throw error;
  }
}

let data = loadData();
let dataSha;
let operationQueue = Promise.resolve();

function githubRequest(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "api.github.com",
      path: requestPath,
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "favorite-things-poll",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {})
      }
    }, response => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        responseBody += chunk;
      });
      response.on("end", () => {
        let result;
        try {
          result = responseBody ? JSON.parse(responseBody) : {};
        } catch {
          reject(new Error("GitHub returned an invalid response."));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(result.message || `GitHub request failed (${response.statusCode}).`);
          error.status = response.statusCode;
          reject(error);
          return;
        }
        resolve(result);
      });
    });
    request.on("error", reject);
    request.end(body ? JSON.stringify(body) : undefined);
  });
}

const githubContentPath = `/repos/${githubRepository}/contents/${githubDataPath.split("/").map(encodeURIComponent).join("/")}`;

async function refreshRepositoryData() {
  try {
    const result = await githubRequest(
      "GET",
      `${githubContentPath}?ref=${encodeURIComponent(githubBranch)}`
    );
    data = anonymizeSessionIds(JSON.parse(Buffer.from(result.content, "base64").toString("utf8")));
    dataSha = result.sha;
  } catch (error) {
    if (error.status === 404) {
      data = anonymizeSessionIds(data);
      dataSha = undefined;
      return;
    }
    throw error;
  }
}

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

async function saveData() {
  if (!githubToken) return writeDurableFile();

  const result = await githubRequest("PUT", githubContentPath, {
    message: "Record poll vote",
    content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString("base64"),
    branch: githubBranch,
    ...(dataSha ? { sha: dataSha } : {})
  });
  dataSha = result.content.sha;
}

function serializeOperation(operation) {
  const result = operationQueue.then(operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function updateData(change) {
  return serializeOperation(async () => {
    if (requireGithubStorage && !githubToken) {
      throw new Error("Shared repository storage is not configured. Set POLL_GITHUB_TOKEN on the server.");
    }
    for (let attempt = 0; ; attempt += 1) {
      if (githubToken) await refreshRepositoryData();
      const result = change();
      if (!result.changed) return result.value;
      try {
        await saveData();
        return result.value;
      } catch (error) {
        if (!githubToken || ![409, 422].includes(error.status) || attempt >= 3) throw error;
      }
    }
  });
}

async function handleShutdown(signal) {
  console.log(`Received ${signal}; waiting for poll data writes to finish.`);
  await operationQueue;
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
  const headerId = req.headers["x-poll-session"];
  const cookie = (req.headers.cookie || "").split(";").find(part => part.trim().startsWith("poll_sid="));
  const existing = cookie?.split("=")[1];
  const id = headerId || existing;
  return typeof id === "string" && /^[a-zA-Z0-9_-]{24,80}$/.test(id)
    ? id
    : crypto.randomBytes(24).toString("base64url");
}

function setCookie(res, id) {
  res.setHeader("Set-Cookie", `poll_sid=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

function isSameOrigin(req, origin) {
  const protocol = req.headers["x-forwarded-proto"]?.split(",")[0].trim()
    || (req.socket.encrypted ? "https" : "http");
  try {
    return new URL(origin).origin === `${protocol}://${req.headers.host}`;
  } catch {
    return false;
  }
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
  const visitorId = sessionId(req);
  setCookie(res, visitorId);
  const id = crypto.createHash("sha256").update(visitorId).digest("hex");
  const payload = await readJson(req);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return sendJson(res, 400, { error: "Invalid vote data" });
  }
  const { category, choice, customAnswer = "" } = payload;
  if (typeof category !== "string" || !Object.hasOwn(categories, category)) {
    return sendJson(res, 400, { error: "Unknown category" });
  }
  if (typeof choice !== "string") return sendJson(res, 400, { error: "Unknown choice" });
  if (typeof customAnswer !== "string" || customAnswer.length > 40) {
    return sendJson(res, 400, { error: "Custom answer must be 40 characters or fewer" });
  }

  const isCustom = choice === "__other__";
  const label = displayChoice(choice, customAnswer);
  if (!isCustom && !categories[category].includes(choice)) return sendJson(res, 400, { error: "Unknown choice" });
  if (isCustom && !normalize(label)) return sendJson(res, 400, { error: "Custom answer is required" });

  const key = isCustom ? `__other__:${normalize(label)}` : choice;
  const response = await updateData(() => {
    const now = new Date();
    const session = data.sessions[id] ||= { answers: {}, completedAt: null, startedAt: now.toISOString() };
    const previous = session.answers[category];
    if (previous?.key === key) {
      return {
        changed: false,
        value: {
          ok: true,
          choice: previous.label,
          completed: Boolean(session.completedAt),
          totalVotes: data.votes.filter(vote => vote.category === category).length
        }
      };
    }

    if (previous) {
      const previousIndex = data.votes.findLastIndex(vote => vote.sessionId === id && vote.category === category);
      if (previousIndex >= 0) data.votes.splice(previousIndex, 1);
    }
    session.answers[category] = { key, label, updatedAt: now.toISOString() };
    data.votes.push({ sessionId: id, category, key, label, timestamp: now.toISOString() });

    if (!session.completedAt && Object.keys(categories).every(name => session.answers[name])) {
      session.completedAt = now.toISOString();
    }
    return {
      changed: true,
      value: {
        ok: true,
        choice: label,
        completed: Boolean(session.completedAt),
        totalVotes: data.votes.filter(vote => vote.category === category).length
      }
    };
  });
  sendJson(res, 200, response);
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
    if (url.pathname.startsWith("/api/")) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin) && !isSameOrigin(req, origin)) {
        return sendJson(res, 403, { error: "Origin is not allowed" });
      }
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Poll-Session");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
    }
    if (req.method === "POST" && url.pathname === "/api/vote") return await receiveVote(req, res);
    if (req.method === "GET" && url.pathname === "/api/stats") {
      const stats = await serializeOperation(async () => {
        if (requireGithubStorage && !githubToken) {
          throw new Error("Shared repository storage is not configured. Set POLL_GITHUB_TOKEN on the server.");
        }
        if (githubToken) await refreshRepositoryData();
        return statsPage();
      });
      return sendJson(res, 200, stats);
    }
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
