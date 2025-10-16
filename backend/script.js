// ==================== BACKEND EMPREENDA.JÁ (PostgreSQL) ====================

import express from "express";
import cors from "cors";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cron from "node-cron";

const app = express();
app.use(
    cors({
        origin: [
            "https://empreenda-ja.vercel.app",
            "http://localhost:5500"
        ],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);
app.use(express.json());

const SECRET = process.env.JWT_SECRET || "0000";

// ====== CONEXÃO COM POSTGRESQL ======
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function dbQuery(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

// ====== SEED INICIAL ======
async function seed() {
    const senhaMaster = bcrypt.hashSync("senhamaster123", 10);
    const senhaProf = bcrypt.hashSync("senhaprof123", 10);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS professores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      usuario TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT CHECK (tipo IN ('professor', 'master')) NOT NULL DEFAULT 'professor'
    );
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS frequencias (
      id SERIAL PRIMARY KEY,
      professor_id INTEGER NOT NULL,
      curso TEXT NOT NULL,
      local TEXT NOT NULL,
      turma TEXT NOT NULL,
      data TEXT NOT NULL,
      alunos TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

    await pool.query(
        `INSERT INTO professores (nome, usuario, senha, tipo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario) DO NOTHING`,
        ["Administrador", "master", senhaMaster, "master"]
    );

    await pool.query(
        `INSERT INTO professores (nome, usuario, senha, tipo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario) DO NOTHING`,
        ["Prof. Maria", "maria", senhaProf, "professor"]
    );

    await pool.query(
        `INSERT INTO professores (nome, usuario, senha, tipo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario) DO NOTHING`,
        ["Prof. João", "joao", senhaProf, "professor"]
    );
}

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
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

// ===== ROTAS =====

// Teste
app.get("/", (req, res) => {
    res.send("API Empreenda Presença OK (PostgreSQL)");
});

// Login
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
            { id: user.id, tipo: user.tipo, nome: user.nome },
            SECRET,
            { expiresIn: "8h" }
        );

        res.json({ token, nome: user.nome, tipo: user.tipo });
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: "Erro no login" });
    }
});

// Cadastro de professor (somente master)
app.post("/api/professores", autenticar, async (req, res) => {
    if (req.user.tipo !== "master")
        return res.status(403).json({ erro: "Acesso negado" });

    const { nome, usuario, senha } = req.body;
    if (!nome || !usuario || !senha)
        return res.status(400).json({ erro: "Preencha todos os campos" });

    try {
        const hash = bcrypt.hashSync(senha, 10);
        await dbQuery(
            `INSERT INTO professores (nome, usuario, senha, tipo)
       VALUES ($1, $2, $3, 'professor')`,
            [nome, usuario, hash]
        );
        res.json({ sucesso: true, mensagem: "Professor cadastrado com sucesso" });
    } catch (e) {
        if (e.code === "23505") return res.status(400).json({ erro: "Usuário já existe" });
        console.error(e);
        res.status(500).json({ erro: "Erro ao cadastrar professor" });
    }
});

// Listar professores
app.get("/api/professores/listar", autenticar, async (req, res) => {
    if (req.user.tipo !== "master")
        return res.status(403).json({ erro: "Acesso negado" });

    try {
        const professores = await dbQuery("SELECT id, nome, usuario, tipo FROM professores ORDER BY id DESC");
        res.json(professores);
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: "Erro ao buscar professores" });
    }
});

// Lançar frequência
app.post("/api/frequencia", autenticar, async (req, res) => {
    const { curso, local, turma, data, alunos } = req.body;
    if (!curso || !local || !turma || !data || !alunos)
        return res.status(400).json({ erro: "Preencha todos os campos obrigatórios" });

    try {
        await dbQuery(
            `INSERT INTO frequencias (professor_id, curso, local, turma, data, alunos)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.id, curso, local, turma, data, alunos]
        );
        res.json({ sucesso: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: "Erro ao salvar frequência" });
    }
});

// Relatórios (somente master)
app.get("/api/relatorios", autenticar, async (req, res) => {
    if (req.user.tipo !== "master")
        return res.status(403).json({ erro: "Acesso negado" });

    try {
        const linhas = await dbQuery(`
      SELECT f.*, p.nome AS professor_nome
      FROM frequencias f
      JOIN professores p ON p.id = f.professor_id
      ORDER BY data DESC, f.id DESC
    `);
        res.json(linhas);
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: "Erro ao gerar relatório" });
    }
});

// Backup (opcional — aqui apenas loga)
cron.schedule("0 2 * * *", () => {
    console.log("[backup] Tarefa agendada — em PostgreSQL você pode usar dumps automáticos.");
});

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await seed();
    console.log(`Servidor rodando na porta ${PORT}`);
});
