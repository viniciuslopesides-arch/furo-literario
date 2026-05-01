// ================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
// ================================================================
import { db } from '../firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, setDoc,
    onSnapshot, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
let USUARIO_ID = ""; 

// ================================================================
// 2. SEGURANÇA E CONTROLE DE ACESSO
// ================================================================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        USUARIO_ID = user.uid; 
        inicializarPainel();
    }
});

// ================================================================
// 3. ELEMENTOS DA INTERFACE (DOM)
// ================================================================
const listaDiv = document.getElementById('listaLivros');
const btnSalvar = document.getElementById('btnSalvarLivro');
const inputTaxa = document.getElementById('inputTaxa');
const tituloForm = document.getElementById('tituloForm');
const pedidosDiv = document.getElementById('listaPedidos');

const inputNomeLoja = document.getElementById('admin-name');
const inputWhatsLoja = document.getElementById('admin-whatsapp');

// ================================================================
// 4. SINCRONIZAÇÃO EM TEMPO REAL (Firestore)
// ================================================================
function inicializarPainel() {
    // Consulta Livros
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", USUARIO_ID));
    onSnapshot(qLivros, (snapshot) => {
        listaDiv.innerHTML = ""; 
        const dadosParaGrafico = []; 
        let totalItensEstoque = 0;
        let lucroTotalPrevisto = 0;

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;
            
            // Conversão segura de valores
            const estoque = Number(livro.estoque) || 0;
            const preco = Number(livro.preco) || 0;
            const custo = Number(livro.custo) || 0;
            const margemUnitaria = preco - custo;

            totalItensEstoque += estoque;
            lucroTotalPrevisto += (margemUnitaria * estoque);
            dadosParaGrafico.push({ titulo: livro.titulo || "Sem Título", estoque, preco, custo });

            renderizarCardLivro(id, livro, estoque, preco, margemUnitaria);
        });

        if (window.atualizarResumoFinanceiro) {
            window.atualizarResumoFinanceiro(snapshot.size, totalItensEstoque, lucroTotalPrevisto);
        }
        atualizarGraficos(dadosParaGrafico);
    });

    // Consulta Pedidos
    const qPedidos = query(collection(db, "pedidos"), where("adminID", "==", USUARIO_ID));
    onSnapshot(qPedidos, (snapshot) => {
        renderizarPedidos(snapshot);
    });

    // Consulta Configurações do Perfil
    onSnapshot(doc(db, "configuracoes", USUARIO_ID), (snap) => {
        if (snap.exists()) {
            const config = snap.data();
            if (inputTaxa) inputTaxa.value = config.taxa_entrega || 0;
            if (inputNomeLoja) inputNomeLoja.value = config.nome_loja || "";
            if (inputWhatsLoja) inputWhatsLoja.value = config.whatsapp || "";
        }
    });
}

// ================================================================
// 5. OPERAÇÕES DE DADOS (CRUD)
// ================================================================

// Auxiliar para converter input de preço (aceita virgula e ponto)
const parseMoeda = (valor) => Number(valor.toString().replace(/\s/g, '').replace(',', '.'));

btnSalvar.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    const whatsAdmin = inputWhatsLoja.value.trim();

    if (!whatsAdmin) return alert("Erro: Cadastre seu WhatsApp nas configurações antes de salvar livros!");

    const titulo = document.getElementById('tituloLivro').value.trim();
    if (!titulo) return alert("Erro: O título do livro é obrigatório!");

    const dados = {
        titulo: titulo,
        autor: document.getElementById('autorLivro').value.trim() || "Desconhecido",
        categoria: document.getElementById('categoriaLivro').value,
        preco: parseMoeda(document.getElementById('precoLivro').value),
        custo: parseMoeda(document.getElementById('custoLivro').value),
        estoque: Math.floor(Number(document.getElementById('estoqueLivro').value)) || 0,
        capaUrl: document.getElementById('capaLivroUrl').value.trim(),
        ownerID: USUARIO_ID, 
        whatsappVendedor: whatsAdmin,
        ultimoUpdate: new Date()
    };

    try {
        if (idEdicao) {
            await updateDoc(doc(db, "livros", idEdicao), dados);
            btnSalvar.innerText = "Salvar no Acervo";
            delete btnSalvar.dataset.idEdicao;
        } else {
            dados.timestamp = new Date(); // Criado em
            await addDoc(collection(db, "livros"), dados);
        }
        limparFormulario();
        alert("Sucesso: Livro salvo no catálogo! 📚");
    } catch (e) { 
        console.error("Erro ao salvar livro:", e);
        alert("Erro ao salvar no banco de dados.");
    }
});

window.salvarConfiguracoes = async () => {
    const dadosConfig = {
        nome_loja: inputNomeLoja.value.trim(),
        whatsapp: inputWhatsLoja.value.trim(),
        taxa_entrega: parseMoeda(inputTaxa.value)
    };
    
    try {
        await setDoc(doc(db, "configuracoes", USUARIO_ID), dadosConfig, { merge: true });
        alert("Perfil atualizado com sucesso! 🚀");
    } catch (e) {
        console.error("Erro ao salvar perfil:", e);
        alert("Erro ao atualizar configurações.");
    }
};

