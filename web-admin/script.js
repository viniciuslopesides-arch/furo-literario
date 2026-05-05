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
    // Busca os livros vinculados ao ID do usuário logado
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
            
            // Conversão garantida para números para evitar erros de cálculo
            const estoque = Number(livro.estoque) || 0;
            const lucroFaturado = Number(livro.lucroFaturado) || 0; 

            totalEstoque += estoque;
            faturamentoLucro += lucroFaturado; 
            
            // Alimenta a lista que será enviada para o Chart.js
            dadosGrafico.push({ 
                titulo: livro.titulo || "Sem título", 
                estoque, 
                lucro: lucroFaturado 
            });

            // Chama a função global de renderização de cards (Certifique-se que ela aceite (id, livro))
            renderizarCardLivro(id, livro);
        });

        // Atualização dos Painéis Numéricos (KPIs) com formatação brasileira
        const elEstoque = document.getElementById('total-estoque');
        const elLucro = document.getElementById('lucro-total');
        if (elEstoque) elEstoque.innerText = totalEstoque;
        if (elLucro) elLucro.innerText = `R$ ${faturamentoLucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        
        // Dispara a atualização visual dos gráficos
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
            const inputNome = document.getElementById('config-nome');
            const inputWhats = document.getElementById('config-whatsapp');
            const inputTaxa = document.getElementById('inputTaxa');

            if (inputNome) inputNome.value = d.nome_loja || d.nome_lo_ja || "";
            if (inputWhats) inputWhats.value = d.whatsapp || "";
            if (inputTaxa) inputTaxa.value = d.taxa_entrega || 0;
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

window.copiarLink = () => {
    const input = document.getElementById('link-vitrine');
    if (!input || !input.value) return alert("Link não disponível.");
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Link copiado para a área de transferência! 🚀");
};

window.salvarPerfil = async () => {
    const nome = document.getElementById('config-nome').value.trim();
    const whats = document.getElementById('config-whatsapp').value.trim();
    const taxa = Number(document.getElementById('inputTaxa').value) || 0;

    if (!nome || !whats) return alert("Campos obrigatórios: Nome e WhatsApp.");

    try {
        await setDoc(doc(db, "configuracoes", USUARIO_ID), {
            nome_loja: nome,
            nome_lo_ja: nome, // Compatibilidade legada
            whatsapp: whats,
            taxa_entrega: taxa,
            ownerID: USUARIO_ID,
            ultimaAlteracao: new Date()
        }, { merge: true });
        alert("Configurações Premium Salvas! ✅");
        gerarLinkVendedor();
    } catch (e) { alert("Erro ao salvar configurações."); }
};

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
        capaURL: document.getElementById('capaURL').value.trim(),
        ownerID: USUARIO_ID,
        ultimoUpdate: new Date()
    };

    btnSalvar.disabled = true;
    try {
        if (idEdicao) {
            await updateDoc(doc(db, "livros", idEdicao), dados);
        } else {
            dados.lucroFaturado = 0;
            await addDoc(collection(db, "livros"), dados);
        }
        limparFormulario();
    } catch (e) { alert("Erro ao salvar dados do livro."); }
    finally { btnSalvar.disabled = false; }
});

function limparFormulario() {
    document.querySelectorAll('.secao input, .secao select').forEach(i => i.value = "");
    btnSalvar.innerText = "Salvar no Acervo";
    delete btnSalvar.dataset.idEdicao;
}

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

/* ================================================================
   6. RENDERIZAÇÃO E VENDAS
   ================================================================ */
function renderizarCardLivro(id, livro, estoque, lucroFaturado) {
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    const capaValida = (livro.capaURL && livro.capaURL.startsWith('http')) ? livro.capaURL : fallbackCapa;

    const card = `
        <div class="livro-card ${statusClass}">
            <img src="${capaValida}" class="capa-mini" onerror="this.src='${fallbackCapa}'">
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p>Qtd: ${estoque} | Lucro: R$ ${lucroFaturado.toFixed(2).replace('.', ',')}</p>
            </div>
            <div class="acoes-card">
                <button class="btn-venda" onclick="window.registrarVenda('${id}')" style="grid-column: span 2; background: var(--accent-green); color: #000; font-weight: bold; margin-bottom: 8px;">VENDER (-1)</button>
                <button class="btn-edit" onclick="prepararEdicao('${id}', \`${livro.titulo}\`, \`${livro.autor}\`, ${livro.preco}, ${estoque}, ${livro.custo}, '${livro.categoria}', '${livro.capaURL}')">Editar</button>
                <button class="btn-del" onclick="window.deletarLivro('${id}')">Excluir</button>
            </div>
        </div>`;
    document.getElementById('listaLivros').insertAdjacentHTML('beforeend', card);
}

window.registrarVenda = async (id) => {
    try {
        const docRef = doc(db, "livros", id);
        const snap = await getDoc(docRef);
        const dados = snap.data();
        
        if (dados.estoque <= 0) return alert("Produto esgotado!");

        const margem = Number(dados.preco) - Number(dados.custo);
        await updateDoc(docRef, {
            estoque: increment(-1),
            lucroFaturado: increment(margem)
        });
    } catch (e) { console.error("Erro na venda:", e); }
};

window.deletarLivro = async (id) => {
    if (confirm("Remover este item do acervo?")) {
        try { await deleteDoc(doc(db, "livros", id)); } 
        catch (e) { console.error(e); }
    }
};

/* ================================================================
   7. GRÁFICOS PREMIUM (CHART.JS)
   ================================================================ */
let chEstoque, chLucro;
function atualizarGraficosPremium(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');
    
    // Se os elementos não existirem no HTML, interrompe a execução
    if (!ctxE || !ctxL) return;

    // Destrói instâncias anteriores para evitar sobreposição e vazamento de memória
    if (chEstoque) chEstoque.destroy();
    if (chLucro) chLucro.destroy();

    // Tratamento de nomes longos nos labels para não quebrar o layout
    const labels = dados.map(d => d.titulo.length > 12 ? d.titulo.substring(0, 10) + '..' : d.titulo);
    
    // Configuração de escalas compartilhada (Sincronizada com o tema Dark Elite)
    const commonScales = {
        y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255, 255, 255, 0.05)' }, // Linhas de grade sutis
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } 
        },
        x: { 
            grid: { display: false }, 
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } 
        }
    };

    // Configuração do Gráfico de Barras (Estoque)
    chEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ 
                label: 'Estoque', 
                data: dados.map(d => d.estoque), 
                backgroundColor: '#2ecc71', 
                borderRadius: 5 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, // Fundamental para obedecer o container CSS
            plugins: { 
                legend: { display: false },
                tooltip: { backgroundColor: '#161a1d', titleColor: '#2ecc71' } 
            },
            scales: commonScales 
        }
    });

    // Configuração do Gráfico de Linha (Lucro)
    chLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ 
                label: 'Lucro', 
                data: dados.map(d => d.lucro), 
                borderColor: '#2ecc71', 
                backgroundColor: 'rgba(46, 204, 113, 0.1)', 
                fill: true, 
                tension: 0.4, 
                pointRadius: 4,
                pointBackgroundColor: '#2ecc71'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: { backgroundColor: '#161a1d', titleColor: '#2ecc71' }
            },
            scales: commonScales 
        }
    });
}