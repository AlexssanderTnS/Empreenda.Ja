import express from 'express';     // framework para rotas HTTP
import cors from 'cors';           // permite requisições de outros domínios (frontend separado)
import sqlite3 from 'sqlite3';     // banco de dados leve (em arquivo)
import bcrypt from 'bcryptjs';     // para hash e verificação de senhas
import jwt from 'jsonwebtoken';    // autenticação via tokens (JWT)
import cron from 'node-cron';      // agendar tarefas automáticas (backup diário)
import fs from 'fs';               // manipulação de arquivos (para backups)


// ===== CONFIGURAÇÃO DO SERVIDOR =====
const app = express();
app.use(cors());
app.use(express.json()); // interpreta JSON no corpo das requisições

const SECRET = process.env.JWT_SECRET || '0000'; // chave secreta (mude em produção)


// ===== BANCO DE DADOS SQLITE =====
const db = new sqlite3.Database('./dados.db'); // cria o arquivo do banco

// Cria tabela de professores
db.run(`CREATE TABLE IF NOT EXISTS professores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT CHECK(tipo IN ('professor', 'master')) NOT NULL DEFAULT 'professor'
)`);

// Cria tabela de frequências
db.run(`CREATE TABLE IF NOT EXISTS frequencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professor_id INTEGER NOT NULL,
  curso TEXT NOT NULL,
  local TEXT NOT NULL,
  turma TEXT NOT NULL,
  data TEXT NOT NULL,   -- formato YYYY-MM-DD
  alunos TEXT NOT NULL,
  criado_em TEXT DEFAULT (datetime('now'))
)`);


// ===== FUNÇÕES AUXILIARES DO BANCO =====
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this); // retorna lastID, changes, etc.
        });
    });
}


// ===== FUNÇÃO SEED (cria usuários iniciais) =====
async function seed() {
    const senhaMaster = bcrypt.hashSync('senhamaster123', 10);
    const senhaProf = bcrypt.hashSync('senhaprof123', 10);

    // cria o usuário master
    await dbRun(
        'INSERT OR IGNORE INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)',
        ['Administrador', 'master', senhaMaster, 'master']
    );

    // cria dois professores
    await dbRun(
        'INSERT OR IGNORE INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)',
        ['Prof. Maria', 'maria', senhaProf, 'professor']
    );

    await dbRun(
        'INSERT OR IGNORE INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)',
        ['Prof. João', 'joao', senhaProf, 'professor']
    );
}


// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
function autenticar(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ erro: 'Token ausente' });

    try {
        const payload = jwt.verify(token, SECRET); // valida assinatura e expiração
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ erro: 'Token inválido' });
    }
}


// ===== ROTAS =====

// Rota de teste rápido
app.get('/', (req, res) => {
    res.send('API Empreenda Presença OK');
});


// Rota de login
app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    if (!usuario || !senha)
        return res.status(400).json({ erro: 'Informe usuário e senha' });

    try {
        const user = await dbGet('SELECT * FROM professores WHERE usuario = ?', [usuario]);
        if (!user) return res.status(401).json({ erro: 'Usuário não encontrado' });

        const senhaOk = bcrypt.compareSync(senha, user.senha);
        if (!senhaOk) return res.status(401).json({ erro: 'Senha incorreta' });

        // gera token válido por 8h, com id e tipo do usuário
        const token = jwt.sign(
            { id: user.id, tipo: user.tipo, nome: user.nome },
            SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, nome: user.nome, tipo: user.tipo });
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: 'Erro no login' });
    }
});


// Rota para lançar frequência
app.post('/api/frequencia', autenticar, async (req, res) => {
    const { curso, local, turma, data, alunos } = req.body;

    if (!curso || !local || !turma || !data || !alunos) {
        return res
            .status(400)
            .json({ erro: 'Campos obrigatórios: curso, local, turma, data, alunos' });
    }

    try {
        await dbRun(
            'INSERT INTO frequencias (professor_id, curso, local, turma, data, alunos) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, curso, local, turma, data, alunos]
        );
        res.json({ sucesso: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: 'Erro ao salvar frequência' });
    }
});


// Rota: listar frequências do professor logado
app.get('/api/minhas-frequencias', autenticar, async (req, res) => {
    try {
        const linhas = await dbAll(
            'SELECT * FROM frequencias WHERE professor_id = ? ORDER BY data DESC, id DESC',
            [req.user.id]
        );
        res.json(linhas);
    } catch {
        res.status(500).json({ erro: 'Erro ao buscar frequências' });
    }
});


