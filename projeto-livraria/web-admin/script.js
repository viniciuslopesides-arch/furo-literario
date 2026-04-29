// 1. IMPORTAÇÕES
import { db } from '../firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, 
    onSnapshot, getDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();

// 2. SEGURANÇA
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

// 3. ELEMENTOS
const listaDiv = document.getElementById('listaLivros');
const btnSalvar = document.getElementById('btnSalvarLivro');
const btnAtualizarTaxa = document.getElementById('btnAtualizarTaxa');
const inputTaxa = document.getElementById('inputTaxa');
const tituloForm = document.getElementById('tituloForm');
const pedidosDiv = document.getElementById('listaPedidos');
const resumoDiv = document.getElementById('resumoStatus');

// --- 4. LISTAGEM, GRÁFICOS E RESUMO (Sincronizados) ---
onSnapshot(collection(db, "livros"), (snapshot) => {
    listaDiv.innerHTML = ""; 
    const dadosParaGrafico = []; 
    let totalItensEstoque = 0;
    let lucroTotalPrevisto = 0;

    snapshot.forEach((docSnap) => {
        const livro = docSnap.data();
        const id = docSnap.id;
        const estoque = Number(livro.estoque);
        const preco = Number(livro.preco);
        const custo = Number(livro.custo || 0);
        const margemUnitaria = preco - custo;
        const autor = livro.autor || "Não informado"; // Ajuste para ler o autor

        // Acúmulo para o Resumo Financeiro
        totalItensEstoque += estoque;
        lucroTotalPrevisto += (margemUnitaria * estoque);

        dadosParaGrafico.push({ titulo: livro.titulo, estoque, preco, custo });

        // Interface do Inventário
        let classeStatus = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
        let badge = estoque <= 0 ? `<span class="badge-estoque badge-zerado">Indisponível</span>` : 
                    (estoque <= 5 ? `<span class="badge-estoque badge-baixo">Estoque Crítico</span>` : "");

        listaDiv.innerHTML += `
            <div class="livro-card ${classeStatus}">
                ${badge}<br>
                <strong>📖 ${livro.titulo}</strong><br>
                <small>Autor: ${autor}</small><br> <small>Venda: <strong>R$ ${preco.toFixed(2)}</strong> | Lucro Unit: R$ ${margemUnitaria.toFixed(2)}</small><br>
                <small>Estoque: <strong>${estoque}</strong> unidades</small>
                <div class="acoes-card">
                    <button class="btn-edit" onclick="prepararEdicao('${id}', '${livro.titulo}', '${autor}', ${preco}, ${estoque}, ${custo}, '${livro.categoria || ''}')">Editar</button>
                    <button class="btn-del" onclick="deletarLivro('${id}')">Excluir</button>
                </div>
                <button class="btn-venda" onclick="vendaRapida('${id}', 1)" ${estoque <= 0 ? 'disabled' : ''}>
                    ${estoque <= 0 ? 'Sem Estoque' : 'Simular Venda (-1)'}
                </button>
            </div>
        `;
    });

    // Atualiza os Cards de Resumo
    if (resumoDiv) {
        resumoDiv.innerHTML = `
            <div class="card-resumo-mini">
                <p>📚 <strong>Títulos:</strong> ${snapshot.size}</p>
            </div>
            <div class="card-resumo-mini">
                <p>📦 <strong>Total Estoque:</strong> ${totalItensEstoque} un.</p>
            </div>
            <div class="card-resumo-mini">
                <p>💰 <strong>Lucro Previsto:</strong> R$ ${lucroTotalPrevisto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
        `;
    }
    atualizarGrafico(dadosParaGrafico);
});

// --- 5. OPERAÇÕES DE DADOS (CRUD) ---
btnSalvar.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    const dados = {
        titulo: document.getElementById('tituloLivro').value,
        autor: document.getElementById('autorLivro').value, // Mantido: captura do autor
        categoria: document.getElementById('categoriaLivro').value,
        preco: Number(document.getElementById('precoLivro').value.replace(',', '.')),
        custo: Number(document.getElementById('custoLivro').value.replace(',', '.')),
        estoque: Number(document.getElementById('estoqueLivro').value)
    };

    if (!dados.titulo || isNaN(dados.preco)) return alert("Preencha título e preço corretamente!");

    try {
        if (idEdicao) {
            await updateDoc(doc(db, "livros", idEdicao), dados);
            delete btnSalvar.dataset.idEdicao;
            btnSalvar.innerText = "Salvar no Acervo";
            tituloForm.innerText = "Gerenciar Catálogo";
        } else {
            await addDoc(collection(db, "livros"), dados);
        }
        // Ajuste: Limpa todos os campos, inclusive o autor
        document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
    } catch (e) { console.error(e); }
});

