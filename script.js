const pollData = {
  meat: ["Chicken", "Beef", "Pork", "Fish", "Lamb"],
  vegetables: ["Broccoli", "Carrots", "Corn", "Potatoes", "Spinach"],
  desserts: ["Cake", "Cookies", "Ice Cream", "Pie", "Brownies"],
  animals: ["Dog", "Cat", "Lion", "Elephant", "Penguin"]
};

const palette = ["#ef6a4c", "#8da86d", "#e9bd58", "#69a2b9", "#cc5b62"];

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The poll server returned an invalid response.");
  }
  if (!response.ok) throw new Error(result.error || `The poll server returned an error (${response.status}).`);
  return result;
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

    const customAnswer = choice === "__other__" ? otherInput.value : "";
    if (choice === "__other__" && !customAnswer.trim()) {
      message.textContent = "Type your answer before casting your vote.";
      otherInput.focus();
      return;
    }

    const label = choice === "__other__" ? customAnswer.trim().replace(/\s+/g, " ") : choice;
    submitButton.disabled = true;
    try {
      const result = await requestJson("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, choice, customAnswer })
      });
      if (result.ok !== true || typeof result.totalVotes !== "number") {
        throw new Error("The poll server did not confirm the vote.");
      }
      message.classList.add("is-success");
      message.textContent = `Vote recorded: ${label}. This poll now has ${result.totalVotes} vote${result.totalVotes === 1 ? "" : "s"}.`;
      const check = document.createElement("span");
      check.className = "confirmation-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      message.prepend(check);
    } catch (error) {
      message.textContent = `The vote could not be recorded: ${error.message}`;
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

  try {
    const stats = await requestJson("/api/stats");
    if (!stats.polls || typeof stats.polls !== "object") {
      throw new Error("The poll server returned incomplete results.");
    }

    message.textContent = "";
    legend.replaceChildren();
    for (const category of Object.keys(pollData)) {
      const card = document.querySelector(`[data-result="${category}"]`);
      const categoryStats = stats.polls[category];
      if (!categoryStats || !Array.isArray(categoryStats.choices)) {
        throw new Error(`The poll server returned incomplete results for ${category}.`);
      }
      const known = new Set(pollData[category]);
      const choices = new Map(categoryStats.choices.map(item => [item.key, item]));
      const series = [
        ...pollData[category].map(option => ({
          key: option,
          label: option,
          votes: choices.get(option)?.votes || 0
        })),
        ...categoryStats.choices.filter(item => !known.has(item.key)).map(item => ({
          key: item.key,
          label: item.label,
          votes: item.votes
        }))
      ];
      const total = categoryStats.overall;
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
  } catch (error) {
    message.textContent = `Could not load poll results: ${error.message}`;
  }
}

setupPollPage();
if (document.body.dataset.page === "results") renderResults();
