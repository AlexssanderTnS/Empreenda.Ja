import express from 'express'; // framework para rotas
import cors from 'cors';          // para permitir requisições de outros domínios
import sqlite3 from 'sqlite3';  // banco de dados leve
import bycrypt from 'bcrypt'; // para hashear senhas
import jwt from 'jsonwebtoken'; // para autenticação via tokens
import cron from 'node-cron'; // para agendar tarefas
import fs from 'fs'; // para manipulação de arquivos


const app = express();
app.use(cors());
app.use(express.json()); // para interpretar JSON no corpo das requisições

const SECRET = process.env.JWT_SECRET || '0000';

// sql em arquivo

const db = new sqlite3.Database('./dados.db'); //cria o arquivo do banco de dados

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
    data TEXT NOT NULL,     -- ISO (YYYY-MM-DD)
    alunos TEXT NOT NULL,   
    criado_em TEXT DEFAULT (datetime('now'))
)`);
function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);  // é a "this" que tem o lastID e changes 

        });

    });


}

//criar usuario master e 2 professores se não existirem
async function seed() {
    const senhaMaster = bycrypt.hashSync('senhamaster123', 10);
    const senhaProf = bycrypt.hashSync('senhaProf123', 10);
}

// cria o master
await dbRun(
    'INSERT OR IGNORE INTO professores( nome, usuario, senha, tipo) Values (?, ?, ?, ?)',
    ['Administrador', 'master', senhaMaster, 'master']
);

//cria 2 professores 
await dbRun(
    'INSERT OR IGNORE INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)',
    ['Prof. Maria', 'maria', senhaProf, 'professor']
);

await dbRun(
    'INSERT OR IGNORE INTO professores (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)',
    ['Prof. Joao', 'joao', senhaProf, 'professor']
);

function autenticar(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startWith('Bearer') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ erro: 'Token ausente' });

    try {
        const payload = jwt.verify(token, SECRET); //valida assinatura e expiração
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ erro: 'Token inválido' });
    }
}

//rota de teste rápido

app.get('/', (req, res) => {
    res.send('API EMPREENDA PRESENÇA OK');
});


//rota de login

app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) return res.status(400).json({ erro: 'Informe usuário e senha' });

    try {
        const user = await dbGet(`SELECT * FROM professores WHERE usuario = ?`, [usuario]);
        if (!user) return res.status(401).json({ erro: 'Usuário não encontrado' });

        const senhaOk = bcrypt.compareSync(senha, user.senha);
        if (!senhaOk) return res.status(401).json({ erro: 'Senha incorreta' });

        // gera token válido por 8h, com id e tipo do usuário
        const token = jwt.sign({ id: user.id, tipo: user.tipo, nome: user.nome }, SECRET, { expiresIn: '8h' });
        res.json({ token, nome: user.nome, tipo: user.tipo });
    } catch (e) {
        res.status(500).json({ erro: 'Erro no login' });
    }
});







