require('dotenv').config();


const { Client } = require('pg');

const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    isAdmin BOOLEAN DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    author TEXT
  );
`;

const insertDataQuery = `
  INSERT INTO users (username, password, email, isAdmin) VALUES
    ('alice', 'password123', 'alice@email.com', TRUE),
    ('bob', 'bobspassword', 'bob@email.com', FALSE)
  ON CONFLICT (username) DO NOTHING;

  INSERT INTO comments (content, author) VALUES
    ('Bem-vindo ao VulnerableClass com PostgreSQL!', 'Admin')
  ON CONFLICT DO NOTHING;
`;

async function initializeDb() {
  const client = new Client({
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

  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL!');

    console.log('Criando tabelas...');
    await client.query(createTablesQuery);
    console.log('Tabelas criadas com sucesso (ou já existiam).');

    console.log('Populando dados...');
    await client.query(insertDataQuery);
    console.log('Dados inseridos com sucesso.');

  } catch (err) {
    console.error('Erro durante a inicialização do banco de dados:', err);
  } finally {
    await client.end();
    console.log('Conexão com o banco de dados fechada.');
  }
}

initializeDb();