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

        // Limpa qualquer sessão antiga antes de logar novamente
        localStorage.removeItem("token");
        localStorage.removeItem("precisaTrocar");

        if (!usuario || !senha) {
            alert("Preencha usuário e senha.");
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
                alert(dados.erro || "Usuário ou senha incorretos.");
                return;
            }

            // Guarda token e flag de troca de senha
            localStorage.setItem("token", dados.token);
            localStorage.setItem("precisaTrocar", dados.precisaTrocar ? "true" : "false");

            console.log("[login.js] Login bem-sucedido:", {
                usuario: dados.nome,
                tipo: dados.tipo,
                precisaTrocar: dados.precisaTrocar,
            });

            // Redirecionamento por tipo de usuário
            if (dados.tipo === "master") {
                window.location.href = "/painel-master.html";
            } else {
                window.location.href = "/painel-professor.html";
            }
        } catch (erro) {
            console.error("Erro na requisição:", erro);
            alert("Erro ao conectar com o servidor. Verifique sua conexão ou tente novamente mais tarde.");
        }
    });
}
