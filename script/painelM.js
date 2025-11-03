// ==================== PAINEL MASTER COMPLETO ====================

(function iniciarPainel() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarPainel);
    return;
  }

  console.log("✅ Painel Master inicializado");

  const API_URL = "https://empreenda-ja.onrender.com";
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const conteudo = document.getElementById("conteudo");
  const navItems = document.querySelectorAll(".nav-links li");
  if (!conteudo) return;

  // ==================== VERIFICA TOKEN ====================
  async function validarToken() {
    try {
      const resp = await fetch(`${API_URL}/api/relatorios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "index.html";
        return false;
      }
      return resp.ok;
    } catch (err) {
      console.error("Erro ao validar token:", err);
      return false;
    }
  }

  // ==================== RELATÓRIOS ====================
  async function carregarRelatorios() {
    const tokenValido = await validarToken();
    if (!tokenValido) return;

    conteudo.innerHTML = `
      <header class="topbar"><h2>📄 Relatórios</h2></header>
      <div class="fade"><p>Carregando relatórios...</p></div>
    `;

    try {
      const resp = await fetch(`${API_URL}/api/relatorios`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error("Erro " + resp.status);

      const dados = await resp.json();

      let linhas =
        dados.length === 0
          ? `<tr><td colspan="4" class="text-center text-muted">Nenhum envio encontrado.</td></tr>`
          : dados
              .map(
                (l) => `
                  <tr>
                    <td>${l.professor_nome}</td>
                    <td>${l.data}</td>
                    <td>${
                      l.alunos
                        ? `<a href="${API_URL}/uploads/frequencias/${l.alunos}" target="_blank">📥 Baixar</a>`
                        : "—"
                    }</td>
                    <td>${l.turma || "—"}</td>
                  </tr>`
              )
              .join("");

      conteudo.innerHTML = `
        <header class="topbar"><h2>📄 Relatórios de Envios</h2></header>
        <div class="fade">
          <table class="table table-striped table-bordered">
            <thead class="table-dark">
              <tr>
                <th>Professor</th>
                <th>Data</th>
                <th>Arquivo</th>
                <th>Turma</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>`;
    } catch (erro) {
      conteudo.innerHTML = `<p class="text-danger">❌ Erro ao carregar relatórios.</p>`;
      console.error("Erro ao carregar relatórios:", erro);
    }
  }

  // ==================== PROFESSORES ====================
  async function carregarProfessores() {
    try {
      const resp = await fetch(`${API_URL}/api/professores/listar`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error("Erro " + resp.status);

      const dados = await resp.json();
      const tbody = document.querySelector("#tabelaProfessores tbody");

      if (!tbody) return;
      if (dados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>Nenhum professor cadastrado.</td></tr>";
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
              <td><button class="btn-excluir" data-id="${p.id}">🗑️ Excluir</button></td>
            </tr>`
        )
        .join("");

      document.querySelectorAll(".btn-excluir").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Tem certeza que deseja excluir este professor?")) return;
          const id = btn.dataset.id;

          try {
            const resp = await fetch(`${API_URL}/api/professores/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const resultado = await resp.json();

            if (resp.ok) {
              alert("✅ Professor excluído com sucesso!");
              carregarProfessores();
            } else {
              alert("⚠️ " + (resultado.erro || "Erro ao excluir professor."));
            }
          } catch (erro) {
            alert("Erro de comunicação com o servidor.");
            console.error(erro);
          }
        });
      });
    } catch (erro) {
      console.error("Erro ao carregar professores:", erro);
    }
  }

  // ==================== CADASTRO ====================
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
          carregarProfessores();
        } else {
          alert("⚠️ " + (dados.erro || "Erro ao cadastrar."));
        }
      } catch {
        alert("Erro de comunicação com o servidor.");
      }
    });
  }

  // ==================== LOGS ====================
  async function carregarLogs() {
    try {
      const resp = await fetch(`${API_URL}/api/logs/recentes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error("Erro " + resp.status);

      const dados = await resp.json();
      const tbody = document.querySelector("#tabelaLogs tbody");
      if (!tbody) return;

      if (dados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4'>Nenhuma ação recente.</td></tr>";
        return;
      }

      tbody.innerHTML = dados
        .map(
          (log) => `
            <tr>
              <td>${new Date(log.data_hora).toLocaleString("pt-BR")}</td>
              <td>${log.professor_nome || "—"}</td>
              <td>${log.acao}</td>
              <td>${log.detalhe || "—"}</td>
            </tr>`
        )
        .join("");
    } catch (erro) {
      console.error("Erro ao carregar logs:", erro);
    }
  }

  // ==================== ALTERAR SENHA ====================
  function configurarAlterarSenha() {
    const form = document.getElementById("formSenha");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const senhaAtual = document.getElementById("senhaAtual").value.trim();
      const novaSenha = document.getElementById("novaSenha").value.trim();
      const confirmarSenha = document.getElementById("confirmarSenha").value.trim();

      if (!senhaAtual || !novaSenha || !confirmarSenha) {
        alert("Preencha todos os campos antes de continuar.");
        return;
      }
      if (novaSenha !== confirmarSenha) {
        alert("As senhas não coincidem.");
        return;
      }

      try {
        const resp = await fetch(`${API_URL}/api/alterar-senha`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ senhaAtual, novaSenha }),
        });

        const dados = await resp.json();
        if (resp.ok) {
          alert("✅ Senha alterada com sucesso!");
          form.reset();
        } else {
          alert("⚠️ " + (dados.erro || "Erro ao alterar senha."));
        }
      } catch (erro) {
        console.error("Erro ao alterar senha:", erro);
        alert("Erro de comunicação com o servidor.");
      }
    });
  }

  // ==================== BACKUP ====================
  function configurarBackupGeral() {
    const btnBackup = document.getElementById("btnBackupGeral");
    if (!btnBackup) return;

    btnBackup.addEventListener("click", async () => {
      try {
        const resp = await fetch(`${API_URL}/api/backup/geral`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Erro " + resp.status);

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Backup_Geral_Todos.zip";
        a.click();
        a.remove();
      } catch (erro) {
        console.error("Erro no backup:", erro);
        alert("Erro ao gerar backup.");
      }
    });
  }

  // ==================== SEÇÕES ====================
  const secoes = {
    dashboard: `
      <header class="topbar"><h2>📊 Painel de Controle</h2></header>
      <div class="fade">
        <h4>📅 Ações Recentes</h4>
        <table class="table table-striped" id="tabelaLogs">
          <thead>
            <tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr>
          </thead>
          <tbody><tr><td colspan="4">Carregando...</td></tr></tbody>
        </table>
      </div>
    `,
    relatorios: `<header class="topbar"><h2>📄 Relatórios</h2></header><div class="fade"><p>Carregando...</p></div>`,
    professores: `
      <header class="topbar"><h2>👨‍🏫 Professores Ativos</h2></header>
      <div class="fade">
        <table class="table table-striped" id="tabelaProfessores">
          <thead>
            <tr><th>ID</th><th>Nome</th><th>Usuário</th><th>Tipo</th><th>Ações</th></tr>
          </thead>
          <tbody><tr><td colspan="5">Carregando...</td></tr></tbody>
        </table>
      </div>
    `,
    cadastro: `
      <header class="topbar"><h2>🧾 Cadastrar Novo Professor</h2></header>
      <div class="fade">
        <form>
          <label>Nome:</label><input type="text" class="form-control mb-2">
          <label>Usuário:</label><input type="text" class="form-control mb-2">
          <label>Senha:</label><input type="password" class="form-control mb-3">
          <button type="submit" class="btn btn-primary w-100">Cadastrar</button>
        </form>
      </div>
    `,
    config: `
      <header class="topbar"><h2>⚙️ Configurações</h2></header>
      <div class="fade">
        <section class="card">
          <h4>Alterar Senha</h4>
          <form id="formSenha">
            <label>Senha atual:</label><input type="password" id="senhaAtual" class="form-control mb-2">
            <label>Nova senha:</label><input type="password" id="novaSenha" class="form-control mb-2">
            <label>Confirmar nova senha:</label><input type="password" id="confirmarSenha" class="form-control mb-3">
            <button type="submit" class="btn btn-primary w-100">Atualizar</button>
          </form>
        </section>
        <section class="card mt-3">
          <h4>Backup Geral</h4>
          <button id="btnBackupGeral" class="btn btn-secondary w-100">📦 Baixar Backup Geral</button>
        </section>
      </div>
    `,
  };

  // ==================== TROCA DE ABAS ====================
  function ativarTrocaAbas() {
    navItems.forEach((item) => {
      item.addEventListener("click", async () => {
        document.querySelector(".nav-links li.active")?.classList.remove("active");
        item.classList.add("active");
        const secao = item.dataset.section;

        conteudo.innerHTML = secoes[secao] || "<p>Seção não encontrada.</p>";

        if (secao === "dashboard") carregarLogs();
        else if (secao === "relatorios") carregarRelatorios();
        else if (secao === "professores") carregarProfessores();
        else if (secao === "cadastro") configurarFormularioCadastro();
        else if (secao === "config") {
          configurarAlterarSenha();
          configurarBackupGeral();
        }
      });
    });
  }

  // ==================== INICIALIZAÇÃO ====================
  ativarTrocaAbas();
  conteudo.innerHTML = secoes.dashboard;
  carregarLogs();

  document.getElementById("logout")?.addEventListener("click", () => {
    if (confirm("Deseja realmente sair?")) {
      localStorage.removeItem("token");
      window.location.href = "index.html";
    }
  });
})();
