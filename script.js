// Firebase imports
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

// Data Storage - now using Firebase
let tasks = []
let projects = []
let stakeholders = []
let followups = []
let currentEditingTask = null
let currentEditingProject = null
let currentEditingStakeholder = null
let currentEditingFollowup = null
let currentViewingTask = null
let currentViewingProject = null
let currentViewingStakeholder = null
let currentFollowupStakeholder = null

// Add these variables after the existing ones
let subtasks = []
let currentEditingSubtask = null
let currentSubtaskParent = null
let currentProjectTab = "all"

// Add these variables after the existing ones
let knowledgeEntries = []
let currentEditingKnowledge = null
let currentViewingKnowledge = null
let currentKnowledgeTab = "all"

// Loading state management
function showLoading() {
  document.getElementById("loadingOverlay").classList.remove("hidden")
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden")
}

function showError(message) {
  const errorDiv = document.createElement("div")
  errorDiv.className = "error-message"
  errorDiv.innerHTML = `<strong>Error:</strong> ${message}`
  document.body.appendChild(errorDiv)

  setTimeout(() => {
    errorDiv.remove()
  }, 5000)
}

function showSuccess(message) {
  const successDiv = document.createElement("div")
  successDiv.className = "success-message"
  successDiv.innerHTML = `<strong>Success:</strong> ${message}`
  document.body.appendChild(successDiv)

  setTimeout(() => {
    successDiv.remove()
  }, 3000)
}

// Firebase helper functions
async function saveToFirebase(collectionName, data, docId = null) {
  try {
    showLoading()

    if (docId) {
      // Update existing document
      const docRef = doc(window.db, collectionName, docId)
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      })
      return docId
    } else {
      // Create new document
      const docRef = await addDoc(collection(window.db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return docRef.id
    }
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error)
    showError(`Failed to save ${collectionName.slice(0, -1)}. Please try again.`)
    throw error
  } finally {
    hideLoading()
  }
}

async function deleteFromFirebase(collectionName, docId) {
  try {
    showLoading()
    await deleteDoc(doc(window.db, collectionName, docId))
    showSuccess(`${collectionName.slice(0, -1)} deleted successfully`)
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error)
    showError(`Failed to delete ${collectionName.slice(0, -1)}. Please try again.`)
    throw error
  } finally {
    hideLoading()
  }
}

async function loadFromFirebase(collectionName) {
  try {
    const querySnapshot = await getDocs(query(collection(window.db, collectionName), orderBy("createdAt", "desc")))

    const data = []
    querySnapshot.forEach((doc) => {
      const docData = doc.data()
      data.push({
        id: doc.id,
        ...docData,
        // Convert Firestore timestamps to ISO strings for compatibility
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })
    })

    return data
  } catch (error) {
    console.error(`Error loading ${collectionName}:`, error)
    showError(`Failed to load ${collectionName}. Please check your connection.`)
    return []
  }
}

// Initialize the app
document.addEventListener("DOMContentLoaded", async () => {
  try {
    showLoading()

    // Wait for Firebase to be available
    while (!window.db) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Load all data from Firebase
    await Promise.all([
      loadAllProjects(),
      loadAllTasks(),
      loadAllStakeholders(),
      loadAllFollowups(),
      loadAllSubtasks(),
      loadAllKnowledge(),
    ])

    updateCounts()
    populateProjectSelects()
    populateStakeholderSelects()
    populateKnowledgeSelects()

    // Set up real-time listeners
    setupRealtimeListeners()
  } catch (error) {
    console.error("Error initializing app:", error)
    showError("Failed to initialize the application. Please refresh the page.")
  } finally {
    hideLoading()
  }
})

// Current active task tab
let currentTaskTab = "today"
let draggedTask = null

// Initialize the unified task interface
function initializeTaskInterface() {
  updateCurrentDate()
  loadUnifiedTasks()
  populateProjectFilter()
  setupDragAndDrop()
}

// Update current date display
function updateCurrentDate() {
  const now = new Date()
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }
  document.getElementById("current-date").textContent = now.toLocaleDateString("en-US", options)
}

// Switch task tabs
function switchTaskTab(tabName) {
  currentTaskTab = tabName

  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

  // Load tasks for the selected tab
  loadUnifiedTasks()
}

// Load tasks for the unified interface
function loadUnifiedTasks() {
  const container = document.getElementById("task-list")
  const filteredTasks = getFilteredTasks()

  updateTabCounts()

  if (filteredTasks.length === 0) {
    container.innerHTML = createEmptyState()
    return
  }

  container.innerHTML = filteredTasks.map((task) => createUnifiedTaskCard(task)).join("")
  setupDragAndDrop()
}

// Get filtered tasks based on current tab and filters
function getFilteredTasks() {
  let filteredTasks = [...tasks]

  // Filter by tab
  switch (currentTaskTab) {
    case "today":
      filteredTasks = filteredTasks.filter(
        (task) => (task.isToday || isToday(task.dueDate)) && task.status !== "completed",
      )
      break
    case "backlog":
      filteredTasks = filteredTasks.filter(
        (task) => !task.isToday && !isToday(task.dueDate) && task.status !== "completed" && !isOverdue(task.dueDate),
      )
      break
    case "completed":
      filteredTasks = filteredTasks.filter((task) => task.status === "completed")
      break
    case "overdue":
      filteredTasks = filteredTasks.filter((task) => isOverdue(task.dueDate) && task.status !== "completed")
      break
  }

  // Apply additional filters
  const priorityFilter = document.getElementById("priority-filter").value
  const projectFilter = document.getElementById("project-filter").value
  const searchFilter = document.getElementById("search-filter").value.toLowerCase()

  if (priorityFilter) {
    filteredTasks = filteredTasks.filter((task) => task.priority === priorityFilter)
  }

  if (projectFilter) {
    filteredTasks = filteredTasks.filter((task) => task.projectId === projectFilter)
  }

  if (searchFilter) {
    filteredTasks = filteredTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchFilter) ||
        (task.description && task.description.toLowerCase().includes(searchFilter)),
    )
  }

  // Sort tasks by custom order if available, then by due date
  return filteredTasks.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order
    }
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate) - new Date(b.dueDate)
    }
    return 0
  })
}

// Create unified task card
function createUnifiedTaskCard(task) {
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null
  const stakeholder = task.stakeholderId ? stakeholders.find((s) => s.id === task.stakeholderId) : null
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const dueDateClass = getDueDateClass(task.dueDate)
  const dueDateText = getDueDateText(task.dueDate)
  const taskSubtasks = subtasks.filter((s) => s.parentTaskId === task.id)
  const completedSubtasks = taskSubtasks.filter((s) => s.status === "completed").length

  return `
    <div class="task-card-unified ${dueDateClass}" data-task-id="${task.id}" draggable="true">
      <div class="task-card-header">
        <div>
          <div class="task-card-title">${task.title}</div>
          ${project ? `<div class="task-card-project"><i class="fas fa-folder"></i> ${project.name}</div>` : ""}
        </div>
        <div class="task-card-meta">
          <span class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
          <div class="status-change">
            <span class="task-status status-${task.status}" onclick="toggleUniversalStatusDropdown(event, 'task', '${task.id}')" style="cursor: pointer;">
              ${task.status.replace("-", " ").toUpperCase()} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.25rem;"></i>
            </span>
            <div class="universal-status-dropdown">
              ${["todo", "in-progress", "completed"]
                .filter((status) => status !== task.status)
                .map(
                  (status) =>
                    `<div class="universal-status-option" onclick="changeItemStatus('task', '${task.id}', '${status}')">
                      <i class="fas fa-circle"></i>
                      ${status.replace("-", " ").toUpperCase()}
                    </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
      
      ${task.description ? `<div class="task-card-description">${truncateText(task.description, 120)}</div>` : ""}
      
      ${
        taskSubtasks.length > 0
          ? `
        <div class="subtasks-section">
          <h4 onclick="toggleSubtasks(this)">
            <i class="fas fa-list"></i> Subtasks (${completedSubtasks}/${taskSubtasks.length})
            <i class="fas fa-chevron-down" style="margin-left: auto;"></i>
          </h4>
          <div class="subtasks-list">
            ${taskSubtasks
              .slice(0, 3)
              .map(
                (subtask) => `
              <div class="subtask-item priority-${subtask.priority} ${subtask.status === "completed" ? "completed" : ""}">
                <div class="subtask-header">
                  <span class="subtask-title">${subtask.title}</span>
                  <div class="status-change">
                    <span class="task-status status-${subtask.status}" onclick="toggleUniversalStatusDropdown(event, 'subtask', '${subtask.id}')" style="cursor: pointer;">
                      ${subtask.status.replace("-", " ").toUpperCase()}
                    </span>
                    <div class="universal-status-dropdown">
                      ${["todo", "in-progress", "completed"]
                        .filter((status) => status !== subtask.status)
                        .map(
                          (status) =>
                            `<div class="universal-status-option" onclick="changeItemStatus('subtask', '${subtask.id}', '${status}')">
                              <i class="fas fa-circle"></i>
                              ${status.replace("-", " ").toUpperCase()}
                            </div>`,
                        )
                        .join("")}
                    </div>
                  </div>
                </div>
              </div>
            `,
              )
              .join("")}
            ${taskSubtasks.length > 3 ? `<div style="text-align: center; margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-text-secondary);">+${taskSubtasks.length - 3} more subtasks</div>` : ""}
          </div>
        </div>
      `
          : ""
      }
      
      <div class="task-card-footer">
        <div style="display: flex; align-items: center; gap: 1rem;">
          ${
            dueDateText
              ? `<div class="task-card-due ${isOverdue(task.dueDate) ? "overdue" : isToday(task.dueDate) ? "today" : ""}">
            <i class="fas fa-calendar"></i> ${dueDateText}
          </div>`
              : ""
          }
          ${
            stakeholder
              ? `<div class="task-assignees">
            <div class="assignee-avatar" title="${stakeholder.name}">${stakeholder.name.charAt(0).toUpperCase()}</div>
          </div>`
              : ""
          }
        </div>
        
        <div class="task-card-actions">
          <button class="btn-add-subtask" onclick="addSubtaskToTask('${task.id}')">
            <i class="fas fa-plus"></i> Subtask
          </button>
          <button class="btn-view" onclick="viewTaskDetails('${task.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-edit" onclick="editTask('${task.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete" onclick="deleteTask('${task.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `
}

