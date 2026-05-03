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
   2. SEGURANÇA E AUTH (CONTROLE DE ACESSO)
   ================================================================ */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Redireciona se não houver sessão ativa
        window.location.href = "login.html"; 
    } else {
        USUARIO_ID = user.uid; 
        
        // Atualiza saudação no Header
        const greeting = document.getElementById('user-greeting');
        if (greeting) greeting.innerText = `Olá, ${user.email.split('@')[0]}`;
        
        // Inicializa as rotinas do painel
        inicializarPainel(); 
        carregarDadosPerfil();
        gerarLinkVendedor(); 
    }
});

// Evento Global de Logout
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

/* ================================================================
   3. CORE: SINCRONIZAÇÃO EM TEMPO REAL (KPIs E LIVROS)
   ================================================================ */
function inicializarPainel() {
    // Escuta apenas documentos onde o ownerID é o usuário atual
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
            const preco = Number(livro.preco) || 0;
            const custo = Number(livro.custo) || 0;
            const margem = preco - custo;

            totalEstoque += estoque;
            lucroTotal += (margem * estoque);
            
            // Prepara dados para os gráficos do Chart.js
            dadosGrafico.push({ 
                titulo: livro.titulo || "Sem título", 
                estoque, 
                margemAcumulada: margem * estoque 
            });

            // Renderiza o card visual
            renderizarCardLivro(docSnap.id, livro, estoque, margem);
        });

        // Atualiza os contadores no dashboard (Seção 2 do HTML)
        const elEstoque = document.getElementById('total-estoque');
        const elLucro = document.getElementById('lucro-total');
        if (elEstoque) elEstoque.innerText = totalEstoque;
        if (elLucro) elLucro.innerText = `R$ ${lucroTotal.toFixed(2).replace('.', ',')}`;
        
        // Atualiza as barras e linhas (Seção 3 do HTML)
        atualizarGraficos(dadosGrafico);
    });
}

/* ================================================================
   4. CONFIGURAÇÕES: PERFIL E GERADOR DE LINK (SAAS)
   ================================================================ */

// Recupera dados salvos da loja para preencher o formulário
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

// Gera a URL única para a vitrine do cliente final
function gerarLinkVendedor() {
    const inputLink = document.getElementById('link-vitrine');
    if (inputLink && USUARIO_ID) {
        const urlBase = "https://viniciuslopesides-arch.github.io/furo-literario/web-cliente/";
        inputLink.value = `${urlBase}?id=${USUARIO_ID}`;
    }
}

// Copia o link gerado para a área de transferência
window.copiarLink = () => {
    const input = document.getElementById('link-vitrine');
    if (!input.value) return alert("Salve seu perfil primeiro!");
    
    input.select();
    input.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(input.value);
    alert("Link copiado para a bio! 🚀");
};

// Salva metadados da loja no Firestore
window.salvarPerfil = async () => {
    const nomeLoja = document.getElementById('config-nome').value.trim();
    const whats = document.getElementById('config-whatsapp').value.trim();

    if (!nomeLoja || !whats) return alert("Por favor, preencha o Nome e o WhatsApp.");

    try {
        await setDoc(doc(db, "configuracoes", USUARIO_ID), {
            nome_loja: nomeLoja,
            whatsapp: whats,
            ownerID: USUARIO_ID,
            ultimaAlteracao: new Date()
        }, { merge: true });

        alert("Configurações salvas com sucesso!");
        gerarLinkVendedor();
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Falha ao salvar configurações.");
    }
};

/* ================================================================
   5. OPERAÇÕES DE DADOS (CRUD - LIVROS)
   ================================================================ */
const btnSalvar = document.getElementById('btnSalvarLivro');

btnSalvar?.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Salvando...";

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
        console.error("Erro ao processar livro:", error);
        alert("Erro ao salvar. Verifique se todos os campos estão corretos.");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "Salvar no Acervo";
        delete btnSalvar.dataset.idEdicao;
    }
});

// Preenche o formulário para edição (Modo Update)
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
   6. INTERFACE E UI (RENDERIZAÇÃO DE CARDS)
   ================================================================ */
function renderizarCardLivro(id, livro, estoque, margem) {
    // Lógica de alerta visual para estoque
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    
    // Tratamento robusto para capas de livros
    const urlImagem = (livro.capaURL && livro.capaURL.trim() !== "") 
        ? livro.capaURL 
        : 'https://books.google.com/googlebooks/images/no_cover_thumb.gif';

    const card = `
        <div class="livro-card ${statusClass}">
            <img src="${urlImagem}" class="capa-mini" 
                 onerror="this.onerror=null;this.src='https://via.placeholder.com/150?text=Capa+Indisponivel';">
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p><small>Estoque: ${estoque} | Margem: R$ ${margem.toFixed(2).replace('.', ',')}</small></p>
            </div>
            <div class="acoes-card">
                <button class="btn-edit" id="edit-${id}">Editar</button>
                <button class="btn-del" onclick="window.deletarLivro('${id}')">Excluir</button>
            </div>
        </div>
    `;
    
    document.getElementById('listaLivros').insertAdjacentHTML('beforeend', card);

    // Event listener para edição segura
    document.getElementById(`edit-${id}`).addEventListener('click', () => {
        window.prepararEdicao(id, livro.titulo, livro.autor, livro.preco, estoque, livro.custo, livro.categoria, livro.capaURL || '');
    });
}

// Remoção definitiva do Firestore
window.deletarLivro = async (id) => { 
    if(confirm("Tem certeza que deseja remover este livro? Esta ação não pode ser desfeita.")) {
        try {
            await deleteDoc(doc(db, "livros", id));
        } catch (e) {
            console.error("Erro ao deletar:", e);
        }
    }
};

// Reseta o formulário após salvar ou cancelar
function limparFormulario() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
    const btn = document.getElementById('btnSalvarLivro');
    if (btn) {
        btn.innerText = "Salvar no Acervo";
        delete btn.dataset.idEdicao;
    }
}

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

    // Gráfico de Barras: Inventário
    chartEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.titulo.length > 12 ? d.titulo.substring(0,10) + "..." : d.titulo),
            datasets: [{ 
                label: 'Quantidade em Estoque', 
                data: dados.map(d => d.estoque), 
                backgroundColor: '#2ecc71' 
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Gráfico de Linha: Projeção de Lucro
    chartLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: dados.map(d => d.titulo.length > 12 ? d.titulo.substring(0,10) + "..." : d.titulo),
            datasets: [{ 
                label: 'Lucro Acumulado (R$)', 
                data: dados.map(d => d.margemAcumulada), 
                borderColor: '#27ae60', 
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}