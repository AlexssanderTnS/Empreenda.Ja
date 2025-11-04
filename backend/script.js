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
app.use("/uploads", express.static(path.resolve("./uploads")));


const SECRET = process.env.JWT_SECRET || "0000";


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function dbQuery(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}





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
    ALTER TABLE professores 
    ADD COLUMN IF NOT EXISTS precisa_trocar_senha BOOLEAN DEFAULT TRUE;
`);

    // ===== INSERÇÃO DE USUÁRIOS PADRÃO =====
    await pool.query(
        `INSERT INTO professores (nome, usuario, senha, tipo)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (usuario) DO NOTHING`,
        ["Administrador", "master", senhaMaster, "master"]
    );


    try {

        await pool.query(`
    ALTER TABLE frequencias
    ALTER COLUMN professor_id DROP NOT NULL;
`);

        await pool.query(`
    UPDATE frequencias
    SET professor_id = NULL
    WHERE professor_id IS NOT NULL
    AND professor_id NOT IN (SELECT id FROM professores);
`);

        // 🔹 Remove TODAS as foreign keys antigas
        const oldConstraints = await pool.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'frequencias'
    AND constraint_type = 'FOREIGN KEY';
`);

        for (const c of oldConstraints.rows) {
            await pool.query(`ALTER TABLE frequencias DROP CONSTRAINT IF EXISTS ${c.constraint_name};`);
        }

        // 🔹 Cria nova relação SEM apagar frequências
        await pool.query(`
    ALTER TABLE frequencias
    ADD CONSTRAINT frequencias_professor_id_fkey
    FOREIGN KEY (professor_id)
    REFERENCES professores(id)
    ON DELETE SET NULL;
`);

        console.log("Relação professor-frequências corrigida e garantida (ON DELETE SET NULL).");
    } catch (err) {
        console.error(" Erro ao ajustar relação frequencias-professores:", err);
    }


    // ===== AJUSTE DE RELAÇÃO PROFESSORES → LOGS =====
    try {
        await pool.query(`
        ALTER TABLE logs
            ALTER COLUMN professor_id DROP NOT NULL;
    `);

        await pool.query(`
        ALTER TABLE logs
            DROP CONSTRAINT IF EXISTS logs_professor_id_fkey;
    `);

        await pool.query(`
        ALTER TABLE logs
            ADD CONSTRAINT logs_professor_id_fkey
            FOREIGN KEY (professor_id)
            REFERENCES professores(id)
            ON DELETE SET NULL;
    `);

        console.log(" Relação professor-logs ajustada (ON DELETE SET NULL).");
    } catch (err) {
        console.error(" Erro ao ajustar logs-professores:", err);
    }
}

//registrar logs

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

// --- Upload seguro (com validações e logs) ---
const uploadDir = path.resolve("./uploads/frequencias");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Proteção: se o token falhar, não derruba o servidor
        if (!req.user || !req.user.nome) {
            console.error("❌ Falha no upload: req.user ausente ou inválido.");
            return cb(new Error("USUARIO_NAO_AUTENTICADO"));
        }

        const ext = path.extname(file.originalname || "").toLowerCase();
        // Apenas .xlsx (ajuste se aceitar outros)
        if (ext !== ".xlsx") {
            return cb(new Error("TIPO_INVALIDO"));
        }

        const nomeProf = String(req.user.nome)
            .replace(/\s+/g, "_")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, "0");
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const ano = agora.getFullYear();

        const nomeArquivo = `Prof.${nomeProf}_${dia}_${mes}_${ano}${ext}`;
        cb(null, nomeArquivo);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        console.log("📄 Arquivo recebido:", file.originalname, "Tipo:", file.mimetype);
        
        // Aceita .xlsx e outros tipos de planilha Excel
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];
        
        const allowedExtensions = ['.xlsx', '.xls'];
        const fileExt = path.extname(file.originalname || "").toLowerCase();
        
        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
            cb(null, true);
        } else {
            console.log("❌ Tipo de arquivo rejeitado:", file.mimetype, fileExt);
            cb(new Error("TIPO_INVALIDO"));
        }
    },
});