// Get due date class for color coding
function getDueDateClass(dueDate) {
  if (!dueDate) return "due-future"

  const today = new Date()
  const due = new Date(dueDate)
  const diffTime = due - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "due-overdue"
  if (diffDays === 0) return "due-today"
  if (diffDays === 1) return "due-tomorrow"
  if (diffDays <= 7) return "due-this-week"
  return "due-future"
}

// Get due date text
function getDueDateText(dueDate) {
  if (!dueDate) return ""

  const today = new Date()
  const due = new Date(dueDate)
  const diffTime = due - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`
  if (diffDays === 0) return "Due today"
  if (diffDays === 1) return "Due tomorrow"
  if (diffDays <= 7) return `Due in ${diffDays} days`
  return due.toLocaleDateString()
}

// Check if date is overdue
function isOverdue(dueDate) {
  if (!dueDate) return false
  const today = new Date()
  const due = new Date(dueDate)
  return due < today && !isToday(dueDate)
}

// Update tab counts
function updateTabCounts() {
  const todayTasks = tasks.filter((task) => (task.isToday || isToday(task.dueDate)) && task.status !== "completed")
  const backlogTasks = tasks.filter(
    (task) => !task.isToday && !isToday(task.dueDate) && task.status !== "completed" && !isOverdue(task.dueDate),
  )
  const completedTasks = tasks.filter((task) => task.status === "completed")
  const overdueTasks = tasks.filter((task) => isOverdue(task.dueDate) && task.status !== "completed")

  const todayTabElement = document.getElementById("today-tab-count")
  const backlogTabElement = document.getElementById("backlog-tab-count")
  const completedTabElement = document.getElementById("completed-tab-count")
  const overdueTabElement = document.getElementById("overdue-tab-count")

  if (todayTabElement) todayTabElement.textContent = todayTasks.length
  if (backlogTabElement) backlogTabElement.textContent = backlogTasks.length
  if (completedTabElement) completedTabElement.textContent = completedTasks.length
  if (overdueTabElement) overdueTabElement.textContent = overdueTasks.length
}

// Populate project filter
function populateProjectFilter() {
  const projectFilter = document.getElementById("project-filter")
  if (projectFilter) {
    projectFilter.innerHTML = '<option value="">All Projects</option>'
    projects.forEach((project) => {
      const option = document.createElement("option")
      option.value = project.id
      option.textContent = project.name
      projectFilter.appendChild(option)
    })
  }
}

// Filter and load tasks
function filterAndLoadTasks() {
  loadUnifiedTasks()
}

// Create empty state
function createEmptyState() {
  const messages = {
    today: "No tasks scheduled for today",
    backlog: "No tasks in backlog",
    completed: "No completed tasks yet",
    overdue: "No overdue tasks",
  }

  return `
    <div class="task-empty-state">
      <i class="fas fa-tasks"></i>
      <p>${messages[currentTaskTab]}</p>
      <button class="btn btn-primary" onclick="openModal('taskModal')">Add New Task</button>
    </div>
  `
}

// Setup drag and drop functionality
function setupDragAndDrop() {
  const taskCards = document.querySelectorAll(".task-card-unified")
  const taskList = document.getElementById("task-list")

  taskCards.forEach((card) => {
    card.addEventListener("dragstart", handleDragStart)
    card.addEventListener("dragend", handleDragEnd)
  })

  taskList.addEventListener("dragover", handleDragOver)
  taskList.addEventListener("drop", handleDrop)
}

// Drag and drop handlers
function handleDragStart(e) {
  draggedTask = e.target
  e.target.classList.add("dragging")
  e.dataTransfer.effectAllowed = "move"
  e.dataTransfer.setData("text/html", e.target.outerHTML)
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging")
  draggedTask = null
}

function handleDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = "move"

  const afterElement = getDragAfterElement(e.clientY)
  const taskList = document.getElementById("task-list")

  if (afterElement == null) {
    taskList.appendChild(draggedTask)
  } else {
    taskList.insertBefore(draggedTask, afterElement)
  }
}

function handleDrop(e) {
  e.preventDefault()
  updateTaskOrder()
}

// Get element after drag position
function getDragAfterElement(y) {
  const taskList = document.getElementById("task-list")
  const draggableElements = [...taskList.querySelectorAll(".task-card-unified:not(.dragging)")]

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child }
      } else {
        return closest
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element
}

// Update task order after drag and drop
async function updateTaskOrder() {
  const taskCards = document.querySelectorAll(".task-card-unified")
  const updates = []

  taskCards.forEach((card, index) => {
    const taskId = card.dataset.taskId
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.order !== index) {
      updates.push(saveToFirebase("tasks", { order: index }, taskId))
    }
  })

  try {
    await Promise.all(updates)
  } catch (error) {
    console.error("Error updating task order:", error)
  }
}

// Real-time listeners
function setupRealtimeListeners() {
  // Listen for tasks changes
  onSnapshot(collection(window.db, "tasks"), (snapshot) => {
    tasks = []
    snapshot.forEach((doc) => {
      const docData = doc.data()
      tasks.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString(),
      })
    })

    // Refresh unified task interface if it's active
    if (document.getElementById("tasks-section").classList.contains("active")) {
      loadUnifiedTasks()
    }

    // Keep existing functionality
    loadTasks()
    updateCounts()
  })

  // Listen for projects changes
  onSnapshot(collection(window.db, "projects"), (snapshot) => {
    projects = []
    snapshot.forEach((doc) => {
      const docData = doc.data()
      projects.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString(),
      })
    })
    loadProjectsWithFilters()
    updateCounts()
    populateProjectSelects()
  })

  // Listen for stakeholders changes
  onSnapshot(collection(window.db, "stakeholders"), (snapshot) => {
    stakeholders = []
    snapshot.forEach((doc) => {
      const docData = doc.data()
      stakeholders.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString(),
      })
    })
    loadStakeholders()
    updateCounts()
    populateStakeholderSelects()
  })

  // Listen for followups changes
  onSnapshot(collection(window.db, "followups"), (snapshot) => {
    followups = []
    snapshot.forEach((doc) => {
      const docData = doc.data()
      followups.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString(),
      })
    })
    loadStakeholders() // Reload stakeholders to update followup counts
  })

  // Listen for subtasks changes
  onSnapshot(collection(window.db, "subtasks"), (snapshot) => {
    subtasks = []
    snapshot.forEach((doc) => {
      const docData = doc.data()
      subtasks.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString(),
      })
    })

    // Refresh task interface if active
    if (document.getElementById("tasks-section").classList.contains("active")) {
      loadUnifiedTasks()
    }
  })

  // Listen for knowledge changes
  onSnapshot(collection(window.db, "knowledge"), (snapshot) => {
    knowledgeEntries = []
    snapshot.forEach((doc) => {
      const docData = doc.data()
      knowledgeEntries.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: docData.updatedAt?.toDate?.()?.toISOString(),
      })
    })

    // Refresh knowledge interface if active
    if (document.getElementById("knowledge-section").classList.contains("active")) {
      loadKnowledgeWithFilters()
    }
  })
}

// Load functions
async function loadAllTasks() {
  tasks = await loadFromFirebase("tasks")
}

async function loadAllProjects() {
  projects = await loadFromFirebase("projects")
}

async function loadAllStakeholders() {
  stakeholders = await loadFromFirebase("stakeholders")
}

async function loadAllFollowups() {
  followups = await loadFromFirebase("followups")
}

// Add loadAllSubtasks function
async function loadAllSubtasks() {
  subtasks = await loadFromFirebase("subtasks")
}

// Knowledge Base functions
async function loadAllKnowledge() {
  knowledgeEntries = await loadFromFirebase("knowledge")
}

// Tab switching
function switchTab(tabName) {
  // Remove active class from all tabs and sections
  document.querySelectorAll(".nav-item").forEach((tab) => tab.classList.remove("active"))
  document.querySelectorAll(".content-section").forEach((section) => section.classList.remove("active"))

  // Add active class to selected tab and section
  document.querySelector(`.nav-item[onclick="switchTab('${tabName}')"]`).classList.add("active")

  if (tabName === "tasks") {
    document.getElementById("tasks-section").classList.add("active")
    initializeTaskInterface()
  } else if (tabName === "projects") {
    document.getElementById("projects-section").classList.add("active")
    loadProjectsWithFilters()
  } else if (tabName === "stakeholders") {
    document.getElementById("stakeholders-section").classList.add("active")
    loadStakeholders()
  } else if (tabName === "knowledge") {
    document.getElementById("knowledge-section").classList.add("active")
    loadKnowledgeWithFilters()
  }
}

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active")
  if (modalId === "taskModal") {
    populateProjectSelects()
    populateStakeholderSelects()
    if (!currentEditingTask) {
      document.getElementById("taskForm").reset()
      document.getElementById("task-modal-title").textContent = "Add New Task"
      document.getElementById("task-attachments-list").innerHTML = ""
    }
  } else if (modalId === "projectModal") {
    populateParentProjectSelect()
    populateStakeholderSelects()
    if (!currentEditingProject) {
      document.getElementById("projectForm").reset()
      document.getElementById("project-modal-title").textContent = "Add New Project"
      document.getElementById("project-attachments-list").innerHTML = ""
    }
  } else if (modalId === "stakeholderModal") {
    if (!currentEditingStakeholder) {
      document.getElementById("stakeholderForm").reset()
      document.getElementById("stakeholder-modal-title").textContent = "Add New Stakeholder"
    }
  } else if (modalId === "followupModal") {
    if (!currentEditingFollowup) {
      document.getElementById("followupForm").reset()
      document.getElementById("followup-modal-title").textContent = "Add New Followup"
    }
  } else if (modalId === "subtaskModal") {
    if (!currentEditingSubtask) {
      document.getElementById("subtaskForm").reset()
      document.getElementById("subtask-modal-title").textContent = "Add Subtask"
    }
  } else if (modalId === "knowledgeModal") {
    populateKnowledgeSelects()
    if (!currentEditingKnowledge) {
      document.getElementById("knowledgeForm").reset()
      document.getElementById("knowledge-modal-title").textContent = "Add New Knowledge Entry"
      document.getElementById("knowledge-attachments-list").innerHTML = ""
    }
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active")
  if (modalId === "taskModal") {
    currentEditingTask = null
  } else if (modalId === "projectModal") {
    currentEditingProject = null
  } else if (modalId === "stakeholderModal") {
    currentEditingStakeholder = null
  } else if (modalId === "followupModal") {
    currentEditingFollowup = null
    currentFollowupStakeholder = null
  } else if (modalId === "subtaskModal") {
    currentEditingSubtask = null
    currentSubtaskParent = null
  } else if (modalId === "knowledgeModal") {
    currentEditingKnowledge = null
  }
}

// Task functions
async function saveTask(event) {
  event.preventDefault()

  try {
    const taskAttachmentsList = document.getElementById("task-attachments-list")
    const attachments = []

    // Get all attachment items
    taskAttachmentsList.querySelectorAll(".attachment-item").forEach((item) => {
      attachments.push({
        type: item.dataset.type,
        value: item.dataset.value,
        name: item.dataset.name,
      })
    })

    const taskData = {
      title: document.getElementById("task-title").value,
      description: document.getElementById("task-description").value,
      priority: document.getElementById("task-priority").value,
      status: document.getElementById("task-status").value,
      dueDate: document.getElementById("task-due-date").value,
      projectId: document.getElementById("task-project").value || null,
      stakeholderId: document.getElementById("task-stakeholder").value || null,
      isToday: document.getElementById("task-today").checked,
      attachments: attachments,
    }

    if (currentEditingTask) {
      await saveToFirebase("tasks", taskData, currentEditingTask.id)
      showSuccess("Task updated successfully")
    } else {
      await saveToFirebase("tasks", taskData)
      showSuccess("Task created successfully")
    }

    closeModal("taskModal")
  } catch (error) {
    console.error("Error saving task:", error)
  }
}

function editTask(taskId) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return

  currentEditingTask = task

  document.getElementById("task-title").value = task.title
  document.getElementById("task-description").value = task.description
  document.getElementById("task-priority").value = task.priority
  document.getElementById("task-status").value = task.status
  document.getElementById("task-due-date").value = task.dueDate
  document.getElementById("task-project").value = task.projectId || ""
  document.getElementById("task-stakeholder").value = task.stakeholderId || ""
  document.getElementById("task-today").checked = task.isToday
  document.getElementById("task-modal-title").textContent = "Edit Task"

  // Load attachments
  const attachmentsList = document.getElementById("task-attachments-list")
  attachmentsList.innerHTML = ""

  if (task.attachments && task.attachments.length > 0) {
    task.attachments.forEach((attachment) => {
      const attachmentItem = document.createElement("div")
      attachmentItem.className = "attachment-item"
      attachmentItem.dataset.type = attachment.type
      attachmentItem.dataset.value = attachment.value
      attachmentItem.dataset.name = attachment.name

      const icon = attachment.type === "url" ? "fa-link" : "fa-file"
      const displayName = attachment.name || truncateText(attachment.value, 25)

      attachmentItem.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${displayName}</span>
        <button type="button" onclick="removeAttachmentItem(this)">
          <i class="fas fa-times"></i>
        </button>
      `

      attachmentsList.appendChild(attachmentItem)
    })
  }

  openModal("taskModal")
}

