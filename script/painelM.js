// ==================== PAINEL MASTER ROBUSTO ====================
// Essa versão evita erros de "null" e garante funcionamento das abas e dados dinâmicos.

(function iniciarPainel() {
  // Espera o DOM existir antes de executar o script
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarPainel);
    return;
  }

  console.log("✅ Painel Master carregado com segurança");

  // ==================== CONFIGURAÇÕES ====================
  const API_URL = "https://empreenda-ja.onrender.com";
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Acesso negado! Faça login como master primeiro.");
    window.location.href = "index.html";
    return;
  }

  const conteudo = document.getElementById("conteudo");
  const navItems = document.querySelectorAll(".nav-links li");

  if (!conteudo) {
    console.error("❌ ERRO: elemento #conteudo não encontrado no DOM!");
    return;
  }

  // ==================== VALIDAÇÃO DO TOKEN ====================
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

      return resp.ok;
    } catch (e) {
      console.error("Erro ao validar token:", e);
      alert("Erro de comunicação com o servidor. Tente novamente.");
      return false;
    }
  }

  // ==================== CARREGAR RELATÓRIOS ====================
  async function carregarRelatorios() {
    const tokenValido = await validarToken();
    if (!tokenValido) return;

    try {
      const resposta = await fetch(`${API_URL}/api/relatorios`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resposta.ok) throw new Error("Erro ao buscar relatórios");
      const dados = await resposta.json();

      let linhas = "";
      if (dados.length === 0) {
        linhas = `<tr><td colspan="7" class="text-center text-muted">Nenhum relatório encontrado.</td></tr>`;
      } else {
        linhas = dados
          .map(
            (l) => `
          <tr>
            <td>${l.id}</td>
            <td>${l.professor_nome}</td>
            <td>${l.curso}</td>
            <td>${l.local}</td>
            <td>${l.turma}</td>
            <td>${l.data}</td>
            <td>${l.alunos}</td>
          </tr>`
          )
          .join("");
      }

      conteudo.innerHTML = `
        <header class="topbar">
          <h2>📄 Relatórios</h2>
        </header>
        <div class="fade">
          <table class="table table-striped table-bordered">
            <thead class="table-dark">
              <tr>
                <th>ID</th>
                <th>Professor</th>
                <th>Curso</th>
                <th>Local</th>
                <th>Turma</th>
                <th>Data</th>
                <th>Alunos</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      `;
    } catch (erro) {
      console.error("Erro ao carregar relatórios:", erro);
      conteudo.innerHTML = `<p class="text-danger">Erro ao carregar relatórios.</p>`;
    }
  }

  // ==================== CONTEÚDOS ESTÁTICOS ====================
  const secoes = {
    dashboard: `
      <header class="topbar"><h2>📊 Painel de Controle</h2></header>
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
      <header class="topbar"><h2>🗓️ Frequências</h2></header>
      <div class="fade"><p>Controle e visualização das presenças lançadas pelos professores.</p></div>
    `,
    professores: `
      <header class="topbar"><h2>👨‍🏫 Professores Ativos</h2></header>
      <div class="fade"><p>Lista de professores cadastrados no sistema.</p></div>
    `,
    cadastro: `
      <header class="topbar"><h2>🧾 Cadastrar Novo Professor</h2></header>
      <div class="fade">
        <div class="card">
          <form>
            <label>Nome:</label><br><input type="text" style="width:100%;margin-bottom:10px;">
            <label>Usuário:</label><br><input type="text" style="width:100%;margin-bottom:10px;">
            <label>Senha:</label><br><input type="password" style="width:100%;margin-bottom:10px;">
            <button style="background:#003366;color:white;border:none;padding:8px 16px;border-radius:6px;">Cadastrar</button>
          </form>
        </div>
      </div>
    `,
    backups: `
      <header class="topbar"><h2>💾 Backups</h2></header>
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
      <header class="topbar"><h2>⚙️ Configurações</h2></header>
      <div class="fade"><p>Preferências e ajustes da conta do administrador.</p></div>
    `
  };

  // ==================== FUNÇÃO DE TROCA DE ABAS ====================
  function ativarTrocaAbas() {
    navItems.forEach((item) => {
      item.addEventListener("click", async () => {
        document.querySelector(".nav-links li.active")?.classList.remove("active");
        item.classList.add("active");

        const secao = item.dataset.section;

        // Seção dinâmica
        if (secao === "relatorios") {
          await carregarRelatorios();
        } else {
          conteudo.innerHTML = secoes[secao] || "<p>Seção não encontrada.</p>";
        }
      });
    });
  }

  ativarTrocaAbas();

  // ==================== INÍCIO SEGURO ====================
  conteudo.innerHTML = secoes.dashboard;
})();
