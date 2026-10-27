const pollData = {
  meat: ["Chicken", "Beef", "Pork", "Fish", "Lamb"],
  vegetables: ["Broccoli", "Carrots", "Corn", "Potatoes", "Spinach"],
  desserts: ["Cake", "Cookies", "Ice Cream", "Pie", "Brownies"],
  animals: ["Dog", "Cat", "Lion", "Elephant", "Penguin"]
};

const palette = ["#ef6a4c", "#8da86d", "#e9bd58", "#69a2b9", "#cc5b62"];
const storageKey = "favorite-things-poll";

function readAnswers() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return {};

  let state;
  try {
    state = JSON.parse(saved);
  } catch {
    throw new Error("Saved poll data is invalid. Clear this site's browser data to start over.");
  }
  if (!state || state.version !== 1 || !state.answers || typeof state.answers !== "object" || Array.isArray(state.answers)) {
    throw new Error("Saved poll data is invalid. Clear this site's browser data to start over.");
  }

  for (const [category, answer] of Object.entries(state.answers)) {
    const hasLabel = typeof answer?.label === "string";
    const knownChoice = Object.hasOwn(pollData, category) && pollData[category].includes(answer?.key);
    const customChoice = hasLabel && typeof answer.key === "string" &&
      answer.key === `__other__:${answer.label.trim().replace(/\s+/g, " ").toLocaleLowerCase()}` &&
      answer.label.trim().length > 0;
    if (!Object.hasOwn(pollData, category) || (!knownChoice && !customChoice) || !hasLabel) {
      throw new Error("Saved poll data is invalid. Clear this site's browser data to start over.");
    }
  }

  return state.answers;
}

function saveAnswers(answers) {
  localStorage.setItem(storageKey, JSON.stringify({ version: 1, answers }));
}

function setupPollPage() {
  const form = document.querySelector("[data-poll]");
  if (!form) return;

  const category = form.dataset.poll;
  const otherInput = form.querySelector(".other-answer input");
  const submitButton = form.querySelector('[type="submit"]');
  const message = form.parentElement.querySelector(".vote-message");
  let answers;
  try {
    answers = readAnswers();
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = true;
    return;
  }

  const savedAnswer = answers[category];
  if (savedAnswer) {
    const selectedInput = [...form.querySelectorAll('input[type="radio"]')]
      .find(input => input.value === savedAnswer.key || (input.value === "__other__" && savedAnswer.key.startsWith("__other__:")));
    if (selectedInput) {
      selectedInput.checked = true;
      const isOther = selectedInput.value === "__other__";
      otherInput.disabled = !isOther;
      otherInput.required = isOther;
      if (isOther) otherInput.value = savedAnswer.label;
    }
  }

  form.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener("change", () => {
      const isOther = input.value === "__other__" && input.checked;
      otherInput.disabled = !isOther;
      otherInput.required = isOther;
      if (isOther) otherInput.focus();
    });
  });

  form.addEventListener("submit", event => {
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
    const key = choice === "__other__" ? `__other__:${label.toLocaleLowerCase()}` : choice;
    const nextAnswers = { ...answers, [category]: { key, label } };
    try {
      saveAnswers(nextAnswers);
    } catch (error) {
      message.textContent = `The vote could not be saved in this browser: ${error.message}`;
      return;
    }
    answers = nextAnswers;
    message.classList.add("is-success");
    message.textContent = `Vote recorded: ${label}. Your choice can still be changed.`;
    const check = document.createElement("span");
    check.className = "confirmation-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    message.prepend(check);
  });
}

function formatPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function chartColor(index) {
  return palette[index] || `hsl(${(index * 137.508) % 360} 48% 58%)`;
}

function renderResults() {
  const legend = document.querySelector("#legend");
  const message = document.querySelector("#results-message");
  document.querySelector("#reload-page").addEventListener("click", () => {
    window.location.reload();
  });

  let answers;
  try {
    answers = readAnswers();
  } catch (error) {
    message.textContent = `Could not load saved poll data: ${error.message}`;
    return;
  }

  message.textContent = "";
  legend.replaceChildren();
  for (const category of Object.keys(pollData)) {
    const card = document.querySelector(`[data-result="${category}"]`);
    const categoryVotes = answers[category] ? [answers[category]] : [];
    const known = new Set(pollData[category]);
    const customAnswers = categoryVotes.filter(answer => answer.key.startsWith("__other__:") && !known.has(answer.key));
    const series = [
      ...pollData[category].map(option => ({
        key: option,
        label: option,
        votes: categoryVotes.filter(answer => answer.key === option).length
      })),
      ...customAnswers.map(answer => ({
        key: answer.key,
        label: answer.label,
        votes: 1
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
