require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const multer = require('multer');
const _ = require('lodash');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;


// Configuração do Multer (Vulnerável)
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage: storage });

// VULNERABILIDADE: Conexão com o banco usando Pool do pg.
// O Pool gerencia múltiplas conexões, o que é melhor para apps web.
const pool = new Pool({
  // Mapeamento das suas variáveis de ambiente
    host: process.env.BD_HOST,
    port: process.env.BD_PORT,
    database: process.env.BD_DATABASE,
    user: process.env.BD_USERNAME,
    password: process.env.BD_PASSWORD,

    // Configuração do SSL para usar o certificado
   ssl: {
    rejectUnauthorized: process.env.BD_REJEC,
    ca: process.env.BD_CA,
 },
});

// Configuração do Express
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: 'um-segredo-muito-fraco',
  resave: false,
  saveUninitialized: true,
}));

// VULNERABILIDADE 4: Exposição de Dados Sensíveis
const Maps_API_KEY = "AIzaSyCh...FAKE_KEY...87nHw";

// Rotas
app.get('/', async (req, res) => {
  const commentsResult = await pool.query("SELECT * FROM comments");
  const usersResult = await pool.query("SELECT * FROM users");
  res.render('index', { comments: commentsResult.rows, users: usersResult.rows, searchResults: null });
});

// VULNERABILIDADE 1: Cross-Site Scripting (XSS)
app.post('/comment', async (req, res) => {
  const { content, author } = req.body;
  await pool.query("INSERT INTO comments (content, author) VALUES ($1, $2)", [content, author || 'Anônimo']);
  res.redirect('/');
});

// VULNERABILIDADE 2: Injeção de SQL (SQLi)
app.get('/search', async (req, res) => {
  const term = req.query.term;
  const query = `SELECT * FROM users WHERE username LIKE '%${term}%'`; // Concatenação direta!
  const searchResults = await pool.query(query);
  const commentsResult = await pool.query("SELECT * FROM comments");
  res.render('index', { comments: commentsResult.rows, users: [], searchResults: searchResults.rows });
});

// VULNERABILIDADE 5: Quebra de Autenticação
app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const result = await pool.query(query);
  const user = result.rows[0];

  // console.log("password",user.password)
  // console.log(password) 

  // if(!user.password == password) res.send('Login falhou.')

  if (user) {
    req.session.user = user;
    res.redirect(`/profile/${user.id}`);
  } else {
    res.send('Login falhou.');
  }
});

// VULNERABILIDADE 6: Controle de Acesso Quebrado (IDOR)
app.get('/profile/:id', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const id = req.params.id;
  const result = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [id]);
  const profile = result.rows[0];
  if (profile) {
    res.render('profile', { profile, currentUser: req.session.user });
  } else {
    res.send('Perfil não encontrado.');
  }
});

// VULNERABILIDADE 7: Cross-Site Request Forgery (CSRF)
app.post('/change-email', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Não autorizado');
    const { new_email } = req.body;
    await pool.query("UPDATE users SET email = $1 WHERE id = $2", [new_email, req.session.user.id]);
    res.redirect(`/profile/${req.session.user.id}`);
});

// VULNERABILIDADE 9: Upload de Arquivos Maliciosos
app.post('/upload', upload.single('profile_pic'), (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.send(`Arquivo ${req.file.originalname} enviado! <a href="/profile/${req.session.user.id}">Voltar</a>`);
});

// Rota de Admin
app.get('/admin', (req, res) => {
  if (req.session.user && req.session.user.isAdmin) {
    res.render('admin');
  } else {
    res.status(403).send('Acesso negado.');
  }
});

// VULNERABILIDADE 8: Injeção de Comando do SO
app.post('/admin/ping', (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Acesso negado.');
  const host = req.body.host;
  exec(`ping -c 1 ${host}`, (error, stdout, stderr) => {
    res.send(`<pre>${stdout || stderr}</pre>`);
  });
});

// VULNERABILIDADE 10: Poluição de Protótipo
app.post('/api/prefs', (req, res) => {
    let userPrefs = {};
    _.merge(userPrefs, req.body);
    if (userPrefs.isAdmin) {
        res.send("Você foi promovido a admin! (Potencialmente)");
    } else {
        res.send("Preferências recebidas.");
    }
});

app.listen(PORT, () => console.log(`Servidor VulnerableClass (PostgreSQL) rodando em http://localhost:${PORT}`));