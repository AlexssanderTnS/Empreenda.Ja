// ==================== PAINEL MASTER COMPLETO ====================

(function iniciarPainel() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarPainel);
    return;
  }

  console.log("✅ Painel Master inicializado");

  // ==================== CONFIGURAÇÕES ====================
  const API_URL = "https://empreenda-ja.onrender.com";
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
              <th>Data do Envio</th>
              <th>Arquivo</th>
              <th>Turma</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  } catch (erro) {
    conteudo.innerHTML = `<p class="text-danger">Erro ao carregar relatórios.</p>`;
    console.error("Erro ao carregar relatórios:", erro);
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
        .join("");

      document.querySelectorAll(".btn-excluir").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const confirmar = confirm("Tem certeza que deseja excluir este professor?");
          if (!confirmar) return;

          try {
            const resp = await fetch(`${API_URL}/api/professores/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });

            const resultado = await resp.json();
            if (resp.ok) {
              alert("✅ Professor excluído com sucesso!");
              await carregarProfessores();
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

  async function carregarLogs() {
    try {
      const resp = await fetch(`${API_URL}/api/logs/recentes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await resp.json();
      const tbody = document.querySelector("#tabelaLogs tbody");

      if (!resp.ok || dados.length === 0) {
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

    relatorios: `
      <header class="topbar"><h2>📄 Relatórios</h2></header>
      <div class="fade"><p>Carregando relatórios...</p></div>
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

    config: `
  <header class="topbar"><h2>⚙️ Configurações do Sistema</h2></header>
  <div class="fade">
    <section class="card mb-3">
      <h4>Alterar Senha</h4>
      <form id="formSenha">
        <label>Senha atual:</label>
        <input type="password" class="form-control mb-2" id="senhaAtual">
        <label>Nova senha:</label>
        <input type="password" class="form-control mb-2" id="novaSenha">
        <label>Confirmar nova senha:</label>
        <input type="password" class="form-control mb-3" id="confirmarSenha">
        <button type="submit" class="btn btn-primary w-100">Atualizar senha</button>
      </form>
    </section>

    <section class="card">
      <h4>Backup e Segurança</h4>
      <p>Último backup automático: <strong>21/10/2025 às 02:00</strong></p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button id="btnBackupGeral" class="btn">Baixar backup geral (todos os relatórios)</button>
    <button id="btnResetBanco" class="btn btn-danger">Resetar banco de dados (limpar tudo)</button>

        <button id="btnBackupHoje" class="btn">Baixar backup diário (arquivos de hoje)</button>
      </div>
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

        if (secao === "professores") {
          conteudo.innerHTML = secoes.professores;
          await carregarProfessores();

        } else if (secao === "cadastro") {
          conteudo.innerHTML = secoes.cadastro;
          configurarFormularioCadastro();

        } else if (secao === "relatorios") {
          await carregarRelatorios();

        } else if (secao === "config") {
          conteudo.innerHTML = secoes.config;
          configurarAlterarSenha(); // 👈 ativa o formulário de troca de senha
          configurarBotoesBackup(); // 👈 ativa os botões de backup (NOVO)
        }
        else {
          conteudo.innerHTML = secoes[secao] || "<p>Seção não encontrada.</p>";
        }
      });
    });
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
        alert("A nova senha e a confirmação não coincidem.");
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

  // ==================== BACKUP E SEGURANÇA ====================
  function configurarBotoesBackup() {
    console.log("Configurando botões de backup...");

    const token = localStorage.getItem("token");
    const btnBackupGeral = document.getElementById("btnBackupGeral");
    const btnBackup = document.getElementById("btnBackup");
    const btnBackupHoje = document.getElementById("btnBackupHoje");

    if (!btnBackupGeral && !btnBackup && !btnBackupHoje) {
      console.warn("Botões de backup ainda não renderizados no DOM.");
      return;
    }

    // --- BACKUP GERAL ---
    if (btnBackupGeral) {
      btnBackupGeral.addEventListener("click", async () => {
        console.log("Gerando backup geral (todos os relatórios)...");
        const resp = await fetch(`${API_URL}/api/backup/geral`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) {
          const msg = await resp.text();
          alert("Erro ao gerar backup geral: " + msg);
          return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Backup_Geral_Todos.zip";
        a.click();
        a.remove();
      });
    }

    // --- BACKUP COMPLETO ---
    if (btnBackup) {
      btnBackup.addEventListener("click", async () => {
        console.log(" Baixando último backup completo...");
        const resp = await fetch(`${API_URL}/api/backup/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) {
          const msg = await resp.text();
          alert("Erro ao baixar backup completo: " + msg);
          return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Backup_Completo.zip";
        a.click();
        a.remove();
      });
    }

    // --- BACKUP DIÁRIO ---
    if (btnBackupHoje) {
      btnBackupHoje.addEventListener("click", async () => {
        console.log("📅 Baixando backup diário...");
        const resp = await fetch(`${API_URL}/api/backup/hoje`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) {
          const msg = await resp.text();
          alert("Erro ao baixar backup diário: " + msg);
          return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Backup_Diario.zip";
        a.click();
        a.remove();
      });
    }
    const btnResetBanco = document.getElementById("btnResetBanco");
    if (btnResetBanco) {
      btnResetBanco.addEventListener("click", async () => {
        const confirmar = confirm("⚠️ Isso vai APAGAR todos os dados e reiniciar o sistema. Deseja continuar?");
        if (!confirmar) return;
  
        try {
          const resp = await fetch(`${API_URL}/api/resetar-banco`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
  
          const dados = await resp.json();
          if (resp.ok) {
            alert("✅ " + dados.mensagem);
            localStorage.removeItem("token");
            window.location.href = "index.html"; // força relogar como master
          } else {
            alert("⚠️ " + (dados.erro || "Erro ao resetar banco."));
          }
        } catch (erro) {
          console.error("Erro ao resetar banco:", erro);
          alert("Erro de comunicação com o servidor.");
        }
      });
  }
  // --- RESETAR BANCO DE DADOS ---
  }




  // ==================== INICIALIZAÇÃO ====================
  ativarTrocaAbas();
  conteudo.innerHTML = secoes.dashboard;
  carregarLogs();

  // ==================== BOTÃO DE SAIR ====================
  const btnLogout = document.getElementById("logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      const confirmar = confirm("Deseja realmente sair do sistema?");
      if (confirmar) {
        localStorage.removeItem("token");
        window.location.href = "index.html";
      }
    });
  }

  // ==================== BOTÕES DE BACKUP ====================
  // Espera o DOM carregar completamente antes de buscar os botões
  // ==================== BOTÕES DE BACKUP ====================
  window.addEventListener("load", () => {

    // Botão: Backup completo
    const btnBackup = document.getElementById("btnBackup");
    if (btnBackup) {
      btnBackup.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        if (!token) return alert("⚠️ Token não encontrado. Faça login novamente.");

        console.log("🔹 Baixando backup completo com token:", token.slice(0, 15) + "...");

        const resp = await fetch("https://empreenda-ja.onrender.com/api/backup/download", {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!resp.ok) {
          const msg = await resp.text();
          alert("Erro ao baixar backup completo: " + msg);
          return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Backup_Completo.zip";
        a.click();
        a.remove();
      });
    }

    // Botão: Backup diário
    const btnBackupHoje = document.getElementById("btnBackupHoje");
    if (btnBackupHoje) {
      btnBackupHoje.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        if (!token) return alert("⚠️ Token não encontrado. Faça login novamente.");

        console.log("🔹 Baixando backup diário com token:", token.slice(0, 15) + "...");

        const resp = await fetch("https://empreenda-ja.onrender.com/api/backup/hoje", {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!resp.ok) {
          const msg = await resp.text();
          alert("Erro ao baixar backup diário: " + msg);
          return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Backup_Diario.zip";
        a.click();
        a.remove();
      });
    }
  });




})();
