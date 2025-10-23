// resetarBanco.js
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
    connectionString: "postgresql://empreenda_postgress_user:Lihe2vf3Qot33OO6ALWBNhoD0o0YXQPh@dpg-d3ogike3jp1c73bvo660-a/empreenda_postgress",
    ssl: { rejectUnauthorized: false },
});

async function resetarBanco() {
    try {
        console.log("🔄 Limpando banco de dados Empreenda.Já...");

        // Limpa tabelas, mas preserva a estrutura
        await pool.query("TRUNCATE TABLE logs RESTART IDENTITY CASCADE;");
        await pool.query("TRUNCATE TABLE frequencias RESTART IDENTITY CASCADE;");

        // Apaga todos os professores, menos o master
        await pool.query(`
            DELETE FROM professores WHERE usuario != 'master';
    `);

        // Garante que o usuário master ainda existe
        const senhaMaster = bcrypt.hashSync("senhamaster123", 10);
        await pool.query(`
            INSERT INTO professores (nome, usuario, senha, tipo, precisa_trocar_senha)
                VALUES ('Administrador', 'master', $1, 'master', TRUE)
                ON CONFLICT (usuario) DO UPDATE
                SET senha = EXCLUDED.senha, tipo = 'master', precisa_trocar_senha = TRUE;
    `, [senhaMaster]);

        console.log("✅ Banco de dados limpo com sucesso!");
        console.log("👑 Usuário master preservado (usuario: master / senha: senhamaster123)");
    } catch (err) {
        console.error("❌ Erro ao limpar banco:", err);
    } finally {
        await pool.end();
    }
}

resetarBanco();
