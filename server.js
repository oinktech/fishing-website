const express = require('express');
const dotenv = require('dotenv');
const basicAuth = require('basic-auth');
const moment = require('moment');  // 用於時間戳
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
        return res.status(401).send('存取被拒絕，請提供正確的帳號和密碼');
    }
    adminLoginRecords.push({
        ip: req.ip,
        time: moment().format('YYYY-MM-DD HH:mm:ss')
    });
    next();
}

// 錯誤處理中介函數
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('伺服器內部錯誤，請稍後再試。');
});

// 獲取用戶IP，並儲存
app.use((req, res, next) => {
    const userIP = req.ip;
    const visitCount = ipVisitCount[userIP] || 0;

    if (visitCount >= process.env.MAX_VISITS_PER_IP) {
        return res.status(429).send('此 IP 訪問次數過多，請稍後再試。');
    }

    ipVisitCount[userIP] = visitCount + 1;

    if (!userIPs.find(record => record.ip === userIP)) {
        userIPs.push({ ip: userIP, time: moment().format('YYYY-MM-DD HH:mm:ss') });
    }
    next();
});

// 根目錄首頁
app.get('/', (req, res) => {
    res.send('歡迎來到網站。您的 IP 已被記錄。');
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
            body { font-family: Arial, sans-serif; background-color: #f0f0f0; }
            .container { width: 80%; margin: auto; }
            h1 { color: #333; text-align: center; animation: fadeIn 1s; }
            ul { list-style-type: none; padding: 0; }
            li { background-color: #f9f9f9; margin: 5px 0; padding: 10px; border-radius: 5px; }
            form { text-align: center; margin-bottom: 20px; }
            button, input { padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
            .pagination { display: flex; justify-content: center; }
            .pagination a { margin: 0 5px; padding: 5px 10px; background-color: #00bfff; color: white; text-decoration: none; border-radius: 5px; }
            .pagination a.active { background-color: #333; }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(20px); }
                to { transform: translateY(0); }
            }
            li { animation: slideIn 0.5s; }
        </style>

        <div class="container">
            <h1>管理頁面</h1>
            <form action="/admin" method="GET">
                <input type="text" name="search" placeholder="搜尋 IP 或時間" value="${search}">
                <button type="submit">查詢</button>
            </form>
            <p>記錄的 IP 地址 (第 ${page} 頁，共 ${totalPages} 頁)：</p>
            <ul>${ipListHtml}</ul>
            
            <div class="pagination">
                ${Array.from({ length: totalPages }, (v, k) => k + 1).map(i => `
                    <a href="/admin?page=${i}&search=${search}" class="${i === page ? 'active' : ''}">${i}</a>
                `).join('')}
            </div>

            <h2>登入紀錄</h2>
            <ul>${adminLoginsHtml}</ul>

            <form action="/admin/clear" method="POST">
                <button type="submit">清除 IP 紀錄</button>
            </form>
        </div>
    `);
});

// 清除 IP 記錄
app.post('/admin/clear', auth, (req, res) => {
    userIPs = [];
    res.redirect('/admin');
});

// 錯誤處理頁面
app.use((req, res, next) => {
    res.status(404).send('找不到頁面，請確認網址是否正確。');
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器正在運行，請訪問：http://localhost:${port}`);
});
