const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// ตั้งค่า view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// เชื่อมฐานข้อมูล
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) console.error('❌ Database error:', err.message);
  else console.log('✅ Connected to database.db');
});

function getPoints(callback) {
  db.all(`SELECT DISTINCT stop_name AS point FROM stop ORDER BY stop_name`, [], (err, rows) => {
    if (err) callback(err, []);
    else callback(null, rows.map(r => r.point));
  });
}


// หน้าแรก
app.get('/', (req, res) => {
  getPoints((err, points) => {
    res.render('layout', { results: null, points });
  });
});

// 🔍 ค้นหาเส้นทางจากจุดจอด (stop-based search)
app.post('/search', (req, res) => {
  const { start_point, end_point } = req.body;

  const sql = `
    SELECT DISTINCT r.route_id, r.route_number, r.route_name, b.bus_number
    FROM route r
    JOIN bus b ON r.route_id = b.route_id
    WHERE r.route_id IN (
      SELECT s1.route_id
      FROM stop s1
      JOIN stop s2 ON s1.route_id = s2.route_id
      WHERE s1.stop_name LIKE ? AND s2.stop_name LIKE ?
    );
  `;

  db.all(sql, [`%${start_point}%`, `%${end_point}%`], (err, rows) => {
    if (err) {
      console.error(err);
      return res.send("❌ Error querying database");
    }

    // ดึงรายชื่อป้ายทั้งหมดมาเป็น dropdown
    db.all(`SELECT DISTINCT stop_name AS point FROM stop ORDER BY stop_name`, [], (e2, stops) => {
      const points = stops.map(s => s.point);
      res.render('layout', { results: rows || [], points });
    });
  });
});

// // ไปหน้า google map
app.get('/map', (req, res) => {
  res.render('map', { stops: [], routeInfo: {} });
});

// ดูเส้นทางทั้งหมด
app.get('/routes', (req, res) => {
  db.all(`SELECT * FROM route`, [], (err, routes) => {
    res.render('routes', { routes });
  });
});

// ดูจุดจอดของแต่ละสาย
app.get('/stops/:route_id', (req, res) => {
  const routeId = req.params.route_id;
  db.all(
    `SELECT stop_order, stop_name FROM stop WHERE route_id = ? ORDER BY stop_order`,
    [routeId],
    (err, stops) => {
      db.get(
        `SELECT route_number, route_name FROM route WHERE route_id = ?`,
        [routeId],
        (err2, routeInfo) => {
          res.render('stops', { stops, routeInfo });
        }
      );
    }
  );
});

app.listen(PORT, () => console.log(`🚍 Server running at http://localhost:${PORT}`));