// ==================== BACKEND EMPREENDA.JÁ (PostgreSQL) ====================

import express from "express";
import cors from "cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import multer from "multer";
import path from "path";
import fs from "fs";
import archiver from "archiver";

const app = express();

app.use(
  cors({
    origin: [
      "https://empreenda-ja.vercel.app",
      "http://localhost:5500"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const SECRET = process.env.JWT_SECRET || "0000";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function dbQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// ==================== SEED INICIAL ====================
async function seed() {
  const senhaMaster = bcrypt.hashSync("senhamaster123", 10);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS professores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      usuario TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT CHECK (tipo IN ('professor', 'master')) NOT NULL DEFAULT 'professor',
      precisa_trocar_senha BOOLEAN DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      professor_id INTEGER REFERENCES professores(id) ON DELETE SET NULL,
      acao TEXT NOT NULL,
      detalhe TEXT,
      data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS frequencias (
      id SERIAL PRIMARY KEY,
      professor_id INTEGER REFERENCES professores(id) ON DELETE SET NULL,
      professor_nome TEXT,
      turma TEXT,
      data TEXT NOT NULL,
      alunos TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    INSERT INTO professores (nome, usuario, senha, tipo, precisa_trocar_senha)
    VALUES ('Administrador', 'master', $1, 'master', TRUE)
    ON CONFLICT (usuario) DO NOTHING;
  `, [senhaMaster]);

  console.log("✅ Banco inicializado com tabelas e usuário master.");
}

// ==================== LOGS ====================
async function registrarLog(professorId, acao, detalhe = "") {
  try {
    await dbQuery(
      `INSERT INTO logs (professor_id, acao, detalhe) VALUES ($1, $2, $3)`,
      [professorId, acao, detalhe]
    );
  } catch (e) {
    console.error("Erro ao registrar log:", e);
  }
}

// ==================== AUTENTICAÇÃO ====================
function autenticar(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ erro: "Token ausente" });

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido" });
  }
}

// ==================== LOGIN ====================
app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha)
    return res.status(400).json({ erro: "Informe usuário e senha" });

  try {
    const result = await dbQuery("SELECT * FROM professores WHERE usuario = $1", [usuario]);
    const user = result[0];
    if (!user) return res.status(401).json({ erro: "Usuário não encontrado" });

    const senhaOk = bcrypt.compareSync(senha, user.senha);
    if (!senhaOk) return res.status(401).json({ erro: "Senha incorreta" });

    const token = jwt.sign(
      { id: user.id, tipo: user.tipo, nome: user.nome, precisaTrocar: user.precisa_trocar_senha },
      SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      nome: user.nome,
      tipo: user.tipo,
      precisaTrocar: user.precisa_trocar_senha
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro no login" });
  }
});

// ==================== ALTERAR SENHA ====================
app.put("/api/alterar-senha", autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha)
    return res.status(400).json({ erro: "Preencha todos os campos." });

  try {
    const result = await dbQuery("SELECT * FROM professores WHERE id = $1", [req.user.id]);
    const user = result[0];
    if (!user) return res.status(404).json({ erro: "Usuário não encontrado." });

    const senhaCorreta = bcrypt.compareSync(senhaAtual, user.senha);
    if (!senhaCorreta) return res.status(401).json({ erro: "Senha atual incorreta." });

    const novaHash = bcrypt.hashSync(novaSenha, 10);
    await dbQuery(`
      UPDATE professores 
      SET senha = $1, precisa_trocar_senha = FALSE 
      WHERE id = $2
    `, [novaHash, req.user.id]);

    await registrarLog(req.user.id, "Alteração de senha");
    res.json({ mensagem: "Senha alterada com sucesso." });
  } catch (e) {
    console.error("Erro ao alterar senha:", e);
    res.status(500).json({ erro: "Erro ao alterar senha." });
  }
});

// ==================== UPLOAD DE FREQUÊNCIA ====================
const uploadDir = "./uploads/frequencias";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nomeProf = req.user.nome
      .replace(/\s+/g, "_")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const data = new Date().toISOString().split("T")[0];
    cb(null, `Prof.${nomeProf}_${data}${ext}`);
  },
});
const upload = multer({ storage });

app.post("/api/frequencia/upload", autenticar, upload.single("arquivo"), async (req, res) => {
  try {
    const turma = req.body.turma || "—";
    const nomeArquivo = req.file.filename;
    const dataHoje = new Date().toISOString().split("T")[0];

    await dbQuery(
      `INSERT INTO frequencias (professor_id, professor_nome, turma, data, alunos)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, req.user.nome, turma, dataHoje, nomeArquivo]
    );

    await registrarLog(req.user.id, "Upload de frequência", nomeArquivo);
    res.json({ sucesso: true, arquivo: nomeArquivo });
  } catch (erro) {
    console.error("Erro ao salvar upload:", erro);
    res.status(500).json({ erro: "Erro ao salvar frequência." });
  }
});

// ==================== MINHAS FREQUÊNCIAS ====================
app.get("/api/minhas-frequencias", autenticar, async (req, res) => {
  try {
    const linhas = await dbQuery(
      `SELECT id, data, alunos, turma 
       FROM frequencias 
       WHERE professor_id = $1 
       ORDER BY id DESC`,
      [req.user.id]
    );
    res.json(linhas);
  } catch (erro) {
    console.error("Erro ao listar frequências:", erro);
    res.status(500).json({ erro: "Erro ao carregar envios." });
  }
});

// ==================== RELATÓRIOS MASTER ====================
app.get("/api/relatorios", autenticar, async (req, res) => {
  if (req.user.tipo !== "master")
    return res.status(403).json({ erro: "Acesso negado" });

  try {
    const linhas = await dbQuery(`
      SELECT 
        f.id,
        f.professor_nome,
        f.data,
        f.turma,
        f.alunos
      FROM frequencias f
      ORDER BY f.data DESC, f.id DESC
    `);
    res.json(linhas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao gerar relatório" });
  }
});

// ==================== RESTANTE DAS ROTAS (logs, backup, reset, etc.) ====================
// Mantém exatamente como está no seu código atual, pois não interferem em 'turma'.

// ==================== START SERVER ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
  await seed();
  console.log(`Servidor rodando na porta ${PORT}`);
});
