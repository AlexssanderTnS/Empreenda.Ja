const API_URL = "https://empreenda-ja.onrender.com"; // Troque pelo endereço do backend quando subir

const avisoLogin = document.getElementById("avisoLogin");
const modalLogin = document.getElementById("modalLogin");
const btnSim = document.getElementById("btnSim");
const btnNao = document.getElementById("btnNao");

// Mostrar o aviso assim que o site carregar
window.addEventListener("load", () => {
    avisoLogin.style.display = "flex";
});

btnSim.addEventListener("click", () => {
    avisoLogin.style.display = "none";
    modalLogin.style.display = "flex";
});

btnNao.addEventListener("click", () => {
    avisoLogin.style.display = "none";
});

// Lógica do login
document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuario = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    const resposta = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha })
    });

    const dados = await resposta.json();

    if (resposta.ok) {
        localStorage.setItem("token", dados.token);
        alert(`Bem-vindo(a), ${dados.nome}!`);

        if (dados.tipo === "master") {
            window.location.href = "painel-master.html";
        } else {
            window.location.href = "painel-professor.html";
        }
    } else {
        alert(dados.erro || "Erro ao efetuar login");
    }
});


document.getElementById("fecharAviso").addEventListener("click", () => {
    document.getElementById("avisoLogin").style.display = "none";
});

document.getElementById("fecharLogin").addEventListener("click", () => {
    document.getElementById("modalLogin").style.display = "none";
});