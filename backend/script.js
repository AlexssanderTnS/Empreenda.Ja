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


const app = express();

app.use(
    cors({
        origin: [
            "https://empreenda-ja.vercel.app", // seu site na Vercel
            "http://localhost:5500"            // para testes locais
        ],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Garante que o pré-flight OPTIONS receba resposta
app.options("*", cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

// ====== CONFIGURAÇÃO DO UPLOAD (MULTER) ======

// Cria pasta se não existir
const uploadDir = "./uploads/frequencias";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Define como o arquivo será salvo
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);

        // Nome do professor tratado
        const nomeProf = req.user.nome
            .replace(/\s+/g, "_")       // troca espaços por "_"
            .normalize("NFD")           // remove acentos
            .replace(/[\u0300-\u036f]/g, "");

        // Data formatada dd_mm_aaaa
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, "0");
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const ano = agora.getFullYear();

    

        const nomeArquivo = `Prof.${nomeProf}_${dia}_${mes}_${ano}${ext}`;
        cb(null, nomeArquivo);
    },
});


const upload = multer({ storage });

// ====== ROTA 1: Download do modelo da ata ======
app.get("/api/frequencia/modelo", autenticar, (req, res) => {
    const modeloPath = path.resolve("./Planilha.xlsx");
    if (fs.existsSync(modeloPath)) {
        res.download(modeloPath);
    } else {
        res.status(404).json({ erro: "Modelo não encontrado no servidor." });
    }
});

// ====== ROTA 2: Upload da planilha preenchida ======
app.post("/api/frequencia/upload", autenticar, upload.single("arquivo"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    try {
        const nomeArquivo = req.file.filename;
        const dataHoje = new Date().toISOString().split("T")[0];

        // Salva no banco: quem enviou, qual arquivo e a data
        await dbQuery(
            `INSERT INTO frequencias (professor_id, curso, local, turma, data, alunos)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.id, "—", "—", "—", dataHoje, nomeArquivo]
        );

        res.json({ sucesso: true, arquivo: nomeArquivo });
    } catch (erro) {
        console.error("Erro ao salvar upload:", erro);
        res.status(500).json({ erro: "Erro ao salvar frequência." });
    }
});

// ====== ROTA 3: Listar envios do professor ======
app.get("/api/minhas-frequencias", autenticar, async (req, res) => {
    try {
        const linhas = await dbQuery(
            `SELECT id, data, alunos 
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

// ===== EXCLUIR PROFESSOR (somente master) =====
app.delete('/api/professores/:id', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { id } = req.params;

    try {
        await dbQuery('DELETE FROM professores WHERE id = $1', [id]);
        res.json({ sucesso: true, mensagem: 'Professor excluído com sucesso.' });
    } catch (e) {
        console.error('Erro ao excluir professor:', e);
        res.status(500).json({ erro: 'Erro ao excluir professor.' });
    }
});


// ===== LISTAR PROFESSORES (somente master) =====
app.get('/api/professores/listar', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        const professores = await dbQuery(
            'SELECT id, nome, usuario, tipo FROM professores ORDER BY id DESC'
        );
        res.json(professores);
    } catch (e) {
        console.error('Erro ao buscar professores:', e);
        res.status(500).json({ erro: 'Erro ao buscar professores' });
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
