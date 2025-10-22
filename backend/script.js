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
import { exec } from "child_process";
import nodemailer from "nodemailer";

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
            tipo TEXT CHECK (tipo IN ('professor', 'master')) NOT NULL DEFAULT 'professor',
            precisa_trocar_senha BOOLEAN DEFAULT TRUE
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS logs (
            id SERIAL PRIMARY KEY,
            professor_id INTEGER REFERENCES professores(id),
            acao TEXT NOT NULL,
            detalhe TEXT,
            data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    await pool.query(`
        INSERT INTO professores (nome, usuario, senha, tipo)
        VALUES 
            ('Administrador', 'master', $1, 'master'),
            ('Prof. Maria', 'maria', $2, 'professor'),
            ('Prof. João', 'joao', $2, 'professor')
        ON CONFLICT (usuario) DO NOTHING;
    `, [senhaMaster, senhaProf]);
}

// ===== LOGS =====
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

// ===== AUTENTICAÇÃO =====
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

// ===== FUNÇÃO DE BACKUP =====
const backupDir = path.resolve("./backups");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

async function gerarBackup() {
    const data = new Date().toISOString().split("T")[0];
    const nomeArquivo = `backup_${data}.sql`;
    const caminhoCompleto = path.join(backupDir, nomeArquivo);
    const comando = `pg_dump "${process.env.DATABASE_URL}" > "${caminhoCompleto}"`;

    return new Promise((resolve, reject) => {
        exec(comando, async (erro) => {
            if (erro) {
                console.error("[Backup] Erro:", erro);
                reject(erro);
                return;
            }
            console.log(`[Backup] Gerado com sucesso: ${nomeArquivo}`);
            await enviarEmailBackup(caminhoCompleto);
            resolve(caminhoCompleto);
        });
    });
}

// ===== ENVIO POR E-MAIL =====
async function enviarEmailBackup(caminhoArquivo) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const destino = process.env.DESTINO_BACKUP || "ibaprj14@gmail.com";

    try {
        await transporter.sendMail({
            from: `"Backup Empreenda.Já" <${process.env.EMAIL_USER}>`,
            to: destino,
            subject: "Backup Diário - Empreenda.Já",
            text: "Segue em anexo o backup diário do banco de dados.",
            attachments: [
                {
                    filename: path.basename(caminhoArquivo),
                    path: caminhoArquivo,
                },
            ],
        });
        console.log(`[Backup] Enviado com sucesso para ${destino}`);
    } catch (e) {
        console.error("[Backup] Falha ao enviar e-mail:", e);
    }
}

// ===== CRON DIÁRIO ÀS 02:00 =====
cron.schedule("0 2 * * *", async () => {
    console.log("[Backup] Iniciando tarefa automática às 02:00...");
    await gerarBackup();
});

// ===== ROTA DE BACKUP MANUAL =====
app.get("/api/backup/manual", autenticar, async (req, res) => {
    if (req.user.tipo !== "master") return res.status(403).json({ erro: "Acesso negado" });
    try {
        const caminho = await gerarBackup();
        res.json({ sucesso: true, mensagem: "Backup gerado e enviado com sucesso.", arquivo: caminho });
    } catch {
        res.status(500).json({ erro: "Erro ao gerar backup." });
    }
});

// ===== RESTANTE DAS ROTAS ORIGINAIS =====
// (coloque aqui todas as suas rotas já existentes: login, upload, professores, relatórios, etc.)

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await seed();
    console.log(`Servidor rodando na porta ${PORT}`);
});
