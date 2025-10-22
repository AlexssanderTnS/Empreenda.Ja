document.addEventListener("DOMContentLoaded", () => {
    const precisaTrocar = localStorage.getItem("precisaTrocar") === "true";

    // ===== TROCA DE SENHA =====
    if (precisaTrocar) {
        const modal = document.getElementById("modalTrocaSenha");
        modal.style.display = "flex";

        const form = document.getElementById("formTrocaSenha");
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
                    modal.style.display = "none";
                } else {
                    alert("⚠️ " + (dados.erro || "Erro ao alterar senha."));
                }
            } catch (erro) {
                console.error("Erro ao alterar senha:", erro);
                alert("Erro de comunicação com o servidor.");
            }
        });
    }

    // ===== BOTÃO DE DOWNLOAD =====
    const botaoDownload = document.getElementById("btnDownloadModelo");
    if (botaoDownload) {
        botaoDownload.addEventListener("click", async () => {
            try {
                const resp = await fetch(`${API_URL}/api/frequencia/modelo`, {
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
    }

    // ===== SAUDAÇÃO =====
    const payload = JSON.parse(atob(token.split(".")[1]));
    document.getElementById("bemvindo").innerText = `Bem-vindo(a), ${payload.nome}!`;

    // ===== UPLOAD =====
    const formUpload = document.getElementById("formUpload");
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

    carregarEnvios();
});