// Logística
btnAtualizarTaxa.addEventListener('click', async () => {
    await updateDoc(doc(db, "configuracoes", "loja"), { taxa_entrega: Number(inputTaxa.value) });
    alert("Taxa atualizada! 🚚");
});

onSnapshot(doc(db, "configuracoes", "loja"), (snap) => {
    if (snap.exists()) inputTaxa.value = snap.data().taxa_entrega;
});

// Pedidos
onSnapshot(collection(db, "pedidos"), (snapshot) => {
    pedidosDiv.innerHTML = snapshot.empty ? '<p style="text-align: center; color: #999;">Sem pedidos.</p>' : "";
    snapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const cores = { "Pendente": "#f39c12", "Pago": "#2ecc71", "Enviado": "#3498db" };
        pedidosDiv.innerHTML += `
            <div class="livro-card" style="border-left: 8px solid ${cores[p.status] || '#ddd'}">
                <strong>👤 ${p.nome_cliente}</strong><br>
                <small>${p.itens_resumo} | Total: R$ ${Number(p.total).toFixed(2)}</small>
                <div style="margin-top:10px">
                    <select onchange="atualizarStatusPedido('${docSnap.id}', this.value)">
                        <option value="Pendente" ${p.status === 'Pendente'?'selected':''}>Pendente</option>
                        <option value="Pago" ${p.status === 'Pago'?'selected':''}>Pago</option>
                        <option value="Enviado" ${p.status === 'Enviado'?'selected':''}>Enviado</option>
                    </select>
                    <button class="btn-del" onclick="deletarPedido('${docSnap.id}')">Apagar</button>
                </div>
            </div>`;
    });
});

// --- 6. FUNÇÕES GLOBAIS ---
window.vendaRapida = async (id, qtd) => {
    const ref = doc(db, "livros", id);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().estoque >= qtd) await updateDoc(ref, { estoque: increment(-qtd) });
};

window.prepararEdicao = (id, t, a, p, e, c, cat) => {
    document.getElementById('tituloLivro').value = t;
    document.getElementById('autorLivro').value = a; // Ajuste: preenche o campo autor na edição
    document.getElementById('precoLivro').value = p;
    document.getElementById('estoqueLivro').value = e;
    document.getElementById('custoLivro').value = c;
    document.getElementById('categoriaLivro').value = cat;
    btnSalvar.dataset.idEdicao = id;
    btnSalvar.innerText = "Atualizar Título";
    tituloForm.innerText = "Editando: " + t;
    window.scrollTo(0, 0);
};

window.deletarLivro = async (id) => { if(confirm("Remover?")) await deleteDoc(doc(db, "livros", id)); };
window.atualizarStatusPedido = async (id, s) => { await updateDoc(doc(db, "pedidos", id), { status: s }); };
window.deletarPedido = async (id) => { if(confirm("Apagar pedido?")) await deleteDoc(doc(db, "pedidos", id)); };

// --- 7. GRÁFICOS ---
let meuGraficoEstoque, meuGraficoLucro;

function atualizarGrafico(livros) {
    const canvasE = document.getElementById('graficoEstoque');
    const canvasL = document.getElementById('graficoLucro');
    if(!canvasE || !canvasL) return;

    const ctxE = canvasE.getContext('2d');
    const ctxL = canvasL.getContext('2d');
    
    const labels = livros.map(l => l.titulo.substring(0, 10) + '...');
    
    if (meuGraficoEstoque) meuGraficoEstoque.destroy();
    meuGraficoEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Estoque',
                data: livros.map(l => l.estoque),
                backgroundColor: livros.map(l => l.estoque <= 5 ? '#e74c3c' : '#004d26')
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    if (meuGraficoLucro) meuGraficoLucro.destroy();
    meuGraficoLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Lucro Total',
                data: livros.map(l => ((l.preco - l.custo) * l.estoque).toFixed(2)),
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}