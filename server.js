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
const ipVisitCount = {}; // 記錄每個 IP 的訪問次數

// 中介函數：用來檢查用戶是否已登入
function auth(req, res, next) {
    const user = basicAuth(req);
    if (!user || user.name !== process.env.ADMIN_USERNAME || user.pass !== process.env.ADMIN_PASSWORD) {
        res.set('WWW-Authenticate', 'Basic realm="admin"');
        return res.status(401).send('Access denied');
    }
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

// /admin 路徑，需要身份驗證，並包含分頁和查詢功能
app.get('/admin', auth, (req, res) => {
    const page = parseInt(req.query.page) || 1; // 頁碼
    const limit = 10; // 每頁顯示數量
    const search = req.query.search || ''; // 查詢條件
    const filteredIPs = userIPs.filter(record => 
        record.ip.includes(search) || record.time.includes(search)
    );
    const totalPages = Math.ceil(filteredIPs.length / limit);
    const start = (page - 1) * limit;
    const paginatedIPs = filteredIPs.slice(start, start + limit);

    let ipListHtml = paginatedIPs.map(record => `<li>${record.ip} - ${record.time}</li>`).join('');
    let adminLoginsHtml = adminLoginRecords.map(record => `<li>${record.ip} - ${record.time}</li>`).join('');
    
    res.send(`
        <style>
            body { font-family: Arial, sans-serif; }
            .container { width: 80%; margin: auto; }
            h1 { color: #333; text-align: center; }
            ul { list-style-type: none; padding: 0; }
            li { background-color: #f9f9f9; margin: 5px 0; padding: 10px; border-radius: 5px; }
            form { text-align: center; margin-bottom: 20px; }
            button, input { padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
            .pagination { display: flex; justify-content: center; }
            .pagination a { margin: 0 5px; padding: 5px 10px; background-color: #00bfff; color: white; text-decoration: none; }
            .pagination a.active { background-color: #333; }
        </style>

        <div class="container">
            <h1>Admin Page</h1>
            <form action="/admin" method="GET">
                <input type="text" name="search" placeholder="Search by IP or Time" value="${search}">
                <button type="submit">Search</button>
            </form>
            <p>Recorded IPs (Page ${page} of ${totalPages}):</p>
            <ul>${ipListHtml}</ul>
            
            <div class="pagination">
                ${Array.from({ length: totalPages }, (v, k) => k + 1).map(i => `
                    <a href="/admin?page=${i}&search=${search}" class="${i === page ? 'active' : ''}">${i}</a>
                `).join('')}
            </div>

            <h2>Admin Login Records</h2>
            <ul>${adminLoginsHtml}</ul>

            <form action="/admin/clear" method="POST">
                <button type="submit">Clear IP Records</button>
            </form>
        </div>
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