app.put("/api/alterar-senha", autenticar, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ erro: "Preencha todos os campos." });
    }

    try {
        // Busca o professor
        const result = await dbQuery("SELECT * FROM professores WHERE id = $1", [req.user.id]);
        const user = result[0];
        if (!user) return res.status(404).json({ erro: "Usuário não encontrado." });

        // Verifica senha atual
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






app.get("/api/frequencia/modelo", autenticar, (req, res) => {
    const modeloPath = path.resolve("./Planilha.xlsx");
    if (fs.existsSync(modeloPath)) {
        res.download(modeloPath);
    } else {
        res.status(404).json({ erro: "Modelo não encontrado no servidor." });
    }
});



app.post("/api/frequencia/upload", autenticar, (req, res, next) => {
    upload.single("arquivo")(req, res, async (err) => {
        console.log("📤 ========== INICIANDO UPLOAD ==========");

        if (err) {
            console.error("❌ Erro no multer:", err.message);
            if (err.message === "TIPO_INVALIDO") {
                return res.status(400).json({ erro: "Formato inválido. Envie um arquivo .xlsx." });
            }
            if (err.message === "USUARIO_NAO_AUTENTICADO") {
                return res.status(401).json({ erro: "Usuário não autenticado." });
            }
            return res.status(500).json({ erro: "Erro no upload: " + err.message });
        }

        if (!req.file) {
            console.log("❌ Nenhum arquivo recebido");
            return res.status(400).json({ erro: "Nenhum arquivo enviado." });
        }

        console.log("✅ Arquivo recebido:", req.file.filename);
        console.log("📁 Caminho:", req.file.path);
        console.log("👤 Professor ID:", req.user.id);
        console.log("👤 Professor Nome:", req.user.nome);

        try {
            const nomeArquivo = req.file.filename;
            const dataHoje = new Date().toISOString().split("T")[0];

            console.log("💾 ========== SALVANDO NO BANCO ==========");
            console.log("📝 Dados para inserção:", {
                professor_id: req.user.id,
                curso: "—",
                local: "—", 
                turma: "—",
                data: dataHoje,
                alunos: nomeArquivo
            });

            // Primeiro, teste o registro de log
            console.log("📋 Tentando registrar log...");
            await registrarLog(req.user.id, "Upload de frequência", nomeArquivo);
            console.log("✅ Log registrado com sucesso");

            // Agora tente inserir na frequencia
            console.log("🗄️ Tentando inserir na tabela frequencias...");
            const result = await dbQuery(
                `INSERT INTO frequencias (professor_id, curso, local, turma, data, alunos)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [req.user.id, "—", "—", "—", dataHoje, nomeArquivo]
            );

            console.log("✅ Frequência salva com ID:", result[0].id);
            console.log("🎉 ========== UPLOAD CONCLUÍDO ==========");
            res.json({ sucesso: true, arquivo: nomeArquivo });

        } catch (erro) {
            console.error("❌ ========== ERRO DETALHADO ==========");
            console.error("📌 Mensagem:", erro.message);
            console.error("📌 Código:", erro.code);
            console.error("📌 Detalhe:", erro.detail);
            console.error("📌 Query:", erro.query);
            console.error("📌 Parameters:", erro.parameters);
            console.error("📌 Stack:", erro.stack);
            
            // Verificar se é problema de foreign key
            if (erro.code === '23503') {
                console.error("🔗 ERRO DE FOREIGN KEY - Professor não existe");
                return res.status(500).json({ 
                    erro: "Professor não encontrado no sistema.",
                    detalhe: "ID do professor inválido"
                });
            }
            
            // Verificar se é problema de constraint
            if (erro.code === '23502') {
                console.error("🚫 ERRO DE NOT NULL - Campo obrigatório faltando");
                return res.status(500).json({ 
                    erro: "Dados incompletos para salvar frequência.",
                    detalhe: "Campo obrigatório não preenchido"
                });
            }
            
            res.status(500).json({ 
                erro: "Erro ao salvar frequência no banco.",
                detalhe: erro.message,
                codigo: erro.code
            });
        }
    });
});


// Rota temporária para diagnóstico - remover depois
app.get("/api/debug/frequencias", autenticar, async (req, res) => {
    try {
        // Verificar estrutura da tabela
        const columns = await dbQuery(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'frequencias'
            ORDER BY ordinal_position
        `);
        
        // Verificar constraints
        const constraints = await dbQuery(`
            SELECT constraint_name, constraint_type 
            FROM information_schema.table_constraints 
            WHERE table_name = 'frequencias'
        `);
        
        // Verificar professores existentes
        const professores = await dbQuery(`SELECT id, nome FROM professores`);
        
        res.json({
            tabela_frequencias: {
                colunas: columns,
                constraints: constraints,
                total_registros: (await dbQuery(`SELECT COUNT(*) as total FROM frequencias`))[0].total
            },
            professores: professores,
            usuario_atual: {
                id: req.user.id,
                nome: req.user.nome,
                tipo: req.user.tipo
            }
        });
    } catch (err) {
        console.error("Erro no debug:", err);
        res.status(500).json({ erro: err.message });
    }
});


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
        await registrarLog(req.user.id, "Cadastro de professor", nome);

    } catch (e) {
        if (e.code === "23505") return res.status(400).json({ erro: "Usuário já existe" });
        console.error(e);
        res.status(500).json({ erro: "Erro ao cadastrar professor" });
    }
});


