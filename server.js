const express = require('express');
const dotenv = require('dotenv');
const basicAuth = require('basic-auth');
const moment = require('moment');  // 用於時間戳

// 加载 .env 文件中的配置
dotenv.config();

const app = express();
const port = 3000;

let userIPs = [];
let adminLoginRecords = [];

// 記錄每個 IP 的訪問次數
const ipVisitCount = {};

// 中介函數：用來檢查用戶是否已登入
function auth(req, res, next) {
    const user = basicAuth(req);
    if (!user || user.name !== process.env.ADMIN_USERNAME || user.pass !== process.env.ADMIN_PASSWORD) {
        res.set('WWW-Authenticate', 'Basic realm="admin"');
        return res.status(401).send('Access denied');
    }
    // 記錄成功登入的時間和IP
    adminLoginRecords.push({
        ip: req.ip,
        time: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    next();
}

// 獲取用戶IP，並儲存
app.use((req, res, next) => {
    const userIP = req.ip;
    const visitCount = ipVisitCount[userIP] || 0;

    if (visitCount >= process.env.MAX_VISITS_PER_IP) {
        return res.status(429).send('Too many requests from this IP.');
    }

    ipVisitCount[userIP] = visitCount + 1;

    if (!userIPs.find(record => record.ip === userIP)) {
        userIPs.push({ ip: userIP, time: moment().format('YYYY-MM-DD HH:mm:ss') });
    }
    next();
});

// 根目錄首頁
app.get('/', (req, res) => {
    res.send('Welcome to the website. Your IP has been recorded.');
});

// /admin 路徑，需要身份驗證
app.get('/admin', auth, (req, res) => {
    let ipListHtml = userIPs.map(record => `<li>${record.ip} - ${record.time}</li>`).join('');
    let adminLoginsHtml = adminLoginRecords.map(record => `<li>${record.ip} - ${record.time}</li>`).join('');
    res.send(`
        <h1>Admin Page</h1>
        <p>Recorded IPs:</p>
        <ul>${ipListHtml}</ul>
        <h2>Admin Login Records</h2>
        <ul>${adminLoginsHtml}</ul>
        <form action="/admin/clear" method="POST">
            <button type="submit">Clear IP Records</button>
        </form>
    `);
});

// 清除 IP 記錄
app.post('/admin/clear', auth, (req, res) => {
    userIPs = [];
    res.redirect('/admin');
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
