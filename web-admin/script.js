/* ================================================================
   1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
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

/* ================================================================
   2. SEGURANÇA E AUTH (CONTROLE DE ACESSO)
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
   3. CORE: SINCRONIZAÇÃO EM TEMPO REAL (KPIs E LIVROS)
   ================================================================ */
function inicializarPainel() {
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", USUARIO_ID));
    
    onSnapshot(qLivros, (snapshot) => {
        const listaDiv = document.getElementById('listaLivros');
        if (!listaDiv) return;
        
        listaDiv.innerHTML = ""; 
        let totalEstoque = 0, lucroTotalGeral = 0; 
        const dadosGrafico = [];

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const estoque = Number(livro.estoque) || 0;
            const lucroFaturado = Number(livro.lucroFaturado) || 0; 

            totalEstoque += estoque;
            lucroTotalGeral += lucroFaturado; 
            
            dadosGrafico.push({ 
                titulo: livro.titulo || "Sem título", 
                estoque, 
                faturamentoReal: lucroFaturado 
            });

            renderizarCardLivro(docSnap.id, livro, estoque, lucroFaturado);
        });

        const elEstoque = document.getElementById('total-estoque');
        const elLucro = document.getElementById('lucro-total');
        if (elEstoque) elEstoque.innerText = totalEstoque;
        if (elLucro) elLucro.innerText = `R$ ${lucroTotalGeral.toFixed(2).replace('.', ',')}`;
        
        atualizarGraficos(dadosGrafico);
    });
}

/* ================================================================
   4. CONFIGURAÇÕES: PERFIL E GERADOR DE LINK
   ================================================================ */
async function carregarDadosPerfil() {
    try {
        const docRef = doc(db, "configuracoes", USUARIO_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const dados = docSnap.data();
            if(document.getElementById('config-nome')) document.getElementById('config-nome').value = dados.nome_loja || "";
            if(document.getElementById('config-whatsapp')) document.getElementById('config-whatsapp').value = dados.whatsapp || "";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

function gerarLinkVendedor() {
    const inputLink = document.getElementById('link-vitrine');
    if (inputLink && USUARIO_ID) {
        const urlBase = "https://viniciuslopesides-arch.github.io/furo-literario/web-cliente/";
        inputLink.value = `${urlBase}?id=${USUARIO_ID}`;
    }
}

window.copiarLink = () => {
    const input = document.getElementById('link-vitrine');
    if (!input || !input.value) return alert("Salve seu perfil primeiro!");
    
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Link copiado para a bio! 🚀");
};

window.salvarPerfil = async () => {
    const nomeLoja = document.getElementById('config-nome').value.trim();
    const whats = document.getElementById('config-whatsapp').value.trim();

    if (!nomeLoja || !whats) return alert("Preencha o Nome e o WhatsApp.");

    try {
        await setDoc(doc(db, "configuracoes", USUARIO_ID), {
            nome_loja: nomeLoja,
            whatsapp: whats,
            ownerID: USUARIO_ID,
            ultimaAlteracao: new Date()
        }, { merge: true });

        alert("Configurações salvas!");
        gerarLinkVendedor();
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
    }
};

/* ================================================================
   5. OPERAÇÕES DE DADOS (CRUD - LIVROS)
   ================================================================ */
btnSalvar?.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    const titulo = document.getElementById('tituloLivro').value.trim();

    if (!titulo) return alert("O título é obrigatório.");

    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

    try {
        const dados = {
            titulo: titulo,
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
            dados.lucroFaturado = 0;
            await addDoc(collection(db, "livros"), dados);
        }
        
        limparFormulario();
    } catch (error) {
        console.error("Erro ao processar livro:", error);
        alert("Erro ao salvar.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "Salvar no Acervo";
    }
});

window.prepararEdicao = (id, t, a, p, e, c, cat, url) => {
    document.getElementById('tituloLivro').value = t;
    document.getElementById('autorLivro').value = a;
    document.getElementById('precoLivro').value = p;
    document.getElementById('estoqueLivro').value = e;
    document.getElementById('custoLivro').value = c;
    document.getElementById('categoriaLivro').value = cat;
    document.getElementById('capaURL').value = url; 
    
    btnSalvar.dataset.idEdicao = id;
    btnSalvar.innerText = "Atualizar Cadastro";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function limparFormulario() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
    if (btnSalvar) {
        btnSalvar.innerText = "Salvar no Acervo";
        delete btnSalvar.dataset.idEdicao;
    }
}

/* ================================================================
   6. INTERFACE E UI (RENDERIZAÇÃO E VENDAS)
   ================================================================ */
function renderizarCardLivro(id, livro, estoque, lucroFaturado) {
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    const urlImagem = (livro.capaURL && livro.capaURL.trim() !== "") 
        ? livro.capaURL 
        : 'https://books.google.com/googlebooks/images/no_cover_thumb.gif';

    const card = `
        <div class="livro-card ${statusClass}">
            <img src="${urlImagem}" class="capa-mini" onerror="this.onerror=null;this.src='https://books.google.com/googlebooks/images/no_cover_thumb.gif';">
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p><small>Estoque: ${estoque}</small></p>
                <p><small>Lucro Real: R$ ${lucroFaturado.toFixed(2).replace('.', ',')}</small></p>
            </div>
            <div class="acoes-card">
                <button class="btn-venda" onclick="window.registrarVenda('${id}', 1)" style="grid-column: span 2; background: #2ecc71; color:#0b2e13; font-weight:bold; border-radius:8px; padding:8px; border:none; cursor:pointer; margin-bottom:8px;">Venda Rápida (-1)</button>
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

window.registrarVenda = async (id, qtd) => {
    try {
        const docRef = doc(db, "livros", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const dados = snap.data();
        if (dados.estoque < qtd) return alert("Estoque esgotado.");

        const margemUnitaria = (Number(dados.preco) || 0) - (Number(dados.custo) || 0);

        await updateDoc(docRef, {
            estoque: increment(-qtd),
            lucroFaturado: increment(margemUnitaria * qtd)
        });
    } catch (e) {
        console.error("Erro na venda:", e);
    }
};

window.deletarLivro = async (id) => { 
    if(confirm("Deseja remover este livro?")) {
        try {
            await deleteDoc(doc(db, "livros", id));
        } catch (e) {
            console.error("Erro ao deletar:", e);
        }
    }
};

/* ================================================================
   7. ANÁLISE GRÁFICA (CHART.JS)
   ================================================================ */
let chartEstoque, chartLucro;
function atualizarGraficos(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');
    if (!ctxE || !ctxL) return;

    if (chartEstoque) chartEstoque.destroy();
    if (chartLucro) chartLucro.destroy();

    if (dados.length === 0) return;

    chartEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.titulo.length > 12 ? d.titulo.substring(0,10) + "..." : d.titulo),
            datasets: [{ 
                label: 'Estoque', 
                data: dados.map(d => d.estoque), 
                backgroundColor: '#2ecc71' 
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    chartLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10) + "..."),
            datasets: [{ 
                label: 'Lucro (R$)', 
                data: dados.map(d => d.faturamentoReal), 
                borderColor: '#27ae60', 
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}