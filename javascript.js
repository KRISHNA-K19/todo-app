// === DOM Elements ===
const taskInput = document.getElementById("taskInput");
const deadlineInput = document.getElementById("deadlineInput");
const priorityInput = document.getElementById("priorityInput");
const categoryInput = document.getElementById("categoryInput");
const categorySuggestions = document.getElementById("categorySuggestions");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filterBtn");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const taskCount = document.getElementById("taskCount");
const quoteBox = document.getElementById("quoteBox");
const darkModeToggle = document.getElementById("darkModeToggle");
const achievementMessage = document.getElementById("achievementMessage");

// Pomodoro Timer Elements
const timerDisplay = document.getElementById("timerDisplay");
const startTimerBtn = document.getElementById("startTimer");
const pauseTimerBtn = document.getElementById("pauseTimer");
const resetTimerBtn = document.getElementById("resetTimer");
const timerModeSelect = document.getElementById("timerMode");

// === State ===
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let filter = "all";
let uniqueCategories = new Set(); // For category suggestions

// Pomodoro Timer State
let timerInterval;
let timeLeft;
let currentMode = "work"; // work, shortBreak, longBreak
const TIME_MODES = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};
let isTimerRunning = false;

// === Save to LocalStorage ===
function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  updateCategorySuggestions(); // Update suggestions whenever tasks change
}

// === Render Tasks ===
function renderTasks() {
  taskList.innerHTML = "";
  let filtered = [...tasks]; // Create a shallow copy to avoid modifying original array during filtering

  // Apply search filter
  const searchText = searchInput.value.toLowerCase();
  filtered = filtered.filter(t => t.text.toLowerCase().includes(searchText) || (t.category && t.category.toLowerCase().includes(searchText)));

  // Apply status filter
  if (filter === "active") {
    filtered = filtered.filter(t => !t.completed);
  } else if (filter === "done") {
    filtered = filtered.filter(t => t.completed);
  } else if (filter === "today") {
    const today = new Date().toDateString();
    filtered = filtered.filter(t => !t.completed && t.deadline && new Date(t.deadline).toDateString() === today);
  } else if (filter === "overdue") {
    const now = new Date();
    filtered = filtered.filter(t => !t.completed && t.deadline && new Date(t.deadline) < now);
  }

  // Sort tasks: Overdue first, then High priority, then by deadline
  filtered.sort((a, b) => {
    const now = new Date();
    const aOverdue = a.deadline && new Date(a.deadline) < now && !a.completed;
    const bOverdue = b.deadline && new Date(b.deadline) < now && !b.completed;

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const priorityOrder = { "high": 1, "medium": 2, "low": 3 };
    if (priorityOrder[a.priority] < priorityOrder[b.priority]) return -1;
    if (priorityOrder[a.priority] > priorityOrder[b.priority]) return 1;

    if (a.deadline && b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });


  filtered.forEach(task => {
    const li = document.createElement("li");
    li.className = "flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-lg shadow transition-colors duration-300 animate-fade-in"; // Added animation class

    const now = new Date();
    const isOverdue = task.deadline && new Date(task.deadline) < now && !task.completed;

    let deadlineText = "";
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      deadlineText = `
        <span class="text-xs ${isOverdue ? 'overdue' : 'text-gray-600 dark:text-gray-400'} ml-2">
          Due: ${deadlineDate.toLocaleString()}
        </span>`;
    }

    const priorityColor = {
      high: "text-red-500 dark:text-red-400",
      medium: "text-yellow-600 dark:text-yellow-400",
      low: "text-green-600 dark:text-green-400",
    };

    li.innerHTML = `
      <div class="flex flex-col mb-2 sm:mb-0">
        <span class="text-lg font-medium ${task.completed ? "line-through text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"} ${isOverdue ? 'overdue' : ''}">
          ${task.text}
        </span>
        <div class="flex items-center text-sm mt-1">
          ${task.category ? `<span class="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full mr-2">${task.category}</span>` : ''}
          <span class="${priorityColor[task.priority]} font-semibold mr-2">${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority</span>
          ${deadlineText}
        </div>
      </div>
      <div class="flex space-x-2 mt-2 sm:mt-0">
        <button class="toggleComplete bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition">
          ${task.completed ? "Undo" : "Done"}
        </button>
        <button class="deleteTask bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition">Delete</button>
      </div>
    `;

    // Complete/Undo
    li.querySelector(".toggleComplete").addEventListener("click", () => {
      const taskIndex = tasks.indexOf(task); // Find the original task object
      if (taskIndex > -1) {
        tasks[taskIndex].completed = !tasks[taskIndex].completed;
        saveTasks();
        renderTasks();
        checkAchievements(); // Check for achievements on task completion
      }
    });

    // Delete
    li.querySelector(".deleteTask").addEventListener("click", () => {
      const taskIndex = tasks.indexOf(task); // Find the original task object
      if (taskIndex > -1) {
        tasks.splice(taskIndex, 1);
        saveTasks();
        renderTasks();
        checkAchievements();
      }
    });

    taskList.appendChild(li);
  });

  updateProgress();
}