function viewTaskDetails(taskId) {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return

  currentViewingTask = task

  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null
  const stakeholder = task.stakeholderId ? stakeholders.find((s) => s.id === task.stakeholderId) : null
  const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not set"
  const createdDate = new Date(task.createdAt).toLocaleDateString()

  const detailsContent = document.getElementById("task-details-content")

  let attachmentsHtml = ""
  if (task.attachments && task.attachments.length > 0) {
    attachmentsHtml = `
      <div class="details-section">
        <h4>Attachments</h4>
        <div class="details-content">
          ${task.attachments
            .map((att) => {
              const icon = att.type === "url" ? "fa-link" : "fa-file"
              return `
              <div class="attachment-item">
                <i class="fas ${icon}"></i>
                <a href="${att.value}" target="_blank">${truncateText(att.name || att.value, 40)}</a>
              </div>
            `
            })
            .join("")}
        </div>
      </div>
    `
  }

  detailsContent.innerHTML = `
    <div class="details-section">
      <h4>Basic Information</h4>
      <div class="details-content">
        <div class="details-row">
          <div class="details-label">Title:</div>
          <div class="details-value">${task.title}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Status:</div>
          <div class="details-value"><span class="task-status status-${task.status}">${task.status.replace("-", " ").toUpperCase()}</span></div>
        </div>
        <div class="details-row">
          <div class="details-label">Priority:</div>
          <div class="details-value"><span class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</span></div>
        </div>
        <div class="details-row">
          <div class="details-label">Due Date:</div>
          <div class="details-value">${dueDate}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Created:</div>
          <div class="details-value">${createdDate}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Project:</div>
          <div class="details-value">${project ? project.name : "None"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Stakeholder:</div>
          <div class="details-value">${stakeholder ? stakeholder.name : "None"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Today's Task:</div>
          <div class="details-value">${task.isToday ? "Yes" : "No"}</div>
        </div>
      </div>
    </div>
    
    ${
      task.description
        ? `
    <div class="details-section">
      <h4>Description</h4>
      <div class="details-content">
        <p>${task.description}</p>
      </div>
    </div>
    `
        : ""
    }
    
    ${attachmentsHtml}
  `

  document.getElementById("task-details-title").textContent = task.title
  document.getElementById("edit-task-btn").onclick = () => {
    closeModal("taskDetailsModal")
    editTask(task.id)
  }

  openModal("taskDetailsModal")
}

async function deleteTask(taskId) {
  if (confirm("Are you sure you want to delete this task?")) {
    try {
      await deleteFromFirebase("tasks", taskId)
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }
}

async function changeTaskStatus(taskId, newStatus) {
  try {
    await saveToFirebase("tasks", { status: newStatus }, taskId)

    // Hide any open status dropdowns
    document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
      dropdown.classList.remove("show")
    })
  } catch (error) {
    console.error("Error updating task status:", error)
  }
}

// Universal status change functions
function toggleUniversalStatusDropdown(event, itemType, itemId) {
  event.stopPropagation()

  // Hide all other dropdowns
  document
    .querySelectorAll(".universal-status-dropdown, .status-dropdown, .followup-status-dropdown")
    .forEach((dropdown) => {
      dropdown.classList.remove("show")
    })

  // Show this dropdown
  const dropdown = event.target.nextElementSibling
  dropdown.classList.toggle("show")
}

async function changeItemStatus(itemType, itemId, newStatus) {
  try {
    const collectionName = itemType === "project" ? "projects" : itemType === "task" ? "tasks" : "subtasks"
    await saveToFirebase(collectionName, { status: newStatus }, itemId)

    // Hide any open status dropdowns
    document.querySelectorAll(".universal-status-dropdown, .status-dropdown").forEach((dropdown) => {
      dropdown.classList.remove("show")
    })

    showSuccess(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} status updated successfully`)
  } catch (error) {
    console.error(`Error updating ${itemType} status:`, error)
  }
}

function toggleStatusDropdown(event, taskId) {
  event.stopPropagation()

  // Hide all other dropdowns
  document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
    dropdown.classList.remove("show")
  })

  // Show this dropdown
  const dropdown = event.target.nextElementSibling
  dropdown.classList.toggle("show")
}

function loadTasks() {
  loadTodayTasks()
  loadBacklogTasks()
  loadCompletedTasks()
}

function loadTodayTasks() {
  const todayTasks = tasks.filter((task) => (task.isToday || isToday(task.dueDate)) && task.status !== "completed")
  const container = document.getElementById("today-tasks")

  if (todayTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calendar-check"></i>
        <p>No tasks scheduled for today</p>
        <button class="btn btn-primary" onclick="openModal('taskModal')">Add Your First Task</button>
      </div>
    `
  } else {
    container.innerHTML = todayTasks.map((task) => createTaskCard(task)).join("")
  }
}

function loadBacklogTasks() {
  let filteredTasks = tasks.filter((task) => !task.isToday && !isToday(task.dueDate) && task.status !== "completed")

  // Apply filters
  const priorityFilter = document.getElementById("priority-filter").value
  const statusFilter = document.getElementById("status-filter").value

  if (priorityFilter) {
    filteredTasks = filteredTasks.filter((task) => task.priority === priorityFilter)
  }

  if (statusFilter) {
    filteredTasks = filteredTasks.filter((task) => task.status === statusFilter)
  }

  const container = document.getElementById("backlog-tasks")

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>No tasks in backlog</p>
        <button class="btn btn-primary" onclick="openModal('taskModal')">Add Tasks to Backlog</button>
      </div>
    `
  } else {
    container.innerHTML = filteredTasks.map((task) => createTaskCard(task)).join("")
  }
}

function loadCompletedTasks() {
  const completedTasks = tasks.filter((task) => task.status === "completed")
  const container = document.getElementById("completed-tasks")

  document.getElementById("completed-count").textContent =
    `${completedTasks.length} task${completedTasks.length !== 1 ? "s" : ""}`

  if (completedTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-double"></i>
        <p>No completed tasks yet</p>
      </div>
    `
  } else {
    container.innerHTML = completedTasks.map((task) => createTaskCard(task)).join("")
  }
}

