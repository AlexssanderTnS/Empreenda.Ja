document.addEventListener("DOMContentLoaded", () => {

    // ==================== CONFIGURAÇÕES BÁSICAS ====================
    const API_URL = "https://empreenda-ja.onrender.com";
    const token = localStorage.getItem("token");


    // ==================== VERIFICAÇÃO DE LOGIN ====================
    if (!token) {
        alert("Acesso negado! Faça login como master primeiro.");
        window.location.href = "index.html";
        return;
    }


    // ==================== FUNÇÃO DE VERIFICAÇÃO DO TOKEN ====================
    async function validarToken() {
        try {
            const resp = await fetch(`${API_URL}/api/relatorios`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (resp.status === 401) {
                alert("Sua sessão expirou. Faça login novamente.");
                localStorage.removeItem("token");
                window.location.href = "index.html";
                return false;
            }

            if (!resp.ok) throw new Error("Erro ao validar sessão.");
            return true;
        } catch (e) {
            console.error("Erro ao validar token:", e);
            alert("Erro de comunicação com o servidor. Tente novamente.");
            return false;
        }
    }


    // ==================== FUNÇÃO PRINCIPAL: CARREGAR RELATÓRIOS ====================
    async function carregarRelatorios() {
        const tokenValido = await validarToken();
        if (!tokenValido) return;

        try {
            const resposta = await fetch(`${API_URL}/api/relatorios`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!resposta.ok) throw new Error("Erro ao buscar relatórios");
            const dados = await resposta.json();

            const tbody = document.querySelector("#TabelaRelatorios tbody");
            if (!tbody) return; // segurança para não quebrar o script

            tbody.innerHTML = "";

            if (dados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum relatório encontrado.</td></tr>';
                return;
            }

            dados.forEach((linha) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
          <td>${linha.id}</td>
          <td>${linha.professor_nome}</td>
          <td>${linha.curso}</td>
          <td>${linha.local}</td>
          <td>${linha.turma}</td>
          <td>${linha.data}</td>
          <td>${linha.alunos}</td>
        `;
                tbody.appendChild(tr);
            });
        } catch (erro) {
            console.error("Erro ao carregar relatórios:", erro);
            alert("Erro ao carregar dados do servidor.");
        }
    }


    // ==================== EXPORTAÇÃO DE CSV ====================
    const btnExportar = document.getElementById("btnExportar");
    if (btnExportar) {
        btnExportar.addEventListener("click", async () => {
            const tokenValido = await validarToken();
            if (!tokenValido) return;

            const link = document.createElement("a");
            link.href = `${API_URL}/api/relatorios/export`;
            link.target = "_blank";
            link.setAttribute("Authorization", `Bearer ${token}`);
            link.click();
        });
    }


    // ==================== TROCA DE SEÇÕES DO PAINEL MASTER ====================
    const conteudo = document.getElementById("conteudo");
    const navItems = document.querySelectorAll(".nav-links li");

    const secoes = {
        dashboard: `
      <header class="topbar">
        <h2>📊 Painel de Controle</h2>
      </header>
      <div class="fade">
        <p>Resumo geral do sistema.</p>
        <div class="cards-container">
          <div class="card"><h4>Professores</h4><h2>12</h2></div>
          <div class="card"><h4>Frequências</h4><h2>22</h2></div>
          <div class="card"><h4>Último Backup</h4><h2>14/10/2025</h2></div>
        </div>
      </div>
    `,

        frequencias: `
      <header class="topbar">
        <h2>🗓️ Frequências</h2>
      </header>
      <div class="fade">
        <p>Controle e visualização das presenças lançadas pelos professores.</p>
      </div>
    `,

        relatorios: `
      <header class="topbar">
        <h2>📄 Relatórios</h2>
      </header>
      <div class="fade">
        <table>
          <thead><tr><th>ID</th><th>Professor</th><th>Curso</th><th>Data</th><th>Turma</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Maria</td><td>Empreendedorismo</td><td>10/10/25</td><td>T1</td></tr>
            <tr><td>2</td><td>João</td><td>Gestão</td><td>12/10/25</td><td>T2</td></tr>
          </tbody>
        </table>
      </div>
    `,

        professores: `
      <header class="topbar">
        <h2>👨‍🏫 Professores Ativos</h2>
      </header>
      <div class="fade">
        <p>Lista de professores cadastrados no sistema.</p>
      </div>
    `,

        cadastro: `
      <header class="topbar">
        <h2>🧾 Cadastrar Novo Professor</h2>
      </header>
      <div class="fade">
        <div class="card">
          <form>
            <label>Nome:</label><br><input type="text" style="width:100%;margin-bottom:10px;"><br>
            <label>Usuário:</label><br><input type="text" style="width:100%;margin-bottom:10px;"><br>
            <label>Senha:</label><br><input type="password" style="width:100%;margin-bottom:10px;"><br>
            <button style="background:#003366;color:white;border:none;padding:8px 16px;border-radius:6px;">Cadastrar</button>
          </form>
        </div>
      </div>
    `,

        backups: `
      <header class="topbar">
        <h2>💾 Backups</h2>
      </header>
      <div class="fade">
        <p>Últimos backups automáticos realizados:</p>
        <ul>
          <li>backup_2025-10-14.db</li>
          <li>backup_2025-10-13.db</li>
          <li>backup_2025-10-12.db</li>
        </ul>
        <button style="background:#ffcc29;border:none;padding:8px 12px;border-radius:6px;">Gerar Backup Agora</button>
      </div>
    `,

        config: `
      <header class="topbar">
        <h2>⚙️ Configurações</h2>
      </header>
      <div class="fade">
        <p>Preferências e ajustes da conta do administrador.</p>
      </div>
    `
    };

    // ======== FUNÇÃO PARA TROCAR DE ABA ========
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            document.querySelector(".nav-links li.active")?.classList.remove("active");
            item.classList.add("active");

            const secao = item.dataset.section;
            conteudo.innerHTML = secoes[secao] || "<p>Seção não encontrada.</p>";
        });
    });

    // ==================== EXECUÇÃO AUTOMÁTICA ====================
    carregarRelatorios();

});