// === Add Task ===
function addTask() {
  const text = taskInput.value.trim();
  const deadline = deadlineInput.value;
  const priority = priorityInput.value;
  const category = categoryInput.value.trim();

  if (!text) {
    taskInput.classList.add('border-red-500'); // Visual cue for empty task
    setTimeout(() => taskInput.classList.remove('border-red-500'), 1500);
    return;
  }

  tasks.push({ text, completed: false, deadline, priority, category });
  saveTasks();
  renderTasks();
  taskInput.value = "";
  deadlineInput.value = "";
  priorityInput.value = "medium"; // Reset to default
  categoryInput.value = "";

  fetchQuote(); // new quote for motivation
  checkAchievements(); // Check achievements after adding a task
}

// === Update Category Suggestions ===
function updateCategorySuggestions() {
  uniqueCategories.clear();
  tasks.forEach(task => {
    if (task.category) {
      uniqueCategories.add(task.category);
    }
  });

  categorySuggestions.innerHTML = "";
  uniqueCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    categorySuggestions.appendChild(option);
  });
}

// === Progress Bar Update ===
function updateProgress() {
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  progressBar.style.width = percent + "%";
  progressText.textContent = `${percent}% completed`;
  taskCount.textContent = `${total} tasks`;
}

// === Fetch Motivational Quote ===
async function fetchQuote() {
  try {
    const res = await fetch("https://api.quotable.io/random?tags=motivational|inspirational");
    const data = await res.json();
    quoteBox.textContent = `💡 ${data.content}`;
  } catch {
    quoteBox.textContent = "💡 Keep pushing forward!";
  }
}

// === Dark Mode Toggle ===
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  const isDarkMode = document.body.classList.contains("dark-mode");
  localStorage.setItem("darkMode", isDarkMode);
  darkModeToggle.textContent = isDarkMode ? "🌙" : "🌞"; // Change icon
}

// Apply dark mode on load
if (localStorage.getItem("darkMode") === "true") {
  toggleDarkMode();
}

// === Pomodoro Timer Functions ===
function updateTimerDisplay() {
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

function startTimer() {
  if (isTimerRunning) return;
  isTimerRunning = true;
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      isTimerRunning = false;
      // Play a sound for timer completion (creative aspect!)
      new Audio('https://www.soundjay.com/buttons/beep-07.wav').play(); 
      alert(`${currentMode === 'work' ? 'Time for a break!' : 'Break over, back to work!'} 🎉`);
      // Optionally switch mode automatically
      if (currentMode === 'work') {
        timerModeSelect.value = 'shortBreak';
        switchTimerMode();
      } else {
        timerModeSelect.value = 'work';
        switchTimerMode();
      }
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  isTimerRunning = false;
}

function resetTimer() {
  pauseTimer();
  switchTimerMode(currentMode); // Reset to current mode's default time
}

function switchTimerMode() {
  currentMode = timerModeSelect.value;
  timeLeft = TIME_MODES[currentMode];
  updateTimerDisplay();
  pauseTimer(); // Pause timer when switching mode
}

// === Gamification/Achievements ===
function checkAchievements() {
  const completedTasks = tasks.filter(t => t.completed).length;
  let message = "";

  if (completedTasks === 0) {
    message = ""; // Reset message if no tasks completed
  } else if (completedTasks === 1) {
    message = "First task completed! Great start! ⭐";
  } else if (completedTasks === 5) {
    message = "You've completed 5 tasks! Keep up the momentum! ✨";
  } else if (completedTasks === 10) {
    message = "Double digits! 10 tasks crushed! 🚀";
  } else if (completedTasks % 5 === 0 && completedTasks > 0) { // Every 5 tasks after the initial ones
    message = `Awesome! You've completed ${completedTasks} tasks! 🎉`;
  }

  if (message) {
    achievementMessage.textContent = message;
    achievementMessage.classList.remove('hidden');
    // Hide message after a few seconds
    setTimeout(() => {
      achievementMessage.classList.add('hidden');
    }, 5000);
  } else {
    achievementMessage.classList.add('hidden');
  }
}

// === Event Listeners ===
addTaskBtn.addEventListener("click", addTask);
taskInput.addEventListener("keypress", e => {
  if (e.key === "Enter") addTask();
});
searchInput.addEventListener("input", renderTasks);
filterBtns.forEach(btn =>
  btn.addEventListener("click", () => {
    // Remove active styling from all buttons
    filterBtns.forEach(b => {
      b.classList.remove('bg-indigo-500', 'hover:bg-indigo-600', 'text-white');
      b.classList.add('bg-gray-200', 'dark:bg-gray-600', 'hover:bg-indigo-300', 'dark:hover:bg-indigo-500', 'text-gray-700', 'dark:text-gray-200');
    });

    // Add active styling to the clicked button
    btn.classList.add('bg-indigo-500', 'hover:bg-indigo-600', 'text-white');
    btn.classList.remove('bg-gray-200', 'dark:bg-gray-600', 'hover:bg-indigo-300', 'dark:hover:bg-indigo-500', 'text-gray-700', 'dark:text-gray-200');

    filter = btn.dataset.filter;
    renderTasks();
  })
);
darkModeToggle.addEventListener("click", toggleDarkMode);

// Pomodoro Timer Event Listeners
startTimerBtn.addEventListener("click", startTimer);
pauseTimerBtn.addEventListener("click", pauseTimer);
resetTimerBtn.addEventListener("click", resetTimer);
timerModeSelect.addEventListener("change", switchTimerMode);


// === Initial Load ===
renderTasks();
fetchQuote();
updateCategorySuggestions();
// Set initial timer state
timeLeft = TIME_MODES[currentMode];
updateTimerDisplay();

// Select the 'All' filter button by default and apply its active style
document.querySelector('.filterBtn[data-filter="all"]').click();