app.delete('/api/professores/:id', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { id } = req.params;

    try {
        await dbQuery('DELETE FROM professores WHERE id = $1', [id]);
        res.json({ sucesso: true, mensagem: 'Professor excluído com sucesso.' });
        await registrarLog(req.user.id, "Exclusão de professor", `ID ${id}`);

    } catch (e) {
        console.error('Erro ao excluir professor:', e);
        res.status(500).json({ erro: 'Erro ao excluir professor.' });
    }
});



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


app.get("/api/relatorios", autenticar, async (req, res) => {
    if (req.user.tipo !== "master")
        return res.status(403).json({ erro: "Acesso negado" });

    try {
        const linhas = await dbQuery(`
    SELECT 
        f.*, 
        COALESCE(p.nome, 'Professor removido') AS professor_nome
    FROM frequencias f
    LEFT JOIN professores p ON p.id = f.professor_id
    ORDER BY f.data DESC, f.id DESC
`);
        res.json(linhas);
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: "Erro ao gerar relatório" });
    }
});

app.get("/api/logs/recentes", autenticar, async (req, res) => {
    if (req.user.tipo !== "master") {
        return res.status(403).json({ erro: "Acesso negado" });
    }

    try {
        const linhas = await dbQuery(`
            SELECT l.id, l.acao, l.detalhe, l.data_hora, p.nome AS professor_nome
            FROM logs l
            LEFT JOIN professores p ON p.id = l.professor_id
            ORDER BY l.data_hora DESC
            LIMIT 10
        `);
        res.json(linhas);
    } catch (e) {
        console.error("Erro ao carregar logs:", e);
        res.status(500).json({ erro: "Erro ao carregar ações recentes" });
    }
});


const backupDir = path.resolve("./backups");
const uploadsDir = path.resolve("./uploads/frequencias");

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function gerarBackupZip() {
    const agora = new Date();
    const dataFormatada = agora.toISOString().replace(/[:.]/g, "-");
    const nomeArquivo = `backup_${dataFormatada}.zip`;
    const caminhoFinal = path.join(backupDir, nomeArquivo);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(caminhoFinal);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => {
            console.log(`[Backup] Gerado: ${nomeArquivo} (${archive.pointer()} bytes)`);
            resolve(caminhoFinal);
        });

        archive.on("error", (err) => reject(err));

        archive.pipe(output);

        // Adiciona toda a pasta de frequências
        archive.directory(uploadsDir, false);

        archive.finalize();
    });
}


cron.schedule("0 */25 * * *", async () => {
    console.log("[Backup] Gerando ZIP automático...");
    try {
        await gerarBackupZip();
    } catch (err) {
        console.error("[Backup] Erro ao gerar ZIP:", err);
    }
});



