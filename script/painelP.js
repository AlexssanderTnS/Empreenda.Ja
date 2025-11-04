// ==================== CONFIG ====================
const API_URL = "https://empreenda-ja.onrender.com";
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "index.html";
}



// Sair
document.getElementById("logout").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("precisaTrocar");
    window.location.href = "index.html";
});

document.addEventListener("DOMContentLoaded", () => {
    // 1) Leia a flag do localStorage
    const precisaTrocarLS = localStorage.getItem("precisaTrocar") === "true";

    // 2) (opcional) Confirme pelo JWT também — o backend inclui `precisaTrocar` no token
    let precisaTrocarJWT = false;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        precisaTrocarJWT = !!payload.precisaTrocar;
        // Saudação
        const nome = payload.nome || "Professor(a)";
        document.getElementById("bemvindo").innerText = `Bem-vindo(a), ${nome}!`;
    } catch (e) {
        console.warn("Falha ao ler payload do JWT:", e);
    }

    const precisaTrocar = precisaTrocarLS || precisaTrocarJWT;
    console.log("[painelP] precisaTrocar ->", { precisaTrocarLS, precisaTrocarJWT, precisaTrocar });

    // ===== TROCA DE SENHA =====
    if (precisaTrocar) {
        const modal = document.getElementById("modalTrocaSenha");
        if (!modal) {
            console.error("Elemento #modalTrocaSenha não encontrado no DOM.");
        } else {
            modal.style.display = "flex"; // precisa ter CSS que suporte 'flex' no overlay
        }

        const form = document.getElementById("formTrocaSenha");
        if (!form) {
            console.error("Elemento #formTrocaSenha não encontrado.");
        } else {
            form.addEventListener("submit", async (e) => {
                e.preventDefault();

                const senhaAtual = document.getElementById("senhaAtual").value.trim();
                const novaSenha = document.getElementById("novaSenha").value.trim();
                const confirmarSenha = document.getElementById("confirmarSenha").value.trim();

                if (!senhaAtual || !novaSenha || !confirmarSenha) {
                    alert("Preencha todos os campos!");
                    return;
                }
                if (novaSenha !== confirmarSenha) {
                    alert("As senhas novas não coincidem!");
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
                        localStorage.removeItem("precisaTrocar");
                        if (modal) modal.style.display = "none";
                    } else {
                        alert("⚠️ " + (dados.erro || "Erro ao alterar senha."));
                    }
                } catch (erro) {
                    console.error("Erro ao alterar senha:", erro);
                    alert("Erro de comunicação com o servidor.");
                }
            });
        }
    }

    // ===== DOWNLOAD DO MODELO =====
    const botaoDownload = document.getElementById("btnDownloadModelo");
    if (botaoDownload) {
        botaoDownload.addEventListener("click", async () => {
            try {
                const resp = await fetch(`${API_URL}/api/frequencia/modelo`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!resp.ok) {
                    const msg = await resp.text().catch(() => "");
                    console.warn("Falha ao baixar modelo:", resp.status, msg);
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
    }

    // ===== UPLOAD =====
    const formUpload = document.getElementById("formUpload");
    if (formUpload) {
        formUpload.addEventListener("submit", async (e) => {
            e.preventDefault();
            const arquivo = document.getElementById("arquivo").files[0];
            if (!arquivo) return alert("Selecione uma planilha antes de enviar.");

            const formData = new FormData();
            formData.append("arquivo", arquivo);

            try {
                const resp = await fetch(`${API_URL}/api/frequencia/upload`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                const dados = await resp.json();
                if (resp.ok) {
                    alert("✅ Enviado com sucesso!");
                    carregarEnvios();
                } else {
                    alert("⚠️ " + (dados.erro || "Erro ao enviar arquivo."));
                }
            } catch (erro) {
                console.error(erro);
                alert("Erro de comunicação com o servidor.");
            }
        });
    }

    carregarEnvios();
});

// ==================== LISTAR ENVIOS ====================
async function carregarEnvios() {
    try {
        const token = localStorage.getItem("token");
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

