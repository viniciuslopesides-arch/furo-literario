/* ================================================================
   1. CONFIGURAÇÃO E IMPORTS (FIRESTORE SDK)
   ================================================================ */
import { db } from '../firebase-config.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, 
    onSnapshot, query, where, setDoc, getDoc,
    increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
let USUARIO_ID = ""; 
const btnSalvar = document.getElementById('btnSalvarLivro');
const btnCancelar = document.getElementById('btnCancelarEdicao');
const fallbackCapa = 'https://books.google.com/googlebooks/images/no_cover_thumb.gif';

/* ================================================================
   2. SEGURANÇA E SESSÃO
   ================================================================ */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html"; 
    } else {
        USUARIO_ID = user.uid; 
        const greeting = document.getElementById('user-greeting');
        if (greeting) greeting.innerText = `Olá, ${user.email.split('@')[0]}`;
        
        inicializarPainel(); 
        carregarDadosPerfil();
        gerarLinkVendedor(); 
    }
});

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

/* ================================================================
   3. DASHBOARD EM TEMPO REAL (MÉTRICAS & GRÁFICOS)
   ================================================================ */
function inicializarPainel() {
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", USUARIO_ID));
    
    onSnapshot(qLivros, (snapshot) => {
        const listaDiv = document.getElementById('listaLivros');
        if (!listaDiv) return;
        
        listaDiv.innerHTML = ""; 
        let totalEstoque = 0, faturamentoLucro = 0; 
        const dadosGrafico = [];

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;
            
            const estoque = Number(livro.estoque) || 0;
            const lucroFaturado = Number(livro.lucroFaturado) || 0; 

            totalEstoque += estoque;
            faturamentoLucro += lucroFaturado; 
            
            dadosGrafico.push({ 
                titulo: livro.titulo || "Sem título", 
                estoque, 
                lucro: lucroFaturado 
            });

            renderizarCardLivro(id, livro);
        });

        const elEstoque = document.getElementById('total-estoque');
        const elLucro = document.getElementById('lucro-total');
        if (elEstoque) elEstoque.innerText = totalEstoque;
        if (elLucro) elLucro.innerText = `R$ ${faturamentoLucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        
        atualizarGraficosPremium(dadosGrafico);
    }, (error) => console.error("Erro na sincronização:", error));
}

/* ================================================================
   4. GESTÃO DE PERFIL E LINK DE VITRINE
   ================================================================ */
async function carregarDadosPerfil() {
    try {
        const docSnap = await getDoc(doc(db, "configuracoes", USUARIO_ID));
        if (docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('config-nome').value = d.nome_loja || "";
            document.getElementById('config-whatsapp').value = d.whatsapp || "";
            document.getElementById('inputTaxa').value = d.taxa_entrega || 0;
        }
    } catch (e) { console.error("Erro ao carregar perfil:", e); }
}

function gerarLinkVendedor() {
    const inputLink = document.getElementById('link-vitrine');
    if (inputLink && USUARIO_ID) {
        const origin = window.location.origin;
        const path = window.location.pathname.split('web-admin/')[0];
        inputLink.value = `${origin}${path}web-cliente/?id=${USUARIO_ID}`;
    }
}

document.getElementById('btnCopiarLink')?.addEventListener('click', () => {
    const input = document.getElementById('link-vitrine');
    if (!input || !input.value) return alert("Link não disponível.");
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Link copiado! 🚀");
});

document.getElementById('btnSalvarConfig')?.addEventListener('click', async () => {
    const nome = document.getElementById('config-nome').value.trim();
    const whats = document.getElementById('config-whatsapp').value.trim();
    const taxa = Number(document.getElementById('inputTaxa').value) || 0;

    if (!nome || !whats) return alert("Campos obrigatórios: Nome e WhatsApp.");

    try {
        await setDoc(doc(db, "configuracoes", USUARIO_ID), {
            nome_loja: nome,
            whatsapp: whats,
            taxa_entrega: taxa,
            ownerID: USUARIO_ID,
            ultimaAlteracao: new Date()
        }, { merge: true });
        alert("Configurações Salvas! ✅");
        gerarLinkVendedor();
    } catch (e) { alert("Erro ao salvar configurações."); }
});

/* ================================================================
   5. OPERAÇÕES DE LIVROS (CRUD)
   ================================================================ */
btnSalvar?.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    const titulo = document.getElementById('tituloLivro').value.trim();
    
    if (!titulo) return alert("O título é obrigatório.");

    const dados = {
        titulo: titulo,
        autor: document.getElementById('autorLivro').value.trim() || "Desconhecido",
        categoria: document.getElementById('categoriaLivro').value || "Outros",
        preco: Number(document.getElementById('precoLivro').value) || 0,
        custo: Number(document.getElementById('custoLivro').value) || 0,
        estoque: Number(document.getElementById('estoqueLivro').value) || 0,
        capaURL: document.getElementById('capaURL').value.trim() || "",
        ownerID: USUARIO_ID,
        ultimoUpdate: new Date()
    };

    btnSalvar.disabled = true;
    try {
        if (idEdicao) {
            await updateDoc(doc(db, "livros", idEdicao), dados);
            alert("Livro atualizado! 🔄");
        } else {
            dados.lucroFaturado = 0;
            await addDoc(collection(db, "livros"), dados);
            alert("Livro salvo no acervo! 📚");
        }
        limparFormulario();
    } catch (e) { alert("Erro ao salvar dados."); }
    finally { btnSalvar.disabled = false; }
});

btnCancelar?.addEventListener('click', limparFormulario);

function limparFormulario() {
    ['tituloLivro', 'autorLivro', 'precoLivro', 'estoqueLivro', 'custoLivro', 'capaURL'].forEach(id => {
        document.getElementById(id).value = "";
    });
    document.getElementById('categoriaLivro').value = "";
    btnSalvar.innerText = "Salvar no Acervo";
    delete btnSalvar.dataset.idEdicao;
    btnCancelar.style.display = "none";
    document.getElementById('tituloForm').innerText = "📝 Gerenciar Catálogo";
}

/* ================================================================
   6. RENDERIZAÇÃO E VENDAS (EXPOSTO AO WINDOW)
   ================================================================ */
function renderizarCardLivro(id, livro) {
    const estoque = Number(livro.estoque) || 0;
    const lucroFaturado = Number(livro.lucroFaturado) || 0;
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    const capaValida = (livro.capaURL && livro.capaURL.startsWith('http')) ? livro.capaURL : fallbackCapa;

    const tituloSeguro = livro.titulo.replace(/'/g, "\\'");
    const autorSeguro = (livro.autor || "Desconhecido").replace(/'/g, "\\'");

    const card = `
        <div class="livro-card ${statusClass}">
            <img src="${capaValida}" class="capa-mini" onerror="this.src='${fallbackCapa}'">
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p>Qtd: ${estoque} | Lucro: R$ ${lucroFaturado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            <div class="acoes-card">
                <button class="btn-venda" onclick="registrarVenda('${id}')">VENDER (-1)</button>
                <button class="btn-edit" onclick="prepararEdicao('${id}', '${tituloSeguro}', '${autorSeguro}', ${livro.preco}, ${estoque}, ${livro.custo}, '${livro.categoria}', '${livro.capaURL}')">Editar</button>
                <button class="btn-del" onclick="deletarLivro('${id}')">Excluir</button>
            </div>
        </div>`;
    document.getElementById('listaLivros').insertAdjacentHTML('beforeend', card);
}

// Tornando as funções globais para o HTML acessar
window.registrarVenda = async (id) => {
    const docRef = doc(db, "livros", id);
    const snap = await getDoc(docRef);
    const l = snap.data();
    if (l.estoque <= 0) return alert("Estoque esgotado!");
    const lucroUnitario = (Number(l.preco) || 0) - (Number(l.custo) || 0);
    await updateDoc(docRef, { estoque: increment(-1), lucroFaturado: increment(lucroUnitario) });
};

window.deletarLivro = async (id) => {
    if (confirm("Excluir este livro do acervo?")) await deleteDoc(doc(db, "livros", id));
};

window.prepararEdicao = (id, tit, aut, pre, est, cus, cat, img) => {
    document.getElementById('tituloLivro').value = tit;
    document.getElementById('autorLivro').value = aut;
    document.getElementById('precoLivro').value = pre;
    document.getElementById('estoqueLivro').value = est;
    document.getElementById('custoLivro').value = cus;
    document.getElementById('categoriaLivro').value = cat;
    document.getElementById('capaURL').value = img;
    
    btnSalvar.innerText = "Atualizar Livro";
    btnSalvar.dataset.idEdicao = id;
    btnCancelar.style.display = "block";
    document.getElementById('tituloForm').innerText = "🔄 Editando: " + tit;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ================================================================
   7. GRÁFICOS PREMIUM (CHART.JS)
   ================================================================ */
let chEstoque, chLucro;
function atualizarGraficosPremium(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');
    if (!ctxE || !ctxL) return;

    if (chEstoque) chEstoque.destroy();
    if (chLucro) chLucro.destroy();

    const labels = dados.map(d => d.titulo.length > 12 ? d.titulo.substring(0, 10) + '..' : d.titulo);
    const commonScales = {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
    };

    chEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Estoque', data: dados.map(d => d.estoque), backgroundColor: '#2ecc71', borderRadius: 5 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales }
    });

    chLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: 'Lucro', data: dados.map(d => d.lucro), borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales }
    });
}