/* ================================================================
   1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
   ================================================================ */
import { db } from '../firebase-config.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, 
    onSnapshot, query, where, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
let USUARIO_ID = ""; 

/* ================================================================
   2. SEGURANÇA E AUTH (ESTADO DO USUÁRIO)
   ================================================================ */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html"; 
    } else {
        USUARIO_ID = user.uid; 
        const greeting = document.getElementById('user-greeting');
        if (greeting) greeting.innerText = `Olá, ${user.email.split('@')[0]}`;
        
        // Dispara as funções iniciais
        inicializarPainel(); 
        carregarDadosPerfil();
        gerarLinkVendedor(); 
    }
});

// Evento de Logout
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

/* ================================================================
   3. CORE: SINCRONIZAÇÃO EM TEMPO REAL (KPIs E LIVROS)
   ================================================================ */
function inicializarPainel() {
    // Filtra livros apenas do usuário logado (Regra SaaS)
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

            renderizarCardLivro(docSnap.id, livro, estoque, margem);
        });

        // Atualiza indicadores no topo
        const elEstoque = document.getElementById('total-estoque');
        const elLucro = document.getElementById('lucro-total');
        if (elEstoque) elEstoque.innerText = totalEstoque;
        if (elLucro) elLucro.innerText = `R$ ${lucroTotal.toFixed(2).replace('.', ',')}`;
        
        atualizarGraficos(dadosGrafico);
    });
}

/* ================================================================
   4. CONFIGURAÇÕES: PERFIL E GERADOR DE LINK
   ================================================================ */

// Busca dados existentes do perfil para preencher os inputs automaticamente
async function carregarDadosPerfil() {
    try {
        const docRef = doc(db, "configuracoes", USUARIO_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const dados = docSnap.data();
            document.getElementById('config-nome').value = dados.nome_loja || "";
            document.getElementById('config-whatsapp').value = dados.whatsapp || "";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

// Gera o link personalizado para a vitrine do cliente
function gerarLinkVendedor() {
    const inputLink = document.getElementById('link-vitrine');
    if (inputLink && USUARIO_ID) {
        // Altere para a URL real de produção quando publicar no GitHub Pages
        const urlBase = "https://viniciuslopesides-arch.github.io/furo-literario/vendedor.html";
        inputLink.value = `${urlBase}?id=${USUARIO_ID}`;
    }
}

// Função Global para o botão de copiar
window.copiarLink = () => {
    const input = document.getElementById('link-vitrine');
    if (!input.value) return alert("Salve seu perfil primeiro!");
    
    input.select();
    input.setSelectionRange(0, 99999); // Para dispositivos móveis
    navigator.clipboard.writeText(input.value);
    alert("Link copiado! 🚀");
};

// Salva ou atualiza os dados da loja (Nome e WhatsApp)
window.salvarPerfil = async () => {
    const nomeLoja = document.getElementById('config-nome').value.trim();
    const whats = document.getElementById('config-whatsapp').value.trim();

    if (!nomeLoja || !whats) return alert("Preencha o nome e o WhatsApp!");

    try {
        await setDoc(doc(db, "configuracoes", USUARIO_ID), {
            nome_loja: nomeLoja,
            whatsapp: whats,
            ownerID: USUARIO_ID,
            ultimaAlteracao: new Date()
        }, { merge: true });

        alert("Perfil atualizado com sucesso!");
        gerarLinkVendedor(); // Atualiza o link caso tenha mudado algo
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Erro ao salvar configurações.");
    }
};

/* ================================================================
   5. OPERAÇÕES DE DADOS (CRUD - LIVROS)
   ================================================================ */
const btnSalvar = document.getElementById('btnSalvarLivro');

btnSalvar?.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    
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
        alert("Erro ao salvar livro.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "Salvar no Acervo";
        delete btnSalvar.dataset.idEdicao;
    }
});

// Auxiliar para preencher formulário na edição
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

/* ================================================================
   6. INTERFACE E UI (CARDS E EXCLUSÃO)
   ================================================================ */
function renderizarCardLivro(id, livro, estoque, margem) {
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    const urlImagem = livro.capaURL || 'https://via.placeholder.com/150?text=Sem+Capa';
    
    const card = `
        <div class="livro-card ${statusClass}">
            <img src="${urlImagem}" class="capa-mini" onerror="this.src='https://via.placeholder.com/150?text=Erro+Capa';">
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p><small>Qtd: ${estoque} | Margem: R$ ${margem.toFixed(2)}</small></p>
            </div>
            <div class="acoes-card">
                <button class="btn-edit" id="edit-${id}">Editar</button>
                <button class="btn-del" onclick="window.deletarLivro('${id}')">Excluir</button>
            </div>
        </div>
    `;
    
    document.getElementById('listaLivros').insertAdjacentHTML('beforeend', card);

    document.getElementById(`edit-${id}`).addEventListener('click', () => {
        window.prepararEdicao(id, livro.titulo, livro.autor, livro.preco, estoque, livro.custo, livro.categoria, livro.capaURL || '');
    });
}

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

/* ================================================================
   7. GRÁFICOS (CHART.JS)
   ================================================================ */
let chartEstoque, chartLucro;
function atualizarGraficos(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');
    if (!ctxE || !ctxL) return;

    if (chartEstoque) chartEstoque.destroy();
    if (chartLucro) chartLucro.destroy();

    chartEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10) + "..."),
            datasets: [{ label: 'Qtd Estoque', data: dados.map(d => d.estoque), backgroundColor: '#2ecc71' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10) + "..."),
            datasets: [{ label: 'Lucro Previsto (R$)', data: dados.map(d => d.margemAcumulada), borderColor: '#27ae60', fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}