const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
    await seed();
    console.log(`Servidor rodando na porta ${PORT}`);
});

app.get("/api/backup/hoje", autenticar, async (req, res) => {
    if (req.user.tipo !== "master") {
        return res.status(403).json({ erro: "Acesso negado" });
    }

    try {
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, "0");
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const ano = hoje.getFullYear();
        const dataHoje = `${ano}-${mes}-${dia}`;

        console.log(`[Backup diário] Verificando arquivos para a data ${dataHoje} em ${uploadsDir}`);
        const arquivos = fs.readdirSync(uploadsDir).filter(arquivo => {
            const caminho = path.join(uploadsDir, arquivo);
            const stats = fs.statSync(caminho);
            const dataArquivo = stats.mtime.toISOString().split("T")[0];
            console.log(` → ${arquivo} modificado em ${dataArquivo}`);
            return dataArquivo === dataHoje;
        });

        if (arquivos.length === 0) {
            console.warn(`[Backup diário] Nenhum arquivo encontrado para ${dataHoje}`);
            return res.status(404).json({ erro: "Nenhum arquivo gerado hoje." });
        }

        const nomeZip = `backup_diario_${ano}-${mes}-${dia}.zip`;
        const caminhoZip = path.join(backupDir, nomeZip);
        console.log(`[Backup diário] Criando ZIP: ${nomeZip} com ${arquivos.length} arquivos`);

        const output = fs.createWriteStream(caminhoZip);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(output);

        arquivos.forEach(arquivo => {
            archive.file(path.join(uploadsDir, arquivo), { name: arquivo });
        });

        archive.finalize();

        output.on("close", async () => {
            console.log(`[Backup diário] ZIP gerado: ${nomeZip} (${archive.pointer()} bytes)`);
            await registrarLog(req.user.id, "Backup manual diário", nomeZip);
            res.download(caminhoZip, nomeZip, err => {
                if (err) console.error("[Backup diário] Erro no download:", err);
            });
        });

        archive.on("error", err => {
            console.error("[Backup diário] Erro ao criar ZIP:", err);
            res.status(500).json({ erro: "Erro ao criar backup diário." });
        });

    } catch (err) {
        console.error("[Backup diário] Erro geral:", err);
        res.status(500).json({ erro: "Erro interno ao gerar backup diário." });
    }
});


app.get("/api/backup/download", autenticar, async (req, res) => {
    if (req.user.tipo !== "master") {
        return res.status(403).json({ erro: "Acesso negado" });
    }

    try {
        const backupDir = path.resolve("./backups");
        if (!fs.existsSync(backupDir)) {
            return res.status(404).json({ erro: "Pasta de backups não encontrada." });
        }

        const arquivos = fs.readdirSync(backupDir)
            .filter(f => f.endsWith(".zip"))
            .sort((a, b) => {
                const aTime = fs.statSync(path.join(backupDir, a)).mtime;
                const bTime = fs.statSync(path.join(backupDir, b)).mtime;
                return bTime - aTime;
            });

        if (arquivos.length === 0) {
            console.warn("[Backup] Nenhum arquivo ZIP encontrado em ./backups");
            return res.status(404).json({ erro: "Nenhum backup encontrado no servidor." });
        }

        const maisRecente = arquivos[0];
        const caminho = path.join(backupDir, maisRecente);

        console.log(`[Backup] Preparando download: ${maisRecente}`);
        await registrarLog(req.user.id, "Download de backup completo", maisRecente);


        if (!fs.existsSync(caminho)) {
            return res.status(404).json({ erro: "Arquivo de backup não encontrado." });
        }

        res.download(caminho, maisRecente, (err) => {
            if (err) {
                console.error("[Backup] Erro ao enviar o arquivo:", err);
                res.status(500).json({ erro: "Falha ao baixar backup." });
            } else {
                console.log(`[Backup] Download iniciado para: ${maisRecente}`);
            }
        });
    } catch (err) {
        console.error("[Backup] Erro geral na rota /download:", err);
        res.status(500).json({ erro: "Erro interno ao preparar backup." });
    }
});


