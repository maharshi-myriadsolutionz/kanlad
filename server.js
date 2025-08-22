const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Open DB
const db = new sqlite3.Database("trello.db");

// Helper functions to use Promises
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID });
    });
  });

// Init DB
db.serialize(async () => {
  db.run(`CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY,
    title TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT,
    status INTEGER,
    position INTEGER,
    description TEXT
  )`);

  const row = await dbGet("SELECT COUNT(*) as count FROM columns");
  if (row.count === 0) {
    await dbRun("INSERT INTO columns (title) VALUES (?)", ["Todo"]);
  }
});

// Routes
app.get("/board", async (req, res) => {
  try {
    const columns = await dbAll("SELECT * FROM columns ORDER BY id");
    const tasks = await dbAll("SELECT * FROM tasks ORDER BY position");

    console.log("Columns:", columns);
    console.log("Tasks:", tasks);

    res.json({ columns, tasks });
  } catch (err) {
    console.error("Error in /board route:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/columns", async (req, res) => {
  try {
    const { title } = req.body;
    const result = await dbRun("INSERT INTO columns (title) VALUES (?)", [
      title,
    ]);
    res.json({ id: result.lastID, title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { title, status } = req.body;
    const row = await dbGet(
      "SELECT MAX(position) as maxPos FROM tasks WHERE status = ?",
      [status]
    );
    const position = row && row.maxPos !== null ? row.maxPos + 1 : 0;
    const result = await dbRun(
      "INSERT INTO tasks (title, status, position) VALUES (?, ?, ?)",
      [title, status, position]
    );
    res.json({ id: result.lastID, title, status, position });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tasks/move", async (req, res) => {
  try {
    const { id, status, position } = req.body;
    await dbRun("UPDATE tasks SET status = ?, position = ? WHERE id = ?", [
      status,
      position,
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tasks/rename", async (req, res) => {
  try {
    const { id, title } = req.body;
    await dbRun("UPDATE tasks SET title = ? WHERE id = ?", [title, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete all tasks in a column
app.delete("/columns/:id/tasks", async (req, res) => {
  try {
    const colId = req.params.id;
    await dbRun("DELETE FROM tasks WHERE status = ?", [colId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete the column
app.delete("/columns/:id", async (req, res) => {
  try {
    const colId = req.params.id;
    await dbRun("DELETE FROM columns WHERE id = ?", [colId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/tasks/description", (req, res) => {
  const { id, description } = req.body;
  db.run(
    "UPDATE tasks SET description = ? WHERE id = ?",
    [description, id],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));
