const pollData = {
  meat: ["Chicken", "Beef", "Pork", "Fish", "Lamb"],
  vegetables: ["Broccoli", "Carrots", "Corn", "Potatoes", "Spinach"],
  desserts: ["Cake", "Cookies", "Ice Cream", "Pie", "Brownies"],
  animals: ["Dog", "Cat", "Lion", "Elephant", "Penguin"]
};

const palette = ["#ef6a4c", "#8da86d", "#e9bd58", "#69a2b9", "#cc5b62"];

function setupPollPage() {
  const form = document.querySelector("[data-poll]");
  if (!form) return;

  const category = form.dataset.poll;
  const otherInput = form.querySelector(".other-answer input");

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
    const message = form.parentElement.querySelector(".vote-message");
    message.classList.remove("is-success");
    message.replaceChildren();
    if (!choice) {
      message.textContent = "Choose one option before casting your vote.";
      return;
    }
    const customAnswer = choice === "__other__" ? otherInput.value : "";
    if (choice === "__other__" && !customAnswer.trim()) {
      message.textContent = "Type your answer before casting your vote.";
      otherInput.focus();
      return;
    }

    let response;
    try {
      response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, choice, customAnswer })
      });
    } catch {
      message.textContent = "The vote could not be sent. Check your connection and try again.";
      return;
    }
    const payload = await response.json();
    if (!response.ok) {
      message.textContent = payload.error || "The vote could not be recorded.";
      return;
    }
    const displayChoice = payload.choice;
    const check = document.createElement("span");
    check.className = "confirmation-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    message.classList.add("is-success");
    message.append(check, ` Vote recorded: ${displayChoice}. Your choice can still be changed.`);
  });
}

function formatPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

async function resultSeries(category) {
  const response = await fetch("/api/stats");
  if (!response.ok) throw new Error("Could not load poll results");
  const stats = await response.json();
  const choices = stats.polls[category].choices;
  const known = new Set(pollData[category]);
  return [
    ...pollData[category].map(option => ({
      key: option,
      label: option,
      votes: choices.find(item => item.key === option)?.votes || 0
    })),
    ...choices.filter(item => !known.has(item.key)).map(item => ({
      key: item.key,
      label: item.label,
      votes: item.votes
    }))
  ];
}

function chartColor(index) {
  return palette[index] || `hsl(${(index * 137.508) % 360} 48% 58%)`;
}

async function renderResults() {
  const legend = document.querySelector("#legend");
  legend.replaceChildren();

  for (const category of Object.keys(pollData)) {
    const card = document.querySelector(`[data-result="${category}"]`);
    const series = await resultSeries(category);
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
    chart.setAttribute("aria-label", series.map((item, index) =>
      `${item.label}: ${formatPercent(item.votes, total)} percent`
    ).join(", "));
    card.querySelector(".total-votes").textContent = `${total} vote${total === 1 ? "" : "s"}`;

    const section = document.createElement("section");
    section.className = "legend-section";
    section.innerHTML = `<h3>${category === "meat" ? "Meat" : category.charAt(0).toUpperCase() + category.slice(1)}</h3>`;
    series.forEach((item, index) => {
      const percent = formatPercent(item.votes, total);
      section.insertAdjacentHTML("beforeend", `<div class="legend-item"><span class="legend-dot" style="background:${chartColor(index)}"></span><span>${item.label}</span><strong>${percent}%</strong></div>`);
    });
    legend.appendChild(section);
  }

  document.querySelector("#reload-page").addEventListener("click", () => {
    window.location.reload();
  });
}

setupPollPage();
if (document.body.dataset.page === "results") renderResults();