app.get("/api/backup/geral", autenticar, async (req, res) => {
    if (req.user.tipo !== "master") {
        return res.status(403).json({ erro: "Acesso negado" });
    }

    try {
        const nomeZip = `backup_geral_todos_relatorios_${new Date().toISOString().split("T")[0]}.zip`;
        const caminhoZip = path.join(backupDir, nomeZip);

        console.log(`[Backup geral] Criando arquivo com todos os relatórios...`);


        const output = fs.createWriteStream(caminhoZip);
        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(output);

        archive.directory(uploadsDir, false);
        archive.finalize();

        output.on("close", async () => {
            console.log(`[Backup geral] ZIP gerado: ${nomeZip} (${archive.pointer()} bytes)`);
            await registrarLog(req.user.id, "Backup geral completo", nomeZip);
            res.download(caminhoZip, nomeZip, (err) => {
                if (err) console.error("[Backup geral] Erro ao enviar:", err);
            });
        });

        archive.on("error", (err) => {
            console.error("[Backup geral] Erro ao criar ZIP:", err);
            res.status(500).json({ erro: "Erro ao criar backup geral." });
        });
    } catch (err) {
        console.error("[Backup geral] Erro inesperado:", err);
        res.status(500).json({ erro: "Erro interno ao gerar backup geral." });
    }
});



// --- Tratador global de erros (Express + Multer) ---
app.use((err, req, res, next) => {
    console.error("🔥 Erro global:", err && err.message, err && err.stack);

    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ erro: "Arquivo grande demais (limite 10 MB)." });
    }

    if (err.message === "USUARIO_NAO_AUTENTICADO") {
        return res.status(401).json({ erro: "Usuário não autenticado no upload." });
    }

    if (err.message === "TIPO_INVALIDO") {
        return res.status(400).json({ erro: "Formato inválido. Envie um arquivo .xlsx." });
    }

    // fallback
    return res.status(500).json({ erro: "Falha no upload." });
});



app.post("/api/resetar-banco", autenticar, async (req, res) => {
    if (req.user.tipo !== "master") {
        return res.status(403).json({ erro: "Acesso negado" });
    }

    try {
        console.log("Solicitado reset completo do banco de dados pelo master...");


        await pool.query(`ALTER TABLE frequencias DROP CONSTRAINT IF EXISTS frequencias_professor_id_fkey;`);
        await pool.query(`ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_professor_id_fkey;`);


        await pool.query("TRUNCATE TABLE logs RESTART IDENTITY;");
        await pool.query("TRUNCATE TABLE frequencias RESTART IDENTITY;");
        await pool.query("TRUNCATE TABLE professores RESTART IDENTITY;");


        const senhaMaster = bcrypt.hashSync("senhamaster123", 10);
        await pool.query(`
        INSERT INTO professores (nome, usuario, senha, tipo, precisa_trocar_senha)
        VALUES ('Administrador', 'master', $1, 'master', TRUE)
        ON CONFLICT (usuario) DO UPDATE
        SET senha = EXCLUDED.senha, tipo = 'master', precisa_trocar_senha = TRUE;
    `, [senhaMaster]);


        await pool.query(`
        ALTER TABLE frequencias
        ADD CONSTRAINT frequencias_professor_id_fkey
        FOREIGN KEY (professor_id)
        REFERENCES professores(id)
        ON DELETE SET NULL;
    `);

        await pool.query(`
        ALTER TABLE logs
        ADD CONSTRAINT logs_professor_id_fkey
        FOREIGN KEY (professor_id)
        REFERENCES professores(id)
        ON DELETE SET NULL;
    `);

        console.log("Banco resetado com sucesso via painel!");
        await registrarLog(req.user.id, "Reset completo do banco via painel");

        res.json({
            sucesso: true,
            mensagem: "Banco de dados resetado com sucesso. Usuário master recriado (senha: senhamaster123).",
        });

    } catch (err) {
        console.error("Erro ao resetar banco via painel:", err);
        res.status(500).json({ erro: "Erro interno ao resetar o banco de dados." });
    }
});
