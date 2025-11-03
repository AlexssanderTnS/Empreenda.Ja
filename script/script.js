// ==================== CONFIGURAÇÕES GERAIS ====================
const API_URL = "https://empreenda-ja.onrender.com"; // endereço do backend

// --- Seletores ---
const modalLogin = document.getElementById("modalLogin");
const abrirLogin = document.getElementById("abrirLogin");
const fecharLogin = document.getElementById("fecharLogin");

// --- Abrir modal ---
if (abrirLogin) {
    abrirLogin.addEventListener("click", (e) => {
        e.preventDefault();
        modalLogin.style.display = "flex";
    });
}

// --- Fechar modal ---
if (fecharLogin) {
    fecharLogin.addEventListener("click", () => {
        modalLogin.style.display = "none";
    });
}

// ==================== LÓGICA DE LOGIN ====================
const form = document.getElementById("formLogin");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value.trim();
    const msg = document.getElementById("mensagemLogin");

    msg.textContent = "";
    msg.className = "mensagem-login"; // limpa estilos anteriores

    localStorage.removeItem("token");
    localStorage.removeItem("precisaTrocar");

    if (!usuario || !senha) {
      msg.textContent = "Preencha usuário e senha.";
      msg.classList.add("mostrar", "erro");
      return;
    }

    try {
      const resposta = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        msg.textContent = dados.erro || "Usuário ou senha incorretos.";
        msg.classList.add("mostrar", "erro");
        return;
      }

      // login bem-sucedido
      localStorage.setItem("token", dados.token);
      localStorage.setItem("precisaTrocar", dados.precisaTrocar ? "true" : "false");

      msg.textContent = "Login realizado com sucesso!";
      msg.classList.add("mostrar", "sucesso");

      // Redirecionamento após 1,5s
      setTimeout(() => {
        if (dados.tipo === "master") window.location.href = "/painel-master.html";
        else window.location.href = "/painel-professor.html";
      }, 1500);

    } catch (erro) {
      console.error("Erro na requisição:", erro);
      msg.textContent = "Erro ao conectar com o servidor.";
      msg.classList.add("mostrar", "erro");
    }
  });
}
