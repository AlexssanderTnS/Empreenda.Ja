// ==================== PAINEL MASTER COMPLETO (com exclusão funcional) ====================

(function iniciarPainel() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarPainel);
    return;
  }

  console.log("✅ Painel Master inicializado");

  // ==================== CONFIGURAÇÕES ====================
  const API_URL = "https://empreenda-ja.onrender.com"; // 🔧 troque se sua API da Render tiver outro endereço
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const conteudo = document.getElementById("conteudo");
  const navItems = document.querySelectorAll(".nav-links li");
  if (!conteudo) return;

  // ==================== VALIDAÇÃO DO TOKEN ====================
  async function validarToken() {
    try {
      const resp = await fetch(`${API_URL}/api/relatorios`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "index.html";
        return false;
      }
      return resp.ok;
    } catch {
      return false;
    }
  }

  // ==================== RELATÓRIOS ====================
  async function carregarRelatorios() {
    const tokenValido = await validarToken();
    if (!tokenValido) return;

    try {
      const resposta = await fetch(`${API_URL}/api/relatorios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await resposta.json();

      let linhas =
        dados.length === 0
          ? `<tr><td colspan="7" class="text-center text-muted">Nenhum relatório encontrado.</td></tr>`
          : dados
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

      conteudo.innerHTML = `
        <header class="topbar"><h2>📄 Relatórios</h2></header>
        <div class="fade">
          <table class="table table-striped table-bordered">
            <thead class="table-dark">
              <tr>
                <th>ID</th><th>Professor</th><th>Curso</th><th>Local</th><th>Turma</th><th>Data</th><th>Alunos</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>`;
    } catch (erro) {
      conteudo.innerHTML = `<p class="text-danger">Erro ao carregar relatórios.</p>`;
    }
  }

  // ==================== LISTAR PROFESSORES ====================
  async function carregarProfessores() {
    try {
      const resp = await fetch(`${API_URL}/api/professores/listar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await resp.json();

      const tbody = document.querySelector("#tabelaProfessores tbody");
      if (!tbody) return;

      if (dados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>Nenhum professor encontrado.</td></tr>";
        return;
      }

      tbody.innerHTML = dados
        .map(
          (p) => `
            <tr>
              <td>${p.id}</td>
              <td>${p.nome}</td>
              <td>${p.usuario}</td>
              <td>${p.tipo}</td>
              <td>
                <button class="btn-excluir" data-id="${p.id}">🗑️ Excluir</button>
              </td>
            </tr>`
        )
        .join('');

      // ===== AÇÃO DO BOTÃO EXCLUIR =====
      document.querySelectorAll('.btn-excluir').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const confirmar = confirm('Tem certeza que deseja excluir este professor?');
          if (!confirmar) return;

          try {
            const resp = await fetch(`${API_URL}/api/professores/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });

            const dados = await resp.json();
            if (resp.ok) {
              alert('✅ Professor excluído com sucesso!');
              await carregarProfessores();
            } else {
              alert('⚠️ ' + (dados.erro || 'Erro ao excluir professor.'));
            }
          } catch (erro) {
            alert('Erro de comunicação com o servidor.');
            console.error(erro);
          }
        });
      });

    } catch (erro) {
      console.error("Erro ao carregar professores:", erro);
      const tbody = document.querySelector("#tabelaProfessores tbody");
      if (tbody)
        tbody.innerHTML = "<tr><td colspan='5'>Erro ao carregar lista.</td></tr>";
    }
  }

  // ==================== CADASTRAR PROFESSOR ====================
  function configurarFormularioCadastro() {
    const form = document.querySelector("form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nome = form.querySelectorAll("input")[0]?.value.trim();
      const usuario = form.querySelectorAll("input")[1]?.value.trim();
      const senha = form.querySelector("input[type='password']")?.value.trim();

      if (!nome || !usuario || !senha) {
        alert("Preencha todos os campos.");
        return;
      }

      try {
        const resp = await fetch(`${API_URL}/api/professores`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nome, usuario, senha }),
        });

        const dados = await resp.json();

        if (resp.ok) {
          alert("✅ Professor cadastrado com sucesso!");
          form.reset();
          await carregarProfessores();
        } else {
          alert("⚠️ " + (dados.erro || "Erro ao cadastrar."));
        }
      } catch (erro) {
        alert("Erro de comunicação com o servidor.");
      }
    });
  }

  // ==================== SEÇÕES ====================
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
      <div class="fade">
        <p>Lista de professores cadastrados no sistema.</p>
        <table class="table table-striped" id="tabelaProfessores">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Tipo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody><tr><td colspan="5">Carregando...</td></tr></tbody>
        </table>
      </div>
    `,
    cadastro: `
      <header class="topbar"><h2>🧾 Cadastrar Novo Professor</h2></header>
      <div class="fade">
        <div class="card">
          <form>
            <label>Nome:</label><input type="text" class="form-control mb-2">
            <label>Usuário:</label><input type="text" class="form-control mb-2">
            <label>Senha:</label><input type="password" class="form-control mb-3">
            <button type="submit" class="btn btn-primary w-100">Cadastrar</button>
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
      </div>
    `,
    config: `
      <header class="topbar"><h2>⚙️ Configurações</h2></header>
      <div class="fade"><p>Preferências e ajustes da conta do administrador.</p></div>
    `,
  };

  // ==================== TROCA DE ABAS ====================
  function ativarTrocaAbas() {
    navItems.forEach((item) => {
      item.addEventListener("click", async () => {
        document.querySelector(".nav-links li.active")?.classList.remove("active");
        item.classList.add("active");

        const secao = item.dataset.section;

        if (secao === "relatorios") {
          await carregarRelatorios();
        } else if (secao === "professores") {
          conteudo.innerHTML = secoes[secao];
          await carregarProfessores();
        } else {
          conteudo.innerHTML = secoes[secao] || "<p>Seção não encontrada.</p>";
          if (secao === "cadastro") configurarFormularioCadastro();
        }
      });
    });
  }

  ativarTrocaAbas();
  conteudo.innerHTML = secoes.dashboard;
})();