// Rota: relatórios (somente master)
app.get('/api/relatorios', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master')
        return res.status(403).json({ erro: 'Acesso negado' });

    const { curso, turma, data } = req.query;
    const cond = [];
    const params = [];

    if (curso) { cond.push('curso = ?'); params.push(curso); }
    if (turma) { cond.push('turma = ?'); params.push(turma); }
    if (data) { cond.push('data = ?'); params.push(data); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    try {
        const linhas = await dbAll(
            `SELECT f.*, p.nome AS professor_nome
        FROM frequencias f
        JOIN professores p ON p.id = f.professor_id
        ${where}
        ORDER BY data DESC, f.id DESC`,
            params
        );
        res.json(linhas);
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: 'Erro ao gerar relatório' });
    }
});


// Rota: exportar CSV (somente master)
app.get('/api/relatorios/export', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master')
        return res.status(403).json({ erro: 'Acesso negado' });

    try {
        const linhas = await dbAll(
            `SELECT f.id, p.nome AS professor, f.curso, f.local, f.turma, f.data, f.alunos, f.criado_em
       FROM frequencias f
       JOIN professores p ON p.id = f.professor_id
       ORDER BY f.data DESC, f.id DESC`
        );

        const header = ['id', 'professor', 'curso', 'local', 'turma', 'data', 'alunos', 'criado_em'];
        const csv = [
            header.join(','),
            ...linhas.map(l =>
                [l.id, l.professor, l.curso, l.local, l.turma, l.data, JSON.stringify(l.alunos), l.criado_em]
                    .map(v => String(v).replaceAll('\n', ' ').replaceAll('"', '""'))
                    .map(v => `"${v}"`)
                    .join(',')
            )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="relatorio.csv"');
        res.send(csv);
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: 'Erro ao exportar CSV' });
    }
});

// ===== CADASTRAR NOVO PROFESSOR (somente master) =====
app.post('/api/professores', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { nome, usuario, senha } = req.body;
    if (!nome || !usuario || !senha) {
        return res.status(400).json({ erro: 'Campos obrigatórios: nome, usuário, senha' });
    }

    try {
        const hash = bcrypt.hashSync(senha, 10);
        await dbRun(
            'INSERT INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)',
            [nome, usuario, hash, 'professor']
        );
        res.json({ sucesso: true, mensagem: 'Professor cadastrado com sucesso.' });
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ erro: 'Usuário já existe' });
        }
        console.error(e);
        res.status(500).json({ erro: 'Erro ao cadastrar professor' });
    }
});

// ===== LISTAR PROFESSORES (somente master) =====
app.get('/api/professores/listar', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        const professores = await dbAll(
            'SELECT id, nome, usuario, tipo FROM professores ORDER BY id DESC'
        );
        res.json(professores);
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: 'Erro ao buscar professores' });
    }
});



// ===== CADASTRAR NOVO PROFESSOR (rota master) =====
app.post('/api/professores', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') return res.status(403).json({ erro: 'Acesso negado' });
    const { nome, usuario, senha } = req.body;
    if (!nome || !usuario || !senha) return res.status(400).json({ erro: 'Campos obrigatórios faltando' });

    try {
        const hash = bcrypt.hashSync(senha, 10);
        await dbRun('INSERT INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)', [nome, usuario, hash, 'professor']);
        res.json({ sucesso: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ erro: 'Usuário já existe' });
        res.status(500).json({ erro: 'Erro ao cadastrar professor' });
    }
});

// ===== LISTAR PROFESSORES (rota master) =====
app.get('/api/professores/listar', autenticar, async (req, res) => {
    if (req.user.tipo !== 'master') return res.status(403).json({ erro: 'Acesso negado' });
    try {
        const linhas = await dbAll('SELECT id, nome, usuario, tipo FROM professores ORDER BY id DESC');
        res.json(linhas);
    } catch {
        res.status(500).json({ erro: 'Erro ao buscar professores' });
    }
});

// ===== BACKUP AUTOMÁTICO DIÁRIO =====
cron.schedule('0 2 * * *', () => {
    const data = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const origem = './dados.db';
    const destino = `./backup_${data}.db`;

    try {
        fs.copyFileSync(origem, destino);
        console.log(`[backup] Criado: ${destino}`);
    } catch (e) {
        console.error('[backup] Falhou:', e.message);
    }
});


// ===== INICIALIZA O SERVIDOR =====
const PORT = process.env.PORT || 3000;
db.serialize(async () => {
    // Garante que as tabelas sejam criadas antes do seed
    db.run(`CREATE TABLE IF NOT EXISTS professores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        usuario TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('professor', 'master')) NOT NULL DEFAULT 'professor'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS frequencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professor_id INTEGER NOT NULL,
        curso TEXT NOT NULL,
        local TEXT NOT NULL,
        turma TEXT NOT NULL,
        data TEXT NOT NULL,
        alunos TEXT NOT NULL,
        criado_em TEXT DEFAULT (datetime('now'))
    )`);

    await seed(); // popula o banco com usuários iniciais
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
});