// ================================================================
// 6. FUNÇÕES DE APOIO E INTERFACE (HELPERS)
// ================================================================

function renderizarCardLivro(id, livro, estoque, preco, margem) {
    const classeStatus = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    const capa = livro.capaUrl || 'https://via.placeholder.com/150x200?text=Sem+Capa';
    
    listaDiv.innerHTML += `
        <div class="livro-card ${classeStatus}">
            <img src="${capa}" alt="${livro.titulo}"
                 style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
            <strong>📖 ${livro.titulo}</strong><br>
            <small>Autor: ${livro.autor}</small><br>
            <small>Venda: R$ ${preco.toFixed(2)} | Lucro: R$ ${margem.toFixed(2)}</small><br>
            <small>Estoque: <strong>${estoque}</strong> un</small>
            <div class="acoes-card">
                <button class="btn-edit" onclick="prepararEdicao('${id}', '${livro.titulo.replace(/'/g, "\\'")}', '${livro.autor.replace(/'/g, "\\'")}', ${preco}, ${estoque}, ${livro.custo}, '${livro.categoria}', '${livro.capaUrl}')">Editar</button>
                <button class="btn-del" onclick="deletarLivro('${id}')">Excluir</button>
            </div>
        </div>
    `;
}

function renderizarPedidos(snapshot) {
    pedidosDiv.innerHTML = snapshot.empty ? '<p style="padding:20px; opacity:0.6;">Nenhum pedido recebido ainda.</p>' : "";
    snapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const cores = { "Pendente": "#f39c12", "Pago": "#2ecc71", "Enviado": "#3498db" };
        pedidosDiv.innerHTML += `
            <div class="livro-card" style="border-left: 8px solid ${cores[p.status] || '#ddd'}">
                <strong>👤 ${p.nome_cliente || 'Cliente'}</strong><br>
                <small>${p.itens_resumo || 'Itens não listados'}</small><br>
                <small>Total: <strong>R$ ${Number(p.total || 0).toFixed(2)}</strong></small>
                <div style="margin-top:10px">
                    <select onchange="atualizarStatusPedido('${docSnap.id}', this.value)" style="padding: 5px; border-radius: 4px;">
                        <option value="Pendente" ${p.status === 'Pendente'?'selected':''}>Pendente</option>
                        <option value="Pago" ${p.status === 'Pago'?'selected':''}>Pago</option>
                        <option value="Enviado" ${p.status === 'Enviado'?'selected':''}>Enviado</option>
                    </select>
                    <button class="btn-del" onclick="deletarPedido('${docSnap.id}')" style="margin-left:5px">Apagar</button>
                </div>
            </div>`;
    });
}

function limparFormulario() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
    tituloForm.innerText = "Gerenciar Catálogo";
}

// Funções globais vinculadas ao objeto window
window.deletarLivro = async (id) => { if(confirm("Tem certeza que deseja excluir este livro?")) await deleteDoc(doc(db, "livros", id)); };
window.atualizarStatusPedido = async (id, s) => { await updateDoc(doc(db, "pedidos", id), { status: s }); };
window.deletarPedido = async (id) => { if(confirm("Apagar este registro de pedido permanentemente?")) await deleteDoc(doc(db, "pedidos", id)); };

window.prepararEdicao = (id, t, a, p, e, c, cat, url) => {
    document.getElementById('tituloLivro').value = t;
    document.getElementById('autorLivro').value = a;
    document.getElementById('precoLivro').value = p;
    document.getElementById('estoqueLivro').value = e;
    document.getElementById('custoLivro').value = c;
    document.getElementById('categoriaLivro').value = cat;
    document.getElementById('capaLivroUrl').value = url;
    
    btnSalvar.dataset.idEdicao = id;
    btnSalvar.innerText = "Atualizar Título";
    tituloForm.innerText = "Editando: " + t;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ================================================================
// 7. GRÁFICOS (Chart.js)
// ================================================================
let meuGraficoEstoque, meuGraficoLucro;

function atualizarGraficos(livros) {
    const canvasE = document.getElementById('graficoEstoque');
    const canvasL = document.getElementById('graficoLucro');
    if(!canvasE || !canvasL) return;

    const labels = livros.map(l => l.titulo.length > 12 ? l.titulo.substring(0, 10) + '...' : l.titulo);
    
    if (meuGraficoEstoque) meuGraficoEstoque.destroy();
    meuGraficoEstoque = new Chart(canvasE.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Itens em Estoque',
                data: livros.map(l => l.estoque),
                backgroundColor: livros.map(l => l.estoque <= 5 ? '#e74c3c' : '#27ae60')
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    if (meuGraficoLucro) meuGraficoLucro.destroy();
    meuGraficoLucro = new Chart(canvasL.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Lucro Potencial (R$)',
                data: livros.map(l => (l.preco - l.custo) * l.estoque),
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}