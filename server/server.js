import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { COURSES_DATA, generateCourseSystemPrompt } from '../src/coursesData.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;

// Configuração de conexão PostgreSQL (Render Cloud com SSL)
const pool = new Pool({
  host: process.env.PGHOST || 'dpg-da6gej942hec73d10fa0-a.oregon-postgres.render.com',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'vixertst',
  user: process.env.PGUSER || 'vixertst_user',
  password: process.env.PGPASSWORD || '6or1kOJXLiH5IdubuuqYa8Yx89xnC6Yf',
  ssl: {
    rejectUnauthorized: false
  }
});

// Criptografia de Senha (SHA-256 com Sal de 16 bytes)
function hashPassword(password, saltHex = null) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return { hash, salt };
}

// Inicializar Tabela de Usuários no PostgreSQL
async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('Conectado com sucesso ao Banco de Dados PostgreSQL (vixertst)!');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        course VARCHAR(255) NOT NULL,
        system_prompt TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log('Tabela "users" verificada/criada no PostgreSQL.');
    client.release();
  } catch (err) {
    console.error('Erro ao conectar ou criar tabela no PostgreSQL:', err.message);
  }
}

// Rotas da API

// Healthcheck
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Registrar Usuário no PostgreSQL
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, type, course } = req.body;

    if (!name || !email || !password || !type || !course) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verificar e-mail existente
    const checkQuery = 'SELECT id FROM users WHERE LOWER(email) = $1';
    const checkRes = await pool.query(checkQuery, [normalizedEmail]);

    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe uma conta com este e-mail.' });
    }

    // Criptografar Senha
    const { hash, salt } = hashPassword(password);
    const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const systemPrompt = generateCourseSystemPrompt(name, type, course);

    const insertQuery = `
      INSERT INTO users (id, name, email, password_hash, salt, type, course, system_prompt)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, type, course, system_prompt, created_at;
    `;

    const result = await pool.query(insertQuery, [
      userId,
      name.trim(),
      normalizedEmail,
      hash,
      salt,
      type,
      course,
      systemPrompt
    ]);

    const user = result.rows[0];
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro interno ao salvar no banco de dados.' });
  }
});

// Login de Usuário
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe o e-mail e a senha.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const query = 'SELECT * FROM users WHERE LOWER(email) = $1';
    const result = await pool.query(query, [normalizedEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const user = result.rows[0];
    const { hash } = hashPassword(password, user.salt);

    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      type: user.type,
      course: user.course,
      systemPrompt: user.system_prompt,
      createdAt: user.created_at
    };

    res.json({ message: 'Login realizado com sucesso!', user: safeUser });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno no servidor de banco de dados.' });
  }
});

// Atualizar Prompt do Sistema do Usuário
app.put('/api/user/prompt', async (req, res) => {
  try {
    const { userId, prompt } = req.body;
    if (!userId || !prompt) {
      return res.status(400).json({ error: 'Dados insuficientes.' });
    }

    const updateQuery = 'UPDATE users SET system_prompt = $1 WHERE id = $2 RETURNING id, system_prompt';
    const result = await pool.query(updateQuery, [prompt, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ message: 'Prompt atualizado no banco de dados!', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Servidor Backend rodando na porta ${PORT}`);
  await initDatabase();
});
