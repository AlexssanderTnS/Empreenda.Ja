// ==================== CONFIG ====================
const API_URL = "https://empreenda-ja.onrender.com";
const token = localStorage.getItem("token");
if (!token) window.location.href = "index.html";

// ==================== SAIR ====================
document.getElementById("logout")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("precisaTrocar");
  window.location.href = "index.html";
});

document.addEventListener("DOMContentLoaded", () => {
  const precisaTrocarLS = localStorage.getItem("precisaTrocar") === "true";

  let precisaTrocarJWT = false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    precisaTrocarJWT = !!payload.precisaTrocar;
    document.getElementById("bemvindo").innerText = `Bem-vindo(a), ${payload.nome || "Professor(a)"}!`;
  } catch {}

  const precisaTrocar = precisaTrocarLS || precisaTrocarJWT;

  // ===== TROCA DE SENHA =====
  if (precisaTrocar) {
    const modal = document.getElementById("modalTrocaSenha");
    if (modal) modal.style.display = "flex";

    const form = document.getElementById("formTrocaSenha");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const senhaAtual = document.getElementById("senhaAtual").value.trim();
      const novaSenha = document.getElementById("novaSenha").value.trim();
      const confirmarSenha = document.getElementById("confirmarSenha").value.trim();

      const msg = form.querySelector(".mensagem") || document.createElement("p");
      msg.className = "mensagem";
      form.appendChild(msg);
      msg.textContent = "";

      if (!senhaAtual || !novaSenha || !confirmarSenha) {
        msg.textContent = "Preencha todos os campos!";
        msg.classList.add("erro");
        return;
      }
      if (novaSenha !== confirmarSenha) {
        msg.textContent = "As senhas novas não coincidem!";
        msg.classList.add("erro");
        return;
      }

      try {
        const resp = await fetch(`${API_URL}/api/alterar-senha`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ senhaAtual, novaSenha }),
        });

        const dados = await resp.json();
        if (resp.ok) {
          msg.textContent = "✅ Senha alterada com sucesso!";
          msg.classList.add("sucesso");
          localStorage.removeItem("precisaTrocar");
          setTimeout(() => (modal.style.display = "none"), 1500);
        } else {
          msg.textContent = dados.erro || "Erro ao alterar senha.";
          msg.classList.add("erro");
        }
      } catch {
        msg.textContent = "Erro de comunicação com o servidor.";
        msg.classList.add("erro");
      }
    });
  }

  // ===== UPLOAD DE FREQUÊNCIA =====
  const formUpload = document.getElementById("formUpload");
  if (formUpload) {
    const msg = document.createElement("p");
    msg.id = "mensagemEnvio";
    msg.className = "mensagem";
    formUpload.parentNode.insertBefore(msg, formUpload.nextSibling);

    formUpload.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      msg.className = "mensagem";

      const turma = document.getElementById("turma")?.value.trim() || "—";
      const arquivo = document.getElementById("arquivo").files[0];
      if (!arquivo) {
        msg.textContent = "Selecione uma planilha antes de enviar.";
        msg.classList.add("erro");
        return;
      }

      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("turma", turma);

      try {
        const resp = await fetch(`${API_URL}/api/frequencia/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const dados = await resp.json();
        if (resp.ok) {
          msg.textContent = "✅ Enviado com sucesso!";
          msg.classList.add("sucesso");
          formUpload.reset();
          carregarEnvios();
        } else {
          msg.textContent = dados.erro || "Erro ao enviar arquivo.";
          msg.classList.add("erro");
        }
      } catch {
        msg.textContent = "Erro de comunicação com o servidor.";
        msg.classList.add("erro");
      }
    });
  }

  carregarEnvios();
});

// ==================== LISTAR ENVIOS ====================
async function carregarEnvios() {
  try {
    const resp = await fetch(`${API_URL}/api/minhas-frequencias`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const dados = await resp.json();
    const tbody = document.getElementById("lista-envios");

    if (!resp.ok || !Array.isArray(dados) || dados.length === 0) {
      tbody.innerHTML = "<tr><td colspan='3'>Nenhum envio registrado.</td></tr>";
      return;
    }

    tbody.innerHTML = dados
      .map(
        (f) => `
      <tr>
        <td>${f.data}</td>
        <td><a href="${API_URL}/uploads/frequencias/${f.alunos}" target="_blank">📂 ${f.alunos}</a></td>
        <td>${f.turma || "—"}</td>
      </tr>`
      )
      .join("");
  } catch {
    document.getElementById("lista-envios").innerHTML =
      "<tr><td colspan='3'>Erro ao carregar.</td></tr>";
  }
}
