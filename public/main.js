let boardData = { columns: [], tasks: [] };

async function loadBoard() {
  const res = await fetch("/board");
  boardData = await res.json();
  renderBoard();
}

function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  boardData.columns.forEach((col) => {
    const columnEl = document.createElement("div");
    columnEl.className = "bg-zinc-900 rounded-xl flex flex-col p-5";
    columnEl.style.width = "340px";
    columnEl.innerHTML = `
            <div class="flex justify-between items-center mb-3 ">
              <h3 class="text-lg font-semibold">${col.title}</h3>
              <button onclick="deleteColumn(${col.id})" class="text-red-500 hover:text-red-400 text-sm">✕</button>
            </div>
            <ul id="col-${col.id}" class="column flex-1 min-h-[300px] space-y-3 p-1" data-col="${col.id}"></ul>
            <input id="newTask-${col.id}" placeholder="New task" 
                  class="mt-3 rounded bg-zinc-800 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <button onclick="addTask(${col.id})" 
                    class="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded px-3 py-2 text-sm">Add</button>
          `;
    board.appendChild(columnEl);

    const tasks = boardData.tasks.filter((t) => t.status === col.id);
    tasks.forEach((task) => addTaskToColumn(task, col.id));

    new Sortable(columnEl.querySelector(".column"), {
      group: "shared",
      animation: 200,
      handle: ".handle",
      ghostClass: "opacity-40",
      chosenClass: "bg-zinc-600",
      onEnd: async (evt) => {
        const items = [...evt.to.children];
        for (let i = 0; i < items.length; i++) {
          const id = items[i].dataset.id;
          const status = evt.to.dataset.col;
          await fetch("/tasks/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status, position: i }),
          });
        }
      },
    });
  });
}

async function deleteColumn(colId) {
  if (
    !confirm(
      "Are you sure you want to delete this column? All tasks inside will also be deleted."
    )
  )
    return;

  // First delete all tasks inside this column
  await fetch(`/columns/${colId}/tasks`, { method: "DELETE" });

  // Then delete the column itself
  await fetch(`/columns/${colId}`, { method: "DELETE" });

  // Remove from local board data and re-render
  boardData.columns = boardData.columns.filter((c) => c.id !== colId);
  boardData.tasks = boardData.tasks.filter((t) => t.status !== colId);
  renderBoard();
}

function addTaskToColumn(task, colId) {
  const li = document.createElement("li");
  li.className =
    "task flex justify-between items-center bg-zinc-800 rounded px-3 py-2 text-sm shadow hover:bg-zinc-700 transition";
  li.dataset.id = task.id;

  const titleSpan = document.createElement("span");
  titleSpan.textContent = task.title;
  titleSpan.className = "editable flex-1 cursor-pointer";
  titleSpan.onclick = () => startRenameTask(task.id, titleSpan);

  const handle = document.createElement("span");
  handle.className = "handle cursor-grab text-gray-400";
  handle.textContent = "☰";

  li.appendChild(titleSpan);
  li.appendChild(handle);
  document.getElementById(`col-${colId}`).appendChild(li);
}

async function addTask(colId) {
  const input = document.getElementById(`newTask-${colId}`);
  const title = input.value;
  if (!title) return;
  const res = await fetch("/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, status: colId }),
  });
  const task = await res.json();
  boardData.tasks.push(task);
  addTaskToColumn(task, colId);
  input.value = "";
}

// -------- Column Add Flow ----------
function showAddColumnForm() {
  document.getElementById("addColumnForm").classList.remove("hidden");
  document.getElementById("showAddColumnBtn").classList.add("hidden");
  document.getElementById("newColumnTitle").focus();
}

async function confirmAddColumn() {
  const title = document.getElementById("newColumnTitle").value;
  if (!title) return;
  const res = await fetch("/columns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const col = await res.json();
  boardData.columns.push(col);
  renderBoard();
  cancelAddColumn();
}

function cancelAddColumn() {
  document.getElementById("newColumnTitle").value = "";
  document.getElementById("addColumnForm").classList.add("hidden");
  document.getElementById("showAddColumnBtn").classList.remove("hidden");
}

// -------- Task Rename Flow ----------
function startRenameTask(id, spanEl) {
  const currentTitle = spanEl.textContent;
  const input = document.createElement("input");
  input.value = currentTitle;
  input.className =
    "w-full bg-zinc-700 text-gray-200 rounded px-2 py-1 text-sm focus:outline-none";
  spanEl.replaceWith(input);
  input.focus();

  input.addEventListener("blur", () => finishRenameTask(id, input));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finishRenameTask(id, input);
    if (e.key === "Escape") input.replaceWith(spanEl);
  });
}

async function finishRenameTask(id, inputEl) {
  const newTitle = inputEl.value.trim();
  if (!newTitle) return;
  await fetch("/tasks/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title: newTitle }),
  });
  const newSpan = document.createElement("span");
  newSpan.textContent = newTitle;
  newSpan.className = "editable flex-1 cursor-pointer";
  newSpan.onclick = () => startRenameTask(id, newSpan);
  inputEl.replaceWith(newSpan);
}

loadBoard();
