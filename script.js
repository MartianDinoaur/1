const pollData = {
  meat: ["Chicken", "Beef", "Pork", "Fish", "Lamb"],
  vegetables: ["Broccoli", "Carrots", "Corn", "Potatoes", "Spinach"],
  desserts: ["Cake", "Cookies", "Ice Cream", "Pie", "Brownies"],
  animals: ["Dog", "Cat", "Lion", "Elephant", "Penguin"]
};

const palette = ["#ef6a4c", "#8da86d", "#e9bd58", "#69a2b9", "#cc5b62"];
const apiBaseUrl = (window.POLL_API_URL || "").replace(/\/+$/, "");

function apiEndpoint(path) {
  if (!apiBaseUrl && window.location.hostname.endsWith(".github.io")) {
    throw new Error("The shared poll service is not configured. Set the POLL_API_URL repository variable and redeploy.");
  }
  return `${apiBaseUrl}${path}`;
}

async function apiRequest(path, options = {}) {
  const url = apiEndpoint(path);
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("Could not reach the poll server. Check your connection and try again.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The poll server returned an invalid response. Try again shortly.");
  }
  if (!response.ok) throw new Error(result.error || `The poll server returned an error (${response.status}).`);
  return result;
}

function getSessionId() {
  const sessionKey = "favorite-things-poll-session";
  let id = localStorage.getItem(sessionKey);
  if (!id) {
    id = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(sessionKey, id);
  }
  return id;
}

function setupPollPage() {
  const form = document.querySelector("[data-poll]");
  if (!form) return;

  const category = form.dataset.poll;
  const otherInput = form.querySelector(".other-answer input");
  const submitButton = form.querySelector('[type="submit"]');
  const message = form.parentElement.querySelector(".vote-message");

  form.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener("change", () => {
      const isOther = input.value === "__other__" && input.checked;
      otherInput.disabled = !isOther;
      otherInput.required = isOther;
      if (isOther) otherInput.focus();
    });
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const choice = new FormData(form).get(category);
    message.classList.remove("is-success");
    message.replaceChildren();
    if (!choice) {
      message.textContent = "Choose one option before casting your vote.";
      return;
    }

    const customAnswer = choice === "__other__" ? otherInput.value.trim().replace(/\s+/g, " ") : "";
    if (choice === "__other__" && !customAnswer) {
      message.textContent = "Type your answer before casting your vote.";
      otherInput.focus();
      return;
    }

    submitButton.disabled = true;
    try {
      await apiRequest("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Session": getSessionId()
        },
        body: JSON.stringify({ category, choice, customAnswer })
      });
      message.classList.add("is-success");
      message.textContent = `Vote recorded: ${customAnswer || choice}. Your choice can still be changed.`;
      const check = document.createElement("span");
      check.className = "confirmation-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      message.prepend(check);
    } catch (error) {
      message.textContent = `Your vote was not saved: ${error.message}`;
    } finally {
      submitButton.disabled = false;
    }
  });
}

function formatPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function chartColor(index) {
  return palette[index] || `hsl(${(index * 137.508) % 360} 48% 58%)`;
}

async function renderResults() {
  const legend = document.querySelector("#legend");
  const message = document.querySelector("#results-message");
  document.querySelector("#reload-page").addEventListener("click", () => {
    window.location.reload();
  });

  let stats;
  try {
    stats = await apiRequest("/api/stats");
  } catch (error) {
    message.textContent = `Could not load shared poll results: ${error.message}`;
    return;
  }

  message.textContent = "";
  legend.replaceChildren();
  for (const category of Object.keys(pollData)) {
    const card = document.querySelector(`[data-result="${category}"]`);
    const choices = stats.polls[category].choices;
    const choiceByKey = new Map(choices.map(choice => [choice.key, choice]));
    const known = new Set(pollData[category]);
    const series = [
      ...pollData[category].map(option => ({
        key: option,
        label: option,
        votes: choiceByKey.get(option)?.votes || 0
      })),
      ...choices.filter(choice => !known.has(choice.key)).map(choice => ({
        key: choice.key,
        label: choice.label,
        votes: choice.votes
      }))
    ];
    const total = series.reduce((sum, item) => sum + item.votes, 0);
    const chart = card.querySelector(".pie-chart");

    let cursor = 0;
    const stops = series.map((item, index) => {
      const start = cursor;
      cursor += total ? (item.votes / total) * 100 : 20;
      return `${chartColor(index)} ${start}% ${cursor}%`;
    });
    chart.style.background = total
      ? `conic-gradient(${stops.join(",")})`
      : "conic-gradient(#dedbd0 0 100%)";
    chart.setAttribute("aria-label", series.map(item =>
      `${item.label}: ${formatPercent(item.votes, total)} percent`
    ).join(", "));
    card.querySelector(".total-votes").textContent = `${total} vote${total === 1 ? "" : "s"}`;

    const section = document.createElement("section");
    section.className = "legend-section";
    const heading = document.createElement("h3");
    heading.textContent = category === "meat" ? "Meat" : category.charAt(0).toUpperCase() + category.slice(1);
    section.appendChild(heading);
    series.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "legend-item";
      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.background = chartColor(index);
      const label = document.createElement("span");
      label.textContent = item.label;
      const percentage = document.createElement("strong");
      percentage.textContent = `${formatPercent(item.votes, total)}%`;
      row.append(dot, label, percentage);
      section.appendChild(row);
    });
    legend.appendChild(section);
  }
}

setupPollPage();
if (document.body.dataset.page === "results") renderResults();
