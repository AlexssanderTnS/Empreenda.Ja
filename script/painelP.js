const API_URL = "https://empreenda-ja.onrender.com";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "index.html";
}

document.getElementById("logout").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

// ===== BOTÃO DE DOWNLOAD DO MODELO =====
document.addEventListener("DOMContentLoaded", () => {
    const botaoDownload = document.getElementById("btnDownloadModelo");
    if (!botaoDownload) return;

    botaoDownload.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Você precisa estar logado para baixar o modelo.");
            window.location.href = "index.html";
            return;
        }

        try {
            const resp = await fetch("https://empreenda-ja.onrender.com/api/frequencia/modelo", {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!resp.ok) {
                alert("Erro ao baixar o modelo. Tente novamente.");
                return;
            }

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "Planilha.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (erro) {
            console.error("Erro no download:", erro);
            alert("Erro de comunicação com o servidor.");
        }
    });
});

// Saudação personalizada
(async () => {
    const payload = JSON.parse(atob(token.split(".")[1]));
    document.getElementById("bemvindo").innerText = `Bem-vindo(a), ${payload.nome}!`;
})();

// Upload de planilha
document.getElementById("formUpload").addEventListener("submit", async (e) => {
    e.preventDefault();
    const arquivo = document.getElementById("arquivo").files[0];
    if (!arquivo) return alert("Selecione uma planilha antes de enviar.");

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
        const resp = await fetch(`${API_URL}/api/frequencia/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        const dados = await resp.json();
        if (resp.ok) {
            alert("✅ Enviado com sucesso!");
            carregarEnvios();
        } else {
            alert("⚠️ " + (dados.erro || "Erro ao enviar arquivo"));
        }
    } catch (erro) {
        console.error(erro);
        alert("Erro de comunicação com o servidor.");
    }
});

// Listar envios
async function carregarEnvios() {
    try {
        const resp = await fetch(`${API_URL}/api/minhas-frequencias`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const dados = await resp.json();
        const tbody = document.getElementById("lista-envios");

        if (!resp.ok || !Array.isArray(dados) || dados.length === 0) {
            tbody.innerHTML = "<tr><td colspan='2'>Nenhum envio registrado.</td></tr>";
            return;
        }

        tbody.innerHTML = dados
            .map(
                (f) => `
        <tr>
            <td>${f.data}</td>
            <td><a href="${API_URL}/uploads/frequencias/${f.alunos}" target="_blank">📂 ${f.alunos}</a></td>
        </tr>`
            )
            .join("");
    } catch (erro) {
        console.error(erro);
        document.getElementById("lista-envios").innerHTML =
            "<tr><td colspan='2'>Erro ao carregar.</td></tr>";
    }
}

carregarEnvios();
