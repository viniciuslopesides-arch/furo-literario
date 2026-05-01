// ================================================================
// 1. IMPORTAÇÕES (Dependências do Firebase)
// ================================================================
import { db } from '../firebase-config.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
let USUARIO_ID = ""; 

// ================================================================
// 2. SEGURANÇA E AUTH
// ================================================================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html"; 
    } else {
        USUARIO_ID = user.uid; 
        const greeting = document.getElementById('user-greeting');
        if (greeting) greeting.innerText = `Olá, ${user.email.split('@')[0]}`;
        inicializarPainel(); 
    }
});

// Evento de Logout
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

// ================================================================
// 3. CORE: SINCRONIZAÇÃO EM TEMPO REAL
// ================================================================
function inicializarPainel() {
    // Filtra livros apenas do usuário logado (Regra de Negócio SaaS)
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", USUARIO_ID));
    
    onSnapshot(qLivros, (snapshot) => {
        const listaDiv = document.getElementById('listaLivros');
        if (!listaDiv) return;
        
        listaDiv.innerHTML = ""; 
        let totalEstoque = 0, lucroTotal = 0;
        const dadosGrafico = [];

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const estoque = Number(livro.estoque) || 0;
            const margem = (Number(livro.preco) || 0) - (Number(livro.custo) || 0);

            totalEstoque += estoque;
            lucroTotal += (margem * estoque);
            
            dadosGrafico.push({ 
                titulo: livro.titulo || "Sem título", 
                estoque, 
                margemAcumulada: margem * estoque 
            });

            // Renderiza o card visual do livro
            renderizarCardLivro(docSnap.id, livro, estoque, margem);
        });

        // Atualiza os indicadores de topo (KPIs)
        const elEstoque = document.getElementById('total-estoque');
        const elLucro = document.getElementById('lucro-total');
        if (elEstoque) elEstoque.innerText = totalEstoque;
        if (elLucro) elLucro.innerText = `R$ ${lucroTotal.toFixed(2)}`;
        
        // Sincroniza os gráficos com os novos dados
        atualizarGraficos(dadosGrafico);
    });
}

// ================================================================
// 4. CONFIGURAÇÕES: PERFIL DA LOJA
// ================================================================
async function salvarPerfil() {
    const user = auth.currentUser; 
    if (!user) return alert("Você precisa estar logado!");

    const nomeLoja = document.getElementById('config-nome').value.trim();
    const whats = document.getElementById('config-whatsapp').value.trim();

    try {
        await setDoc(doc(db, "configuracoes", user.uid), {
            nome_loja: nomeLoja,
            whatsapp: whats,
            ownerID: user.uid
        }, { merge: true });

        alert("Perfil atualizado!");
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
    }
}
window.salvarPerfil = salvarPerfil;

// ================================================================
// 5. OPERAÇÕES DE DADOS (Salvar / Editar / Deletar)
// ================================================================
const btnSalvar = document.getElementById('btnSalvarLivro');

btnSalvar?.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    
    // Bloqueia o botão para evitar duplicidade no Firebase
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Processando...";

    try {
        const dados = {
            titulo: document.getElementById('tituloLivro').value.trim(),
            autor: document.getElementById('autorLivro').value.trim(),
            categoria: document.getElementById('categoriaLivro').value,
            preco: Number(document.getElementById('precoLivro').value) || 0,
            custo: Number(document.getElementById('custoLivro').value) || 0,
            estoque: Number(document.getElementById('estoqueLivro').value) || 0,
            capaURL: document.getElementById('capaURL').value.trim(), 
            ownerID: USUARIO_ID,
            ultimoUpdate: new Date()
        };

        if (idEdicao) {
            await updateDoc(doc(db, "livros", idEdicao), dados);
        } else {
            await addDoc(collection(db, "livros"), dados);
        }
        
        limparFormulario();
    } catch (error) {
        console.error("Erro na operação:", error);
        alert("Erro ao salvar. Verifique o console.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "Salvar no Acervo";
        delete btnSalvar.dataset.idEdicao;
    }
});

// Prepara o formulário para edição (Preenchimento Automático)
window.prepararEdicao = (id, t, a, p, e, c, cat, url) => {
    document.getElementById('tituloLivro').value = t;
    document.getElementById('autorLivro').value = a;
    document.getElementById('precoLivro').value = p;
    document.getElementById('estoqueLivro').value = e;
    document.getElementById('custoLivro').value = c;
    document.getElementById('categoriaLivro').value = cat;
    document.getElementById('capaURL').value = url; 
    
    btnSalvar.dataset.idEdicao = id;
    btnSalvar.innerText = "Atualizar Livro";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ================================================================
// 6. AUXILIARES E UI (Renderização dos Cards)
// ================================================================
function renderizarCardLivro(id, livro, estoque, margem) {
    // Lógica de cores para o estoque (Usa o CSS definido no seu style.css)
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    
    // Tratamento para URL de imagem (Fallback para placeholder se falhar)
    const urlImagem = livro.capaURL || 'https://via.placeholder.com/150?text=Sem+Capa';
    
    const card = `
        <div class="livro-card ${statusClass}">
            <img src="${urlImagem}" class="capa-mini" onerror="this.src='https://via.placeholder.com/150?text=Erro+Capa';">
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p><small>Estoque: ${estoque} | Lucro: R$ ${margem.toFixed(2)}</small></p>
            </div>
            <div class="acoes-card">
                <button class="btn-edit" id="edit-${id}">Editar</button>
                <button class="btn-del" onclick="window.deletarLivro('${id}')">Excluir</button>
            </div>
        </div>
    `;
    
    const listaDiv = document.getElementById('listaLivros');
    listaDiv.insertAdjacentHTML('beforeend', card);

    // Evento de edição via ID para evitar erros de strings com aspas/espaços
    document.getElementById(`edit-${id}`).addEventListener('click', () => {
        window.prepararEdicao(id, livro.titulo, livro.autor, livro.preco, estoque, livro.custo, livro.categoria, livro.capaURL || '');
    });
}

// Exclusão de documento
window.deletarLivro = async (id) => { 
    if(confirm("Deseja realmente excluir este livro do acervo?")) {
        try {
            await deleteDoc(doc(db, "livros", id));
        } catch (e) {
            console.error("Erro ao deletar:", e);
        }
    }
};

function limparFormulario() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
    const btn = document.getElementById('btnSalvarLivro');
    if (btn) {
        btn.innerText = "Salvar no Acervo";
        delete btn.dataset.idEdicao;
    }
}

// ================================================================
// 7. GRÁFICOS (Chart.js)
// ================================================================
let chartEstoque, chartLucro;
function atualizarGraficos(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');
    if (!ctxE || !ctxL) return;

    if (chartEstoque) chartEstoque.destroy();
    if (chartLucro) chartLucro.destroy();

    // Gráfico de Barras: Estoque por Livro
    chartEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10) + "..."),
            datasets: [{ label: 'Qtd Estoque', data: dados.map(d => d.estoque), backgroundColor: '#2ecc71' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Gráfico de Linha: Lucro Acumulado
    chartLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10) + "..."),
            datasets: [{ label: 'Lucro (R$)', data: dados.map(d => d.margemAcumulada), borderColor: '#27ae60', backgroundColor: 'rgba(39, 174, 96, 0.1)', fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}