function createTaskCard(task) {
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null
  const stakeholder = task.stakeholderId ? stakeholders.find((s) => s.id === task.stakeholderId) : null
  const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ""
  const hasAttachments = task.attachments && task.attachments.length > 0

  const statusOptions = [
    { value: "todo", label: "To Do" },
    { value: "in-progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ]

  return `
    <div class="task-card priority-${task.priority}">
      <div class="task-header">
        <div>
          <div class="task-title">${task.title}</div>
          ${project ? `<div style="font-size: 0.8rem; color: var(--color-primary);"><i class="fas fa-folder"></i> ${project.name}</div>` : ""}
          ${stakeholder ? `<div style="font-size: 0.8rem; color: var(--color-info);"><i class="fas fa-user"></i> ${stakeholder.name}</div>` : ""}
        </div>
        <div class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</div>
      </div>
      ${task.description ? `<div class="task-description">${truncateText(task.description, 100)}</div>` : ""}
      <div class="task-meta">
        <div class="status-change">
          <span class="task-status status-${task.status}" onclick="toggleStatusDropdown(event, '${task.id}')" style="cursor: pointer;">
            ${task.status.replace("-", " ").toUpperCase()} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.25rem;"></i>
          </span>
          <div class="status-dropdown">
            ${statusOptions
              .map((option) =>
                option.value !== task.status
                  ? `<div class="status-option" onclick="changeTaskStatus('${task.id}', '${option.value}')">${option.label}</div>`
                  : "",
              )
              .join("")}
          </div>
        </div>
        ${dueDate ? `<span><i class="fas fa-calendar"></i> ${dueDate}</span>` : ""}
      </div>
      ${hasAttachments ? `<div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-secondary);"><i class="fas fa-paperclip"></i> ${task.attachments.length} attachment${task.attachments.length !== 1 ? "s" : ""}</div>` : ""}
      <div class="task-actions">
        <button class="btn-view" onclick="viewTaskDetails('${task.id}')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn-edit" onclick="editTask('${task.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteTask('${task.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `
}

// Project functions
async function saveProject(event) {
  event.preventDefault()

  try {
    const projectAttachmentsList = document.getElementById("project-attachments-list")
    const attachments = []

    // Get all attachment items
    projectAttachmentsList.querySelectorAll(".attachment-item").forEach((item) => {
      attachments.push({
        type: item.dataset.type,
        value: item.dataset.value,
        name: item.dataset.name,
      })
    })

    const projectData = {
      name: document.getElementById("project-name").value,
      description: document.getElementById("project-description").value,
      status: document.getElementById("project-status").value,
      parentId: document.getElementById("project-parent").value || null,
      stakeholderId: document.getElementById("project-stakeholder").value || null,
      deadline: document.getElementById("project-deadline").value,
      attachments: attachments,
    }

    if (currentEditingProject) {
      await saveToFirebase("projects", projectData, currentEditingProject.id)
      showSuccess("Project updated successfully")
    } else {
      await saveToFirebase("projects", projectData)
      showSuccess("Project created successfully")
    }

    closeModal("projectModal")
  } catch (error) {
    console.error("Error saving project:", error)
  }
}

function editProject(projectId) {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return

  currentEditingProject = project

  document.getElementById("project-name").value = project.name
  document.getElementById("project-description").value = project.description
  document.getElementById("project-status").value = project.status
  document.getElementById("project-parent").value = project.parentId || ""
  document.getElementById("project-stakeholder").value = project.stakeholderId || ""
  document.getElementById("project-deadline").value = project.deadline
  document.getElementById("project-modal-title").textContent = "Edit Project"

  // Load attachments
  const attachmentsList = document.getElementById("project-attachments-list")
  attachmentsList.innerHTML = ""

  if (project.attachments && project.attachments.length > 0) {
    project.attachments.forEach((attachment) => {
      const attachmentItem = document.createElement("div")
      attachmentItem.className = "attachment-item"
      attachmentItem.dataset.type = attachment.type
      attachmentItem.dataset.value = attachment.value
      attachmentItem.dataset.name = attachment.name

      const icon = attachment.type === "url" ? "fa-link" : "fa-file"
      const displayName = attachment.name || truncateText(attachment.value, 25)

      attachmentItem.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${displayName}</span>
        <button type="button" onclick="removeAttachmentItem(this)">
          <i class="fas fa-times"></i>
        </button>
      `

      attachmentsList.appendChild(attachmentItem)
    })
  }

  openModal("projectModal")
}

function viewProjectDetails(projectId) {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return

  currentViewingProject = project

  const parentProject = project.parentId ? projects.find((p) => p.id === project.parentId) : null
  const stakeholder = project.stakeholderId ? stakeholders.find((s) => s.id === stakeholders.stakeholderId) : null
  const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : "Not set"
  const createdDate = new Date(project.createdAt).toLocaleDateString()

  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const completedTasks = projectTasks.filter((t) => t.status === "completed").length
  const childProjects = projects.filter((p) => p.parentId === project.id)

  const detailsContent = document.getElementById("project-details-content")

  let attachmentsHtml = ""
  if (project.attachments && project.attachments.length > 0) {
    attachmentsHtml = `
      <div class="details-section">
        <h4>Attachments</h4>
        <div class="details-content">
          ${project.attachments
            .map((att) => {
              const icon = att.type === "url" ? "fa-link" : "fa-file"
              return `
              <div class="attachment-item">
                <i class="fas ${icon}"></i>
                <a href="${att.value}" target="_blank">${truncateText(att.name || att.value, 40)}</a>
              </div>
            `
            })
            .join("")}
        </div>
      </div>
    `
  }

  let tasksHtml = ""
  if (projectTasks.length > 0) {
    tasksHtml = `
      <div class="details-section">
        <h4>Tasks (${projectTasks.length})</h4>
        <div class="details-content">
          ${projectTasks
            .map(
              (task) => `
            <div class="project-task-item">
              <div>
                <span class="task-status status-${task.status}" style="margin-right: 0.5rem">${task.status.replace("-", " ").toUpperCase()}</span>
                ${task.title}
              </div>
              <button class="btn-view" onclick="viewTaskDetails('${task.id}')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
  }

  let childProjectsHtml = ""
  if (childProjects.length > 0) {
    childProjectsHtml = `
      <div class="details-section">
        <h4>Sub-projects (${childProjects.length})</h4>
        <div class="details-content">
          ${childProjects
            .map(
              (child) => `
            <div class="project-task-item">
              <div>
                <span class="task-status status-${child.status}" style="margin-right: 0.5rem">${child.status.replace("-", " ").toUpperCase()}</span>
                ${child.name}
              </div>
              <button class="btn-view" onclick="viewProjectDetails('${child.id}')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
  }

  detailsContent.innerHTML = `
    <div class="details-section">
      <h4>Basic Information</h4>
      <div class="details-content">
        <div class="details-row">
          <div class="details-label">Name:</div>
          <div class="details-value">${project.name}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Status:</div>
          <div class="details-value"><span class="task-status status-${project.status}">${project.status.replace("-", " ").toUpperCase()}</span></div>
        </div>
        <div class="details-row">
          <div class="details-label">Deadline:</div>
          <div class="details-value">${deadline}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Created:</div>
          <div class="details-value">${createdDate}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Parent Project:</div>
          <div class="details-value">${parentProject ? parentProject.name : "None"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Stakeholder:</div>
          <div class="details-value">${stakeholder ? stakeholder.name : "None"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Tasks:</div>
          <div class="details-value">${projectTasks.length} (${completedTasks} completed)</div>
        </div>
      </div>
    </div>
    
    ${
      project.description
        ? `
    <div class="details-section">
      <h4>Description</h4>
      <div class="details-content">
        <p>${project.description}</p>
      </div>
    </div>
    `
        : ""
    }
    
    ${attachmentsHtml}
    ${childProjectsHtml}
    ${tasksHtml}
  `

  document.getElementById("project-details-title").textContent = project.name
  document.getElementById("edit-project-btn").onclick = () => {
    closeModal("projectDetailsModal")
    editProject(project.id)
  }

  openModal("projectDetailsModal")
}

async function deleteProject(projectId) {
  if (confirm("Are you sure you want to delete this project? This will also remove it from associated tasks.")) {
    try {
      // Update tasks to remove project reference
      const projectTasks = tasks.filter((t) => t.projectId === projectId)
      for (const task of projectTasks) {
        await saveToFirebase("tasks", { projectId: null }, task.id)
      }

      // Delete child projects
      const childProjects = projects.filter((p) => p.parentId === projectId)
      for (const child of childProjects) {
        await deleteFromFirebase("projects", child.id)
      }

      // Delete the project
      await deleteFromFirebase("projects", projectId)
    } catch (error) {
      console.error("Error deleting project:", error)
    }
  }
}

// Project management functions
function switchProjectTab(tabName) {
  currentProjectTab = tabName

  // Update tab buttons
  document.querySelectorAll(".project-tabs .tab-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

  // Load projects for the selected tab
  loadProjectsWithFilters()
}

function loadProjectsWithFilters() {
  const container = document.getElementById("projects-container")
  const filteredProjects = getFilteredProjects()

  updateProjectTabCounts()

  if (filteredProjects.length === 0) {
    container.innerHTML = createProjectEmptyState()
    return
  }

  container.innerHTML = filteredProjects.map((project) => createEnhancedProjectCard(project)).join("")
}

function getFilteredProjects() {
  let filteredProjects = [...projects]

  // Filter by tab
  if (currentProjectTab !== "all") {
    filteredProjects = filteredProjects.filter((project) => project.status === currentProjectTab)
  }

  // Apply additional filters
  const stakeholderFilter = document.getElementById("project-stakeholder-filter").value
  const searchFilter = document.getElementById("project-search-filter").value.toLowerCase()

  if (stakeholderFilter) {
    filteredProjects = filteredProjects.filter((project) => project.stakeholderId === stakeholderFilter)
  }

  if (searchFilter) {
    filteredProjects = filteredProjects.filter(
      (project) =>
        project.name.toLowerCase().includes(searchFilter) ||
        (project.description && project.description.toLowerCase().includes(searchFilter)),
    )
  }

  return filteredProjects
}

function updateProjectTabCounts() {
  const allProjects = projects.length
  const planningProjects = projects.filter((p) => p.status === "planning").length
  const activeProjects = projects.filter((p) => p.status === "active").length
  const completedProjects = projects.filter((p) => p.status === "completed").length
  const onHoldProjects = projects.filter((p) => p.status === "on-hold").length

  const allProjectsElement = document.getElementById("all-projects-count")
  const planningProjectsElement = document.getElementById("planning-projects-count")
  const activeProjectsElement = document.getElementById("active-projects-count")
  const completedProjectsElement = document.getElementById("completed-projects-count")
  const onHoldProjectsElement = document.getElementById("on-hold-projects-count")

  if (allProjectsElement) allProjectsElement.textContent = allProjects
  if (planningProjectsElement) planningProjectsElement.textContent = planningProjects
  if (activeProjectsElement) activeProjectsElement.textContent = activeProjects
  if (completedProjectsElement) completedProjectsElement.textContent = completedProjects
  if (onHoldProjectsElement) onHoldProjectsElement.textContent = onHoldProjects
}

function filterAndLoadProjects() {
  loadProjectsWithFilters()
}

function createProjectEmptyState() {
  const messages = {
    all: "No projects found",
    planning: "No projects in planning",
    active: "No active projects",
    completed: "No completed projects",
    "on-hold": "No projects on hold",
  }

  return `
    <div class="empty-state">
      <i class="fas fa-folder-open"></i>
      <p>${messages[currentProjectTab]}</p>
      <button class="btn btn-primary" onclick="openModal('projectModal')">Create New Project</button>
    </div>
  `
}

function createEnhancedProjectCard(project) {
  const childProjects = projects.filter((p) => p.parentId === project.id)
  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const completedTasks = projectTasks.filter((t) => t.status === "completed").length
  const stakeholder = project.stakeholderId ? stakeholders.find((s) => s.id === project.stakeholderId) : null
  const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : ""
  const hasAttachments = project.attachments && project.attachments.length > 0

  const progressPercentage = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0
  const progressClass = progressPercentage < 30 ? "low" : progressPercentage < 70 ? "medium" : "high"

  return `
    <div class="project-card-enhanced task-card-unified status-${project.status}" draggable="true">
      <div class="project-header">
        <div class="project-name">${project.name}</div>
        <div class="status-change">
          <span class="task-status status-${project.status}" onclick="toggleUniversalStatusDropdown(event, 'project', '${project.id}')" style="cursor: pointer;">
            ${project.status.replace("-", " ").toUpperCase()} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.25rem;"></i>
          </span>
          <div class="universal-status-dropdown">
            ${["planning", "active", "on-hold", "completed"]
              .filter((status) => status !== project.status)
              .map(
                (status) =>
                  `<div class="universal-status-option" onclick="changeItemStatus('project', '${project.id}', '${status}')">
                    <i class="fas fa-circle"></i>
                    ${status.replace("-", " ").toUpperCase()}
                  </div>`,
              )
              .join("")}
          </div>
        </div>
      </div>
      
      ${project.description ? `<div class="project-description">${truncateText(project.description, 100)}</div>` : ""}
      
      <div class="project-progress-bar">
        <div class="project-progress-fill ${progressClass}" style="width: ${progressPercentage}%"></div>
      </div>
      
      <div class="project-stats">
        <span><i class="fas fa-tasks"></i> ${projectTasks.length} tasks (${progressPercentage}% complete)</span>
        ${deadline ? `<span><i class="fas fa-calendar"></i> ${deadline}</span>` : ""}
      </div>
      
      ${stakeholder ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-info);"><i class="fas fa-user"></i> ${stakeholder.name}</div>` : ""}
      ${hasAttachments ? `<div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-secondary);"><i class="fas fa-paperclip"></i> ${project.attachments.length} attachment${project.attachments.length !== 1 ? "s" : ""}</div>` : ""}
      
      <div class="task-actions task-card-actions">
        <button class="btn-view" onclick="viewProjectDetails('${project.id}')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn-edit" onclick="editProject('${project.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteProject('${project.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `
}

function loadProjects() {
  const mainProjects = projects.filter((project) => !project.parentId)
  const container = document.getElementById("projects-container")

  if (mainProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-folder-open"></i>
        <p>No projects created yet</p>
        <button class="btn btn-primary" onclick="openModal('projectModal')">Create Your First Project</button>
      </div>
    `
  } else {
    container.innerHTML = mainProjects.map((project) => createProjectCard(project)).join("")
  }
}

function createProjectCard(project) {
  const childProjects = projects.filter((p) => p.parentId === project.id)
  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const completedTasks = projectTasks.filter((t) => t.status === "completed").length
  const stakeholder = project.stakeholderId ? stakeholders.find((s) => s.id === stakeholder.stakeholderId) : null
  const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : ""
  const hasAttachments = project.attachments && project.attachments.length > 0

  return `
    <div class="project-card">
      <div class="project-header">
        <div class="project-name">${project.name}</div>
        <div class="task-status status-${project.status}">${project.status.replace("-", " ").toUpperCase()}</div>
      </div>
      ${project.description ? `<div class="project-description">${truncateText(project.description, 100)}</div>` : ""}
      <div class="project-stats">
        <span><i class="fas fa-tasks"></i> ${projectTasks.length} tasks (${completedTasks} completed)</span>
        ${deadline ? `<span><i class="fas fa-calendar"></i> ${deadline}</span>` : ""}
      </div>
      ${stakeholder ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-info);"><i class="fas fa-user"></i> ${stakeholder.name}</div>` : ""}
      ${hasAttachments ? `<div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-secondary);"><i class="fas fa-paperclip"></i> ${project.attachments.length} attachment${project.attachments.length !== 1 ? "s" : ""}</div>` : ""}
      
      ${
        childProjects.length > 0
          ? `
          <div class="child-projects">
            <h4><i class="fas fa-sitemap"></i> Sub-projects (${childProjects.length})</h4>
            ${childProjects
              .map(
                (child) => `
                <div class="child-project clickable" onclick="viewProjectDetails('${child.id}')">
                  <a href="#" class="subproject-link" onclick="event.preventDefault()">
                    <strong>${child.name}</strong>
                  </a> - ${child.status.replace("-", " ")}
                </div>
              `,
              )
              .join("")}
          </div>
        `
          : ""
      }
      
      ${
        projectTasks.length > 0
          ? `
          <div class="project-tasks">
            <h4 onclick="toggleProjectTasks(this)">
              <i class="fas fa-tasks"></i> Tasks (${projectTasks.length})
              <i class="fas fa-chevron-down" style="margin-left: auto;"></i>
            </h4>
            <div class="project-tasks-list">
              ${projectTasks
                .map(
                  (task) => `
                  <div class="project-task-item">
                    <span>${task.title}</span>
                    <span class="task-status status-${task.status}">${task.status.replace("-", " ").toUpperCase()}</span>
                  </div>
                `,
                )
                .join("")}
            </div>
          </div>
        `
          : ""
      }
      
      <div class="task-actions">
        <button class="btn-view" onclick="viewProjectDetails('${project.id}')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn-edit" onclick="editProject('${project.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteProject('${project.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `
}

// Stakeholder functions
async function saveStakeholder(event) {
  event.preventDefault()

  try {
    const stakeholderData = {
      name: document.getElementById("stakeholder-name").value,
      email: document.getElementById("stakeholder-email").value,
      role: document.getElementById("stakeholder-role").value,
      company: document.getElementById("stakeholder-company").value,
      phone: document.getElementById("stakeholder-phone").value,
      notes: document.getElementById("stakeholder-notes").value,
    }

    if (currentEditingStakeholder) {
      await saveToFirebase("stakeholders", stakeholderData, currentEditingStakeholder.id)
      showSuccess("Stakeholder updated successfully")
    } else {
      await saveToFirebase("stakeholders", stakeholderData)
      showSuccess("Stakeholder created successfully")
    }

    closeModal("stakeholderModal")
  } catch (error) {
    console.error("Error saving stakeholder:", error)
  }
}

function editStakeholder(stakeholderId) {
  const stakeholder = stakeholders.find((s) => s.id === stakeholderId)
  if (!stakeholder) return

  currentEditingStakeholder = stakeholder

  document.getElementById("stakeholder-name").value = stakeholder.name
  document.getElementById("stakeholder-email").value = stakeholder.email
  document.getElementById("stakeholder-role").value = stakeholder.role
  document.getElementById("stakeholder-company").value = stakeholder.company
  document.getElementById("stakeholder-phone").value = stakeholder.phone
  document.getElementById("stakeholder-notes").value = stakeholder.notes
  document.getElementById("stakeholder-modal-title").textContent = "Edit Stakeholder"

  openModal("stakeholderModal")
}

function viewStakeholderDetails(stakeholderId) {
  const stakeholder = stakeholders.find((s) => s.id === stakeholderId)
  if (!stakeholder) return

  currentViewingStakeholder = stakeholder

  const stakeholderFollowups = followups.filter((f) => f.stakeholderId === stakeholder.id)
  const pendingFollowups = stakeholderFollowups.filter((f) => f.status === "pending").length
  const completedFollowups = stakeholderFollowups.filter((f) => f.status === "completed").length
  const stakeholderTasks = tasks.filter((t) => t.stakeholderId === stakeholder.id)
  const stakeholderProjects = projects.filter((p) => p.stakeholderId === stakeholder.id)
  const createdDate = new Date(stakeholder.createdAt).toLocaleDateString()

  const detailsContent = document.getElementById("stakeholder-details-content")

  let followupsHtml = ""
  if (stakeholderFollowups.length > 0) {
    followupsHtml = `
    <div class="details-section">
      <h4>Followups (${stakeholderFollowups.length})</h4>
      <div class="details-content">
        ${stakeholderFollowups
          .map(
            (followup) => `
          <div class="followup-item">
            <div class="followup-header">
              <span class="followup-title">${followup.title}</span>
              <div class="followup-status-change">
                <span class="task-status status-${followup.status}" onclick="toggleFollowupStatusDropdown(event, '${followup.id}')" style="cursor: pointer;">
                  ${followup.status.toUpperCase()} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.25rem;"></i>
                </span>
                <div class="followup-status-dropdown">
                  ${["pending", "completed", "cancelled"]
                    .map((status) =>
                      status !== followup.status
                        ? `<div class="followup-status-option" onclick="changeFollowupStatus('${followup.id}', '${status}')">${status.charAt(0).toUpperCase() + status.slice(1)}</div>`
                        : "",
                    )
                    .join("")}
                </div>
              </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
              <span class="followup-type">${followup.type.toUpperCase()}</span>
              ${followup.date ? ` • ${new Date(followup.date).toLocaleDateString()}` : ""}
            </div>
            <div class="followup-actions">
              <button class="btn-edit-followup" onclick="editFollowup('${followup.id}')">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="btn-delete-followup" onclick="deleteFollowup('${followup.id}')">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `
  }

  let tasksHtml = ""
  if (stakeholderTasks.length > 0) {
    tasksHtml = `
      <div class="details-section">
        <h4>Associated Tasks (${stakeholderTasks.length})</h4>
        <div class="details-content">
          ${stakeholderTasks
            .map(
              (task) => `
            <div class="project-task-item">
              <div>
                <span class="task-status status-${task.status}" style="margin-right: 0.5rem">${task.status.replace("-", " ").toUpperCase()}</span>
                ${task.title}
              </div>
              <button class="btn-view" onclick="viewTaskDetails('${task.id}')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
  }

  let projectsHtml = ""
  if (stakeholderProjects.length > 0) {
    projectsHtml = `
      <div class="details-section">
        <h4>Associated Projects (${stakeholderProjects.length})</h4>
        <div class="details-content">
          ${stakeholderProjects
            .map(
              (project) => `
            <div class="project-task-item">
              <div>
                <span class="task-status status-${project.status}" style="margin-right: 0.5rem">${project.status.replace("-", " ").toUpperCase()}</span>
                ${project.name}
              </div>
              <button class="btn-view" onclick="viewProjectDetails('${project.id}')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
  }

  detailsContent.innerHTML = `
    <div class="details-section">
      <h4>Contact Information</h4>
      <div class="details-content">
        <div class="details-row">
          <div class="details-label">Name:</div>
          <div class="details-value">${stakeholder.name}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Email:</div>
          <div class="details-value">${stakeholder.email || "Not provided"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Phone:</div>
          <div class="details-value">${stakeholder.phone || "Not provided"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Role:</div>
          <div class="details-value">${stakeholder.role || "Not specified"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Company:</div>
          <div class="details-value">${stakeholder.company || "Not specified"}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Created:</div>
          <div class="details-value">${createdDate}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Followups:</div>
          <div class="details-value">${stakeholderFollowups.length} total (${pendingFollowups} pending, ${completedFollowups} completed)</div>
        </div>
      </div>
    </div>
    
    ${
      stakeholder.notes
        ? `
    <div class="details-section">
      <h4>Notes</h4>
      <div class="details-content">
        <p>${stakeholder.notes}</p>
      </div>
    </div>
    `
        : ""
    }
    
    ${followupsHtml}
    ${tasksHtml}
    ${projectsHtml}
  `

  document.getElementById("stakeholder-details-title").textContent = stakeholder.name
  document.getElementById("edit-stakeholder-btn").onclick = () => {
    closeModal("stakeholderDetailsModal")
    editStakeholder(stakeholder.id)
  }
  document.getElementById("add-followup-btn").onclick = () => {
    closeModal("stakeholderDetailsModal")
    currentFollowupStakeholder = stakeholder.id
    openModal("followupModal")
  }

  openModal("stakeholderDetailsModal")
}

async function deleteStakeholder(stakeholderId) {
  if (
    confirm(
      "Are you sure you want to delete this stakeholder? This will also remove them from associated tasks and projects.",
    )
  ) {
    try {
      // Delete associated followups
      const stakeholderFollowups = followups.filter((f) => f.stakeholderId === stakeholderId)
      for (const followup of stakeholderFollowups) {
        await deleteFromFirebase("followups", followup.id)
      }

      // Remove stakeholder from tasks
      const stakeholderTasks = tasks.filter((t) => t.stakeholderId === stakeholderId)
      for (const task of stakeholderTasks) {
        await saveToFirebase("tasks", { stakeholderId: null }, task.id)
      }

      // Remove stakeholder from projects
      const stakeholderProjects = projects.filter((p) => p.stakeholderId === stakeholderId)
      for (const project of stakeholderProjects) {
        await saveToFirebase("projects", { stakeholderId: null }, project.id)
      }

      // Delete the stakeholder
      await deleteFromFirebase("stakeholders", stakeholderId)
    } catch (error) {
      console.error("Error deleting stakeholder:", error)
    }
  }
}

function loadStakeholders() {
  const container = document.getElementById("stakeholders-container")

  if (stakeholders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-plus"></i>
        <p>No stakeholders added yet</p>
        <button class="btn btn-primary" onclick="openModal('stakeholderModal')">Add Your First Stakeholder</button>
      </div>
    `
  } else {
    container.innerHTML = stakeholders.map((stakeholder) => createStakeholderCard(stakeholder)).join("")
  }
}

function createStakeholderCard(stakeholder) {
  const stakeholderFollowups = followups.filter((f) => f.stakeholderId === stakeholder.id)
  const pendingFollowups = stakeholderFollowups.filter((f) => f.status === "pending").length
  const completedFollowups = stakeholderFollowups.filter((f) => f.status === "completed").length
  const stakeholderTasks = tasks.filter((t) => t.stakeholderId === stakeholder.id)
  const stakeholderProjects = projects.filter((p) => p.stakeholderId === stakeholder.id)

  return `
    <div class="stakeholder-card">
      <div class="stakeholder-header">
        <div>
          <div class="stakeholder-name">${stakeholder.name}</div>
          ${stakeholder.role ? `<div class="stakeholder-role">${stakeholder.role}</div>` : ""}
        </div>
      </div>
      
      <div class="stakeholder-contact">
        ${stakeholder.email ? `<div><i class="fas fa-envelope"></i> ${stakeholder.email}</div>` : ""}
        ${stakeholder.phone ? `<div><i class="fas fa-phone"></i> ${stakeholder.phone}</div>` : ""}
        ${stakeholder.company ? `<div><i class="fas fa-building"></i> ${stakeholder.company}</div>` : ""}
      </div>
      
      <div class="stakeholder-stats">
        <span><i class="fas fa-tasks"></i> ${stakeholderTasks.length} tasks</span>
        <span><i class="fas fa-project-diagram"></i> ${stakeholderProjects.length} projects</span>
      </div>
      
      <div class="stakeholder-quick-actions">
        <button class="btn-quick btn-add-followup" onclick="addFollowupToStakeholder('${stakeholder.id}')">
          <i class="fas fa-comments"></i> Add Followup
        </button>
      </div>
      
      ${
        stakeholderFollowups.length > 0
          ? `
<div class="followups-section">
  <h4 onclick="toggleStakeholderFollowups(this)">
    <i class="fas fa-comments"></i> Followups (${stakeholderFollowups.length})
    <i class="fas fa-chevron-down" style="margin-left: auto;"></i>
  </h4>
  <div class="followups-list show">
    ${stakeholderFollowups
      .slice(0, 3)
      .map(
        (followup) => `
        <div class="followup-item">
          <div class="followup-header">
            <span class="followup-title">${followup.title}</span>
            <div class="followup-status-change">
              <span class="task-status status-${followup.status}" onclick="toggleFollowupStatusDropdown(event, '${followup.id}')" style="cursor: pointer;">
                ${followup.status.toUpperCase()} <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.25rem;"></i>
              </span>
              <div class="followup-status-dropdown">
                ${["pending", "completed", "cancelled"]
                  .map((status) =>
                    status !== followup.status
                      ? `<div class="followup-status-option" onclick="changeFollowupStatus('${followup.id}', '${status}')">${status.charAt(0).toUpperCase() + status.slice(1)}</div>`
                      : "",
                  )
                  .join("")}
              </div>
            </div>
          </div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
            <span class="followup-type">${followup.type.toUpperCase()}</span>
            ${followup.date ? ` • ${new Date(followup.date).toLocaleDateString()}` : ""}
          </div>
          <div class="followup-actions">
            <button class="btn-edit-followup" onclick="editFollowup('${followup.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-delete-followup" onclick="deleteFollowup('${followup.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `,
      )
      .join("")}
    ${stakeholderFollowups.length > 3 ? `<div style="text-align: center; margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-text-secondary);"><a href="#" onclick="viewStakeholderDetails('${stakeholder.id}'); return false;">View all ${stakeholderFollowups.length} followups</a></div>` : ""}
  </div>
</div>
`
          : ""
      }
      
      <div class="task-actions">
        <button class="btn-view" onclick="viewStakeholderDetails('${stakeholder.id}')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn-edit" onclick="editStakeholder('${stakeholder.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteStakeholder('${stakeholder.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `
}

// New function to handle adding followup to stakeholder
function addFollowupToStakeholder(stakeholderId) {
  currentFollowupStakeholder = stakeholderId
  openModal("followupModal")
}

// Followup functions
async function saveFollowup(event) {
  event.preventDefault()

  try {
    const followupData = {
      stakeholderId: currentFollowupStakeholder,
      title: document.getElementById("followup-title").value,
      description: document.getElementById("followup-description").value,
      type: document.getElementById("followup-type").value,
      status: document.getElementById("followup-status").value,
      date: document.getElementById("followup-date").value,
    }

    if (currentEditingFollowup) {
      await saveToFirebase("followups", followupData, currentEditingFollowup.id)
      showSuccess("Followup updated successfully")
    } else {
      await saveToFirebase("followups", followupData)
      showSuccess("Followup created successfully")
    }

    closeModal("followupModal")
  } catch (error) {
    console.error("Error saving followup:", error)
  }
}

function editFollowup(followupId) {
  const followup = followups.find((f) => f.id === followupId)
  if (!followup) return

  currentEditingFollowup = followup
  currentFollowupStakeholder = followup.stakeholderId

  document.getElementById("followup-title").value = followup.title
  document.getElementById("followup-description").value = followup.description
  document.getElementById("followup-type").value = followup.type
  document.getElementById("followup-status").value = followup.status
  document.getElementById("followup-date").value = followup.date
  document.getElementById("followup-modal-title").textContent = "Edit Followup"

  openModal("followupModal")
}

async function deleteFollowup(followupId) {
  if (confirm("Are you sure you want to delete this followup?")) {
    try {
      await deleteFromFirebase("followups", followupId)
    } catch (error) {
      console.error("Error deleting followup:", error)
    }
  }
}

async function changeFollowupStatus(followupId, newStatus) {
  try {
    await saveToFirebase("followups", { status: newStatus }, followupId)

    // Hide any open status dropdowns
    document.querySelectorAll(".followup-status-dropdown").forEach((dropdown) => {
      dropdown.classList.remove("show")
    })
  } catch (error) {
    console.error("Error updating followup status:", error)
  }
}

// Subtask functions
async function saveSubtask(event) {
  event.preventDefault()

  try {
    const subtaskData = {
      parentTaskId: currentSubtaskParent,
      title: document.getElementById("subtask-title").value,
      description: document.getElementById("subtask-description").value,
      priority: document.getElementById("subtask-priority").value,
      status: document.getElementById("subtask-status").value,
      dueDate: document.getElementById("subtask-due-date").value,
    }

    if (currentEditingSubtask) {
      await saveToFirebase("subtasks", subtaskData, currentEditingSubtask.id)
      showSuccess("Subtask updated successfully")
    } else {
      await saveToFirebase("subtasks", subtaskData)
      showSuccess("Subtask created successfully")
    }

    closeModal("subtaskModal")
  } catch (error) {
    console.error("Error saving subtask:", error)
  }
}

function addSubtaskToTask(taskId) {
  currentSubtaskParent = taskId
  currentEditingSubtask = null
  document.getElementById("subtaskForm").reset()
  document.getElementById("subtask-modal-title").textContent = "Add Subtask"
  openModal("subtaskModal")
}

function editSubtask(subtaskId) {
  const subtask = subtasks.find((s) => s.id === subtaskId)
  if (!subtask) return

  currentEditingSubtask = subtask
  currentSubtaskParent = subtask.parentTaskId

  document.getElementById("subtask-title").value = subtask.title
  document.getElementById("subtask-description").value = subtask.description
  document.getElementById("subtask-priority").value = subtask.priority
  document.getElementById("subtask-status").value = subtask.status
  document.getElementById("subtask-due-date").value = subtask.dueDate
  document.getElementById("subtask-modal-title").textContent = "Edit Subtask"

  openModal("subtaskModal")
}

async function deleteSubtask(subtaskId) {
  if (confirm("Are you sure you want to delete this subtask?")) {
    try {
      await deleteFromFirebase("subtasks", subtaskId)
    } catch (error) {
      console.error("Error deleting subtask:", error)
    }
  }
}

async function changeSubtaskStatus(subtaskId, newStatus) {
  try {
    await saveToFirebase("subtasks", { status: newStatus }, subtaskId)
  } catch (error) {
    console.error("Error updating subtask status:", error)
  }
}

function toggleSubtasks(element) {
  const subtasksList = element.nextElementSibling
  subtasksList.classList.toggle("show")

  const icon = element.querySelector(".fa-chevron-down, .fa-chevron-up")
  if (subtasksList.classList.contains("show")) {
    icon.classList.replace("fa-chevron-down", "fa-chevron-up")
  } else {
    icon.classList.replace("fa-chevron-up", "fa-chevron-down")
  }
}

function toggleFollowupStatusDropdown(event, followupId) {
  event.stopPropagation()

  // Hide all other dropdowns
  document.querySelectorAll(".followup-status-dropdown").forEach((dropdown) => {
    dropdown.classList.remove("show")
  })

  // Show this dropdown
  const dropdown = event.target.nextElementSibling
  dropdown.classList.toggle("show")
}

// Toggle functions
function toggleProjectTasks(element) {
  const tasksList = element.nextElementSibling
  tasksList.classList.toggle("show")

  const icon = element.querySelector(".fa-chevron-down, .fa-chevron-up")
  if (tasksList.classList.contains("show")) {
    icon.classList.replace("fa-chevron-down", "fa-chevron-up")
  } else {
    icon.classList.replace("fa-chevron-up", "fa-chevron-down")
  }
}

function toggleStakeholderFollowups(element) {
  const followupsList = element.nextElementSibling
  followupsList.classList.toggle("show")

  const icon = element.querySelector(".fa-chevron-down, .fa-chevron-up")
  if (followupsList.classList.contains("show")) {
    icon.classList.replace("fa-chevron-down", "fa-chevron-up")
  } else {
    icon.classList.replace("fa-chevron-up", "fa-chevron-down")
  }
}

// Attachment functions
function addAttachment(type) {
  const nameInputId = type === "url" ? "task-attachment-name" : "task-attachment-name-doc"
  const inputId = type === "url" ? "task-url" : "task-document"
  const nameInput = document.getElementById(nameInputId)
  const input = document.getElementById(inputId)
  const name = nameInput.value.trim()
  const value = input.value.trim()

  if (!value) return

  const attachmentsList = document.getElementById("task-attachments-list")
  const attachmentItem = document.createElement("div")
  attachmentItem.className = "attachment-item"
  attachmentItem.dataset.type = type
  attachmentItem.dataset.value = value
  attachmentItem.dataset.name = name || value

  const icon = type === "url" ? "fa-link" : "fa-file"
  const displayName = name || truncateText(value, 25)

  attachmentItem.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${displayName}</span>
    <button type="button" onclick="removeAttachmentItem(this)">
      <i class="fas fa-times"></i>
    </button>
  `

  attachmentsList.appendChild(attachmentItem)
  nameInput.value = ""
  input.value = ""
}

function addProjectAttachment(type) {
  const nameInputId = type === "url" ? "project-attachment-name" : "project-attachment-name-doc"
  const inputId = type === "url" ? "project-url" : "project-document"
  const nameInput = document.getElementById(nameInputId)
  const input = document.getElementById(inputId)
  const name = nameInput.value.trim()
  const value = input.value.trim()

  if (!value) return

  const attachmentsList = document.getElementById("project-attachments-list")
  const attachmentItem = document.createElement("div")
  attachmentItem.className = "attachment-item"
  attachmentItem.dataset.type = type
  attachmentItem.dataset.value = value
  attachmentItem.dataset.name = name || value

  const icon = type === "url" ? "fa-link" : "fa-file"
  const displayName = name || truncateText(value, 25)

  attachmentItem.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${displayName}</span>
    <button type="button" onclick="removeAttachmentItem(this)">
      <i class="fas fa-times"></i>
    </button>
  `

  attachmentsList.appendChild(attachmentItem)
  nameInput.value = ""
  input.value = ""
}

function removeAttachmentItem(button) {
  const attachmentItem = button.parentElement
  attachmentItem.remove()
}

// Utility functions
function isToday(dateString) {
  if (!dateString) return false
  const today = new Date()
  const date = new Date(dateString)
  return date.toDateString() === today.toDateString()
}

function updateCounts() {
  const todayTasks = tasks.filter((task) => (task.isToday || isToday(task.dueDate)) && task.status !== "completed")
  const completedTasks = tasks.filter((task) => task.status === "completed")

  const todayCountElement = document.getElementById("today-count")
  const completedCountElement = document.getElementById("completed-count")
  const projectCountElement = document.getElementById("project-count")
  const stakeholderCountElement = document.getElementById("stakeholder-count")
  const knowledgeCountElement = document.getElementById("knowledge-count")

  if (todayCountElement) {
    todayCountElement.textContent = `${todayTasks.length} task${todayTasks.length !== 1 ? "s" : ""}`
  }

  if (completedCountElement) {
    completedCountElement.textContent = `${completedTasks.length} task${completedTasks.length !== 1 ? "s" : ""}`
  }

  if (projectCountElement) {
    projectCountElement.textContent = `${projects.length} project${projects.length !== 1 ? "s" : ""}`
  }

  if (stakeholderCountElement) {
    stakeholderCountElement.textContent = `${stakeholders.length} stakeholder${stakeholders.length !== 1 ? "s" : ""}`
  }

  if (knowledgeCountElement) {
    knowledgeCountElement.textContent = `${knowledgeEntries.length} item${knowledgeEntries.length !== 1 ? "s" : ""}`
  }
}

function populateProjectSelects() {
  const taskProjectSelect = document.getElementById("task-project")
  if (taskProjectSelect) {
    taskProjectSelect.innerHTML = '<option value="">No Project</option>'

    projects.forEach((project) => {
      const option = document.createElement("option")
      option.value = project.id
      option.textContent = project.name
      taskProjectSelect.appendChild(option)
    })
  }
}

function populateParentProjectSelect() {
  const parentSelect = document.getElementById("project-parent")
  if (parentSelect) {
    parentSelect.innerHTML = '<option value="">No Parent (Main Project)</option>'

    projects.forEach((project) => {
      if (!currentEditingProject || project.id !== currentEditingProject.id) {
        const option = document.createElement("option")
        option.value = project.id
        option.textContent = project.name
        parentSelect.appendChild(option)
      }
    })
  }
}

function populateStakeholderSelects() {
  const taskStakeholderSelect = document.getElementById("task-stakeholder")
  const projectStakeholderSelect = document.getElementById("project-stakeholder")

  if (taskStakeholderSelect) {
    taskStakeholderSelect.innerHTML = '<option value="">No Stakeholder</option>'
    stakeholders.forEach((stakeholder) => {
      const option = document.createElement("option")
      option.value = stakeholder.id
      option.textContent = stakeholder.name
      taskStakeholderSelect.appendChild(option)
    })
  }

  if (projectStakeholderSelect) {
    projectStakeholderSelect.innerHTML = '<option value="">No Stakeholder</option>'
    stakeholders.forEach((stakeholder) => {
      const option = document.createElement("option")
      option.value = stakeholder.id
      option.textContent = stakeholder.name
      projectStakeholderSelect.appendChild(option)
    })
  }
}

function filterTasks() {
  loadBacklogTasks()
}

function truncateText(text, maxLength) {
  if (!text) return ""
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
}

// Close modals when clicking outside
window.onclick = (event) => {
  if (event.target.classList.contains("modal")) {
    event.target.classList.remove("active")
  }

  // Close status dropdowns when clicking outside
  if (
    !event.target.closest(".status-change") &&
    !event.target.closest(".followup-status-change") &&
    !event.target.closest(".universal-status-dropdown")
  ) {
    document
      .querySelectorAll(".status-dropdown, .followup-status-dropdown, .universal-status-dropdown")
      .forEach((dropdown) => {
        dropdown.classList.remove("show")
      })
  }
}

// Make functions available globally
window.switchTab = switchTab
window.switchTaskTab = switchTaskTab
window.openModal = openModal
window.closeModal = closeModal
window.saveTask = saveTask
window.editTask = editTask
window.viewTaskDetails = viewTaskDetails
window.deleteTask = deleteTask
window.changeTaskStatus = changeTaskStatus
window.toggleStatusDropdown = toggleStatusDropdown
window.saveProject = saveProject
window.editProject = editProject
window.viewProjectDetails = viewProjectDetails
window.deleteProject = deleteProject
window.saveStakeholder = saveStakeholder
window.editStakeholder = editStakeholder
window.viewStakeholderDetails = viewStakeholderDetails
window.deleteStakeholder = deleteStakeholder
window.saveFollowup = saveFollowup
window.editFollowup = editFollowup
window.deleteFollowup = deleteFollowup
window.changeFollowupStatus = changeFollowupStatus
window.toggleFollowupStatusDropdown = toggleFollowupStatusDropdown
window.toggleProjectTasks = toggleProjectTasks
window.toggleStakeholderFollowups = toggleStakeholderFollowups
window.addAttachment = addAttachment
window.addProjectAttachment = addProjectAttachment
window.removeAttachmentItem = removeAttachmentItem
window.filterTasks = filterTasks
window.addFollowupToStakeholder = addFollowupToStakeholder

// Make new functions globally available
window.addSubtaskToTask = addSubtaskToTask
window.saveSubtask = saveSubtask
window.editSubtask = editSubtask
window.deleteSubtask = deleteSubtask
window.changeSubtaskStatus = changeSubtaskStatus
window.toggleSubtasks = toggleSubtasks
window.switchProjectTab = switchProjectTab
window.filterAndLoadProjects = filterAndLoadProjects
window.toggleUniversalStatusDropdown = toggleUniversalStatusDropdown
window.changeItemStatus = changeItemStatus

// Make knowledge functions globally available
window.saveKnowledge = saveKnowledge
window.editKnowledge = editKnowledge
window.viewKnowledgeDetails = viewKnowledgeDetails
window.deleteKnowledge = deleteKnowledge
window.switchKnowledgeTab = switchKnowledgeTab
window.filterAndLoadKnowledge = filterAndLoadKnowledge
window.addKnowledgeAttachment = addKnowledgeAttachment

// Knowledge Base functions
async function saveKnowledge(event) {
  event.preventDefault()

  try {
    const knowledgeAttachmentsList = document.getElementById("knowledge-attachments-list")
    const attachments = []

    // Get all attachment items
    knowledgeAttachmentsList.querySelectorAll(".attachment-item").forEach((item) => {
      attachments.push({
        type: item.dataset.type,
        value: item.dataset.value,
        name: item.dataset.name,
      })
    })

    const knowledgeData = {
      title: document.getElementById("knowledge-title").value,
      content: document.getElementById("knowledge-content").value,
      category: document.getElementById("knowledge-category").value,
      tags: document.getElementById("knowledge-tags").value,
      attachments: attachments,
    }

    if (currentEditingKnowledge) {
      await saveToFirebase("knowledge", knowledgeData, currentEditingKnowledge.id)
      showSuccess("Knowledge entry updated successfully")
    } else {
      await saveToFirebase("knowledge", knowledgeData)
      showSuccess("Knowledge entry created successfully")
    }

    closeModal("knowledgeModal")
  } catch (error) {
    console.error("Error saving knowledge entry:", error)
  }
}

function editKnowledge(knowledgeId) {
  const knowledge = knowledgeEntries.find((k) => k.id === knowledgeId)
  if (!knowledge) return

  currentEditingKnowledge = knowledge

  document.getElementById("knowledge-title").value = knowledge.title
  document.getElementById("knowledge-content").value = knowledge.content
  document.getElementById("knowledge-category").value = knowledge.category
  document.getElementById("knowledge-tags").value = knowledge.tags
  document.getElementById("knowledge-modal-title").textContent = "Edit Knowledge Entry"

  // Load attachments
  const attachmentsList = document.getElementById("knowledge-attachments-list")
  attachmentsList.innerHTML = ""

  if (knowledge.attachments && knowledge.attachments.length > 0) {
    knowledge.attachments.forEach((attachment) => {
      const attachmentItem = document.createElement("div")
      attachmentItem.className = "attachment-item"
      attachmentItem.dataset.type = attachment.type
      attachmentItem.dataset.value = attachment.value
      attachmentItem.dataset.name = attachment.name

      const icon = attachment.type === "url" ? "fa-link" : "fa-file"
      const displayName = attachment.name || truncateText(attachment.value, 25)

      attachmentItem.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${displayName}</span>
        <button type="button" onclick="removeAttachmentItem(this)">
          <i class="fas fa-times"></i>
        </button>
      `

      attachmentsList.appendChild(attachmentItem)
    })
  }

  openModal("knowledgeModal")
}

function viewKnowledgeDetails(knowledgeId) {
  const knowledge = knowledgeEntries.find((k) => k.id === knowledgeId)
  if (!knowledge) return

  currentViewingKnowledge = knowledge

  const createdDate = new Date(knowledge.createdAt).toLocaleDateString()

  const detailsContent = document.getElementById("knowledge-details-content")

  let attachmentsHtml = ""
  if (knowledge.attachments && knowledge.attachments.length > 0) {
    attachmentsHtml = `
      <div class="details-section">
        <h4>Attachments</h4>
        <div class="details-content">
          ${knowledge.attachments
            .map((att) => {
              const icon = att.type === "url" ? "fa-link" : "fa-file"
              return `
              <div class="attachment-item">
                <i class="fas ${icon}"></i>
                <a href="${att.value}" target="_blank">${truncateText(att.name || att.value, 40)}</a>
              </div>
            `
            })
            .join("")}
        </div>
      </div>
    `
  }

  detailsContent.innerHTML = `
    <div class="details-section">
      <h4>Basic Information</h4>
      <div class="details-content">
        <div class="details-row">
          <div class="details-label">Title:</div>
          <div class="details-value">${knowledge.title}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Category:</div>
          <div class="details-value">${knowledge.category}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Tags:</div>
          <div class="details-value">${knowledge.tags}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Created:</div>
          <div class="details-value">${createdDate}</div>
        </div>
      </div>
    </div>
    
    ${
      knowledge.content
        ? `
    <div class="details-section">
      <h4>Content</h4>
      <div class="details-content">
        <p>${knowledge.content}</p>
      </div>
    </div>
    `
        : ""
    }
    
    ${attachmentsHtml}
  `

  document.getElementById("knowledge-details-title").textContent = knowledge.title
  document.getElementById("edit-knowledge-btn").onclick = () => {
    closeModal("knowledgeDetailsModal")
    editKnowledge(knowledge.id)
  }

  openModal("knowledgeDetailsModal")
}

async function deleteKnowledge(knowledgeId) {
  if (confirm("Are you sure you want to delete this knowledge entry?")) {
    try {
      await deleteFromFirebase("knowledge", knowledgeId)
    } catch (error) {
      console.error("Error deleting knowledge entry:", error)
    }
  }
}

// Knowledge management functions
function switchKnowledgeTab(tabName) {
  currentKnowledgeTab = tabName

  // Update tab buttons
  document.querySelectorAll(".knowledge-tabs .tab-btn").forEach((btn) => btn.classList.remove("active"))
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

  // Load knowledge for the selected tab
  loadKnowledgeWithFilters()
}

function loadKnowledgeWithFilters() {
  const container = document.getElementById("knowledge-container")
  const filteredKnowledge = getFilteredKnowledge()

  updateKnowledgeTabCounts()

  if (filteredKnowledge.length === 0) {
    container.innerHTML = createKnowledgeEmptyState()
    return
  }

  container.innerHTML = filteredKnowledge.map((knowledge) => createKnowledgeCard(knowledge)).join("")
}

function getFilteredKnowledge() {
  let filteredKnowledge = [...knowledgeEntries]

  // Filter by tab
  if (currentKnowledgeTab !== "all") {
    filteredKnowledge = filteredKnowledge.filter((knowledge) => knowledge.category === currentKnowledgeTab)
  }

  // Apply additional filters
  const searchFilter = document.getElementById("knowledge-search-filter").value.toLowerCase()

  if (searchFilter) {
    filteredKnowledge = filteredKnowledge.filter(
      (knowledge) =>
        knowledge.title.toLowerCase().includes(searchFilter) ||
        (knowledge.content && knowledge.content.toLowerCase().includes(searchFilter)) ||
        (knowledge.tags && knowledge.tags.toLowerCase().includes(searchFilter)),
    )
  }

  return filteredKnowledge
}

function updateKnowledgeTabCounts() {
  const allKnowledge = knowledgeEntries.length
  const howToKnowledge = knowledgeEntries.filter((k) => k.category === "how-to").length
  const faqKnowledge = knowledgeEntries.filter((k) => k.category === "faq").length
  const referenceKnowledge = knowledgeEntries.filter((k) => k.category === "reference").length
  const troubleshootingKnowledge = knowledgeEntries.filter((k) => k.category === "troubleshooting").length

  const allKnowledgeElement = document.getElementById("all-knowledge-count")
  const howToKnowledgeElement = document.getElementById("how-to-knowledge-count")
  const faqKnowledgeElement = document.getElementById("faq-knowledge-count")
  const referenceKnowledgeElement = document.getElementById("reference-knowledge-count")
  const troubleshootingKnowledgeElement = document.getElementById("troubleshooting-knowledge-count")

  if (allKnowledgeElement) allKnowledgeElement.textContent = allKnowledge
  if (howToKnowledgeElement) howToKnowledgeElement.textContent = howToKnowledge
  if (faqKnowledgeElement) faqKnowledgeElement.textContent = faqKnowledge
  if (referenceKnowledgeElement) referenceKnowledgeElement.textContent = referenceKnowledge
  if (troubleshootingKnowledgeElement) troubleshootingKnowledgeElement.textContent = troubleshootingKnowledge
}

function filterAndLoadKnowledge() {
  loadKnowledgeWithFilters()
}

function createKnowledgeEmptyState() {
  const messages = {
    all: "No knowledge entries found",
    "how-to": "No how-to guides found",
    faq: "No FAQs found",
    reference: "No reference materials found",
    troubleshooting: "No troubleshooting guides found",
  }

  return `
    <div class="empty-state">
      <i class="fas fa-book-open"></i>
      <p>${messages[currentKnowledgeTab]}</p>
      <button class="btn btn-primary" onclick="openModal('knowledgeModal')">Create New Knowledge Entry</button>
    </div>
  `
}

function createKnowledgeCard(knowledge) {
  const hasAttachments = knowledge.attachments && knowledge.attachments.length > 0

  return `
    <div class="knowledge-card">
      <div class="knowledge-header">
        <div class="knowledge-title">${knowledge.title}</div>
        <div class="knowledge-category">${knowledge.category.replace("-", " ").toUpperCase()}</div>
      </div>
      
      <div class="knowledge-content">${truncateText(knowledge.content, 150)}</div>
      
      ${knowledge.tags ? `<div class="knowledge-tags"><i class="fas fa-tags"></i> ${knowledge.tags}</div>` : ""}
      ${hasAttachments ? `<div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-secondary);"><i class="fas fa-paperclip"></i> ${knowledge.attachments.length} attachment${knowledge.attachments.length !== 1 ? "s" : ""}</div>` : ""}
      
      <div class="task-actions">
        <button class="btn-view" onclick="viewKnowledgeDetails('${knowledge.id}')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn-edit" onclick="editKnowledge('${knowledge.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteKnowledge('${knowledge.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `
}

function populateKnowledgeSelects() {
  const knowledgeCategorySelect = document.getElementById("knowledge-category")
  if (knowledgeCategorySelect) {
    knowledgeCategorySelect.innerHTML = `
      <option value="how-to">How-To</option>
      <option value="faq">FAQ</option>
      <option value="reference">Reference</option>
      <option value="troubleshooting">Troubleshooting</option>
    `
  }
}

function addKnowledgeAttachment(type) {
  const nameInputId = type === "url" ? "knowledge-attachment-name" : "knowledge-attachment-name-doc"
  const inputId = type === "url" ? "knowledge-url" : "knowledge-document"
  const nameInput = document.getElementById(nameInputId)
  const input = document.getElementById(inputId)
  const name = nameInput.value.trim()
  const value = input.value.trim()

  if (!value) return

  const attachmentsList = document.getElementById("knowledge-attachments-list")
  const attachmentItem = document.createElement("div")
  attachmentItem.className = "attachment-item"
  attachmentItem.dataset.type = type
  attachmentItem.dataset.value = value
  attachmentItem.dataset.name = name || value

  const icon = type === "url" ? "fa-link" : "fa-file"
  const displayName = name || truncateText(value, 25)

  attachmentItem.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${displayName}</span>
    <button type="button" onclick="removeAttachmentItem(this)">
      <i class="fas fa-times"></i>
    </button>
  `

  attachmentsList.appendChild(attachmentItem)
  nameInput.value = ""
  input.value = ""
}
