// ==================== CONFIGURAÇÕES BÁSICAS ====================
const API_URL = "https://empreenda-ja.onrender.com";

// Recupera o token salvo pelo login
const token = localStorage.getItem("token");

// ==================== VERIFICAÇÃO DE LOGIN ====================
// Se não existir token, o usuário não tem sessão ativa
if (!token) {
    alert("Acesso negado! Faça login como master primeiro.");
    window.location.href = "index.html"; // volta para o início
}



// ==================== FUNÇÃO DE VERIFICAÇÃO DO TOKEN ====================
async function validarToken() {
    try {
        // Faz uma requisição simples só para testar o token
        const resp = await fetch(`${API_URL}/api/relatorios`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (resp.status === 401) {
            // 401 = token inválido ou expirado
            alert("Sua sessão expirou. Faça login novamente.");
            localStorage.removeItem("token");
            window.location.href = "index.html";
            return false;
        }

        if (!resp.ok) throw new Error("Erro ao validar sessão.");

        return true; // token está válido
    } catch (e) {
        console.error("Erro ao validar token:", e);
        alert("Erro de comunicação com o servidor. Tente novamente.");
        return false;
    }
}



// ==================== FUNÇÃO PRINCIPAL: CARREGAR RELATÓRIOS ====================
async function carregarRelatorios() {
    const tokenValido = await validarToken(); // valida antes de continuar
    if (!tokenValido) return; // se o token for inválido, encerra aqui

    try {
        const resposta = await fetch(`${API_URL}/api/relatorios`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!resposta.ok) throw new Error("Erro ao buscar relatórios");
        const dados = await resposta.json();

        const tbody = document.querySelector("#TabelaRelatorios tbody");
        tbody.innerHTML = ""; // limpa a tabela

        if (dados.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="text-center text-muted">Nenhum relatório encontrado.</td></tr>';
            return;
        }

        // Preenche a tabela dinamicamente
        dados.forEach((linha) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${linha.id}</td>
        <td>${linha.professor_nome}</td>
        <td>${linha.curso}</td>
        <td>${linha.local}</td>
        <td>${linha.turma}</td>
        <td>${linha.data}</td>
        <td>${linha.alunos}</td>`;
            tbody.appendChild(tr);
        });
    } catch (erro) {
        console.error("Erro ao carregar relatórios:", erro);
        alert("Erro ao carregar dados do servidor.");
    }
}



// ==================== EXPORTAÇÃO DE CSV ====================
document.getElementById("btnExportar").addEventListener("click", async () => {
    const tokenValido = await validarToken(); // garante que o token ainda é válido
    if (!tokenValido) return;

    // Gera o link de download
    const link = document.createElement("a");
    link.href = `${API_URL}/api/relatorios/export`;
    link.target = "_blank";
    link.setAttribute("Authorization", `Bearer ${token}`);
    link.click();
});



// ==================== EXECUÇÃO AUTOMÁTICA ====================
carregarRelatorios(); // roda assim que a página abre
