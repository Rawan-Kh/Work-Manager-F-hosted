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
      await Promise.all([loadAllProjects(), loadAllTasks(), loadAllStakeholders(), loadAllFollowups()])
  
      updateCounts()
      populateProjectSelects()
      populateStakeholderSelects()
  
      // Set up real-time listeners
      setupRealtimeListeners()
    } catch (error) {
      console.error("Error initializing app:", error)
      showError("Failed to initialize the application. Please refresh the page.")
    } finally {
      hideLoading()
    }
  })
  
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
          updatedAt: docData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        })
      })
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
          updatedAt: docData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        })
      })
      loadProjects()
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
          updatedAt: docData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
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
          updatedAt: docData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        })
      })
      loadStakeholders() // Reload stakeholders to update followup counts
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
  
  // Tab switching
  function switchTab(tabName) {
    // Remove active class from all tabs and sections
    document.querySelectorAll(".nav-item").forEach((tab) => tab.classList.remove("active"))
    document.querySelectorAll(".content-section").forEach((section) => section.classList.remove("active"))
  
    // Add active class to selected tab and section
    document.querySelector(`.nav-item[onclick="switchTab('${tabName}')"]`).classList.add("active")
    document.getElementById(tabName + "-section").classList.add("active")
  
    // Load appropriate content
    if (tabName === "today") {
      loadTodayTasks()
    } else if (tabName === "backlog") {
      loadBacklogTasks()
    } else if (tabName === "completed") {
      loadCompletedTasks()
    } else if (tabName === "projects") {
      loadProjects()
    } else if (tabName === "stakeholders") {
      loadStakeholders()
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
  
        const icon = attachment.type === "url" ? "fa-link" : "fa-file"
  
        attachmentItem.innerHTML = `
          <i class="fas ${icon}"></i>
          <span>${truncateText(attachment.value, 25)}</span>
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
                  <a href="${att.value}" target="_blank">${truncateText(att.value, 40)}</a>
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
  
        const icon = attachment.type === "url" ? "fa-link" : "fa-file"
  
        attachmentItem.innerHTML = `
          <i class="fas ${icon}"></i>
          <span>${truncateText(attachment.value, 25)}</span>
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
    const stakeholder = project.stakeholderId ? stakeholders.find((s) => s.id === project.stakeholderId) : null
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
                  <a href="${att.value}" target="_blank">${truncateText(att.value, 40)}</a>
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
    const stakeholder = project.stakeholderId ? stakeholders.find((s) => s.id === project.stakeholderId) : null
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
          <button class="btn-quick btn-add-followup" onclick="currentFollowupStakeholder = '${stakeholder.id}'; openModal('followupModal')">
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
        <div class="followups-list">
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
              </div>
            `,
            )
            .join("")}
          ${stakeholderFollowups.length > 3 ? `<div style="text-align: center; margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-text-secondary);">+${stakeholderFollowups.length - 3} more</div>` : ""}
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
    const inputId = type === "url" ? "task-url" : "task-document"
    const input = document.getElementById(inputId)
    const value = input.value.trim()
  
    if (!value) return
  
    const attachmentsList = document.getElementById("task-attachments-list")
    const attachmentItem = document.createElement("div")
    attachmentItem.className = "attachment-item"
    attachmentItem.dataset.type = type
    attachmentItem.dataset.value = value
  
    const icon = type === "url" ? "fa-link" : "fa-file"
  
    attachmentItem.innerHTML = `
      <i class="fas ${icon}"></i>
      <span>${truncateText(value, 25)}</span>
      <button type="button" onclick="removeAttachmentItem(this)">
        <i class="fas fa-times"></i>
      </button>
    `
  
    attachmentsList.appendChild(attachmentItem)
    input.value = ""
  }
  
  function addProjectAttachment(type) {
    const inputId = type === "url" ? "project-url" : "project-document"
    const input = document.getElementById(inputId)
    const value = input.value.trim()
  
    if (!value) return
  
    const attachmentsList = document.getElementById("project-attachments-list")
    const attachmentItem = document.createElement("div")
    attachmentItem.className = "attachment-item"
    attachmentItem.dataset.type = type
    attachmentItem.dataset.value = value
  
    const icon = type === "url" ? "fa-link" : "fa-file"
  
    attachmentItem.innerHTML = `
      <i class="fas ${icon}"></i>
      <span>${truncateText(value, 25)}</span>
      <button type="button" onclick="removeAttachmentItem(this)">
        <i class="fas fa-times"></i>
      </button>
    `
  
    attachmentsList.appendChild(attachmentItem)
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
    document.getElementById("today-count").textContent = `${todayTasks.length} task${todayTasks.length !== 1 ? "s" : ""}`
  
    const completedTasks = tasks.filter((task) => task.status === "completed")
    document.getElementById("completed-count").textContent =
      `${completedTasks.length} task${completedTasks.length !== 1 ? "s" : ""}`
  
    document.getElementById("project-count").textContent = `${projects.length} project${projects.length !== 1 ? "s" : ""}`
  
    document.getElementById("stakeholder-count").textContent =
      `${stakeholders.length} stakeholder${stakeholders.length !== 1 ? "s" : ""}`
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
    if (!event.target.closest(".status-change") && !event.target.closest(".followup-status-change")) {
      document.querySelectorAll(".status-dropdown, .followup-status-dropdown").forEach((dropdown) => {
        dropdown.classList.remove("show")
      })
    }
  }
  
  // Make functions available globally
  window.switchTab = switchTab
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
  