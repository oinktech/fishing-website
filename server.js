const express = require('express');
const dotenv = require('dotenv');
const basicAuth = require('basic-auth');

// 加载 .env 文件中的配置
dotenv.config();

const app = express();
const port = 3000;
let userIPs = [];

// 中介函數：用來檢查用戶是否已登入
function auth(req, res, next) {
    const user = basicAuth(req);
    if (!user || user.name !== process.env.ADMIN_USERNAME || user.pass !== process.env.ADMIN_PASSWORD) {
        res.set('WWW-Authenticate', 'Basic realm="admin"');
        return res.status(401).send('Access denied');
    }
    next();
}

// 獲取用戶IP，並儲存
app.use((req, res, next) => {
    const userIP = req.ip;
    if (!userIPs.includes(userIP)) {
        userIPs.push(userIP);
    }
    next();
});

// 根目錄首頁
app.get('/', (req, res) => {
    res.send('Welcome to the website. Your IP has been recorded.');
});

// /admin 路徑，需要身份驗證
app.get('/admin', auth, (req, res) => {
    res.send(`<h1>Admin Page</h1><p>Recorded IPs:</p><ul>${userIPs.map(ip => `<li>${ip}</li>`).join('')}</ul>`);
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
