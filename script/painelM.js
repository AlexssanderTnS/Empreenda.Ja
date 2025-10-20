// ==================== PAINEL MASTER COMPLETO (com exclusão funcional) ====================

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
    } catch {
      return false;
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

            const resultado = await resp.json();
            if (resp.ok) {
              alert('✅ Professor excluído com sucesso!');
              await carregarProfessores();
            } else {
              alert('⚠️ ' + (resultado.erro || 'Erro ao excluir professor.'));
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
        }
      });
    });
  }

  ativarTrocaAbas();
  conteudo.innerHTML = secoes.professores;
})();
