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

// --- Lógica do login ---
const form = document.getElementById("formLogin");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuario = document.getElementById("usuario").value.trim();
        const senha = document.getElementById("senha").value.trim();

        try {
            const resposta = await fetch(`${API_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, senha }),
            });

            const dados = await resposta.json();
            localStorage.setItem("token", dados.token);
            localStorage.setItem("precisaTrocar", dados.precisaTrocar ? "true" : "false");


            if (!resposta.ok) {
                alert(dados.erro || "Usuário ou senha incorretos");
                return;
            }
            localStorage.setItem("token", dados.token);

            // Redirecionamento
            if (dados.tipo === "master") {
                window.location.href = "/painel-master.html";
            } else {
                window.location.href = "/painel-professor.html";
            }
        } catch (erro) {
            console.error("Erro na requisição:", erro);
            alert("Erro ao conectar com o servidor.");
        }
    });
}


