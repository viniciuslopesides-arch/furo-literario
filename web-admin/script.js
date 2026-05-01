// ================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO
// ================================================================
import { db } from '../firebase-config.js'; // Caminho baseado na sua estrutura de pastas
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, addDoc, doc, updateDoc, deleteDoc, 
    onSnapshot, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
let USUARIO_ID = ""; 

// ================================================================
// 2. SEGURANÇA: CONTROLE DE ACESSO
// ================================================================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Se não houver usuário, redireciona imediatamente
        window.location.href = "login.html";
    } else {
        USUARIO_ID = user.uid; 
        document.getElementById('user-greeting').innerText = `Olá, ${user.email.split('@')[0]}`;
        inicializarPainel();
    }
});

// Ação de Logout
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

// ================================================================
// 3. CORE: SINCRONIZAÇÃO EM TEMPO REAL
// ================================================================
function inicializarPainel() {
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", USUARIO_ID));
    
    // Escuta mudanças nos livros para atualizar UI e Gráficos
    onSnapshot(qLivros, (snapshot) => {
        const listaDiv = document.getElementById('listaLivros');
        listaDiv.innerHTML = ""; 
        
        let totalEstoque = 0;
        let lucroTotal = 0;
        const dadosGrafico = [];

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const id = docSnap.id;
            
            // Cálculos financeiros
            const estoque = Number(livro.estoque) || 0;
            const preco = Number(livro.preco) || 0;
            const custo = Number(livro.custo) || 0;
            const margem = preco - custo;

            totalEstoque += estoque;
            lucroTotal += (margem * estoque);
            
            dadosGrafico.push({ titulo: livro.titulo, estoque, margemAcumulada: margem * estoque });
            renderizarCardLivro(id, livro, estoque, preco, margem);
        });

        // Injeção de valores nos cards de destaque
        document.getElementById('total-estoque').innerText = totalEstoque;
        document.getElementById('lucro-total').innerText = `R$ ${lucroTotal.toFixed(2)}`;
        
        atualizarGraficos(dadosGrafico);
    });
}

// ================================================================
// 4. OPERAÇÕES CRUD (Create, Read, Update, Delete)
// ================================================================

const btnSalvar = document.getElementById('btnSalvarLivro');

btnSalvar.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    const dados = {
        titulo: document.getElementById('tituloLivro').value.trim(),
        autor: document.getElementById('autorLivro').value.trim(),
        categoria: document.getElementById('categoriaLivro').value,
        preco: Number(document.getElementById('precoLivro').value),
        custo: Number(document.getElementById('custoLivro').value),
        estoque: Number(document.getElementById('estoqueLivro').value),
        ownerID: USUARIO_ID,
        ultimoUpdate: new Date()
    };

    if (!dados.titulo) return alert("O título é obrigadamente necessário!");

    try {
        if (idEdicao) {
            // Modo Edição
            await updateDoc(doc(db, "livros", idEdicao), dados);
            btnSalvar.innerText = "Salvar no Acervo";
            delete btnSalvar.dataset.idEdicao;
        } else {
            // Modo Novo Cadastro
            await addDoc(collection(db, "livros"), dados);
        }
        limparFormulario();
    } catch (error) {
        console.error("Erro na operação:", error);
    }
});

// Vinculação global para botões dinâmicos (onclick)
window.deletarLivro = async (id) => { 
    if(confirm("Deseja apagar este livro permanentemente?")) {
        await deleteDoc(doc(db, "livros", id));
    }
};

window.prepararEdicao = (id, t, a, p, e, c, cat) => {
    document.getElementById('tituloLivro').value = t;
    document.getElementById('autorLivro').value = a;
    document.getElementById('precoLivro').value = p;
    document.getElementById('estoqueLivro').value = e;
    document.getElementById('custoLivro').value = c;
    document.getElementById('categoriaLivro').value = cat;
    
    btnSalvar.dataset.idEdicao = id;
    btnSalvar.innerText = "Atualizar Livro";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ================================================================
// 5. RENDERIZAÇÃO DE UI
// ================================================================
function renderizarCardLivro(id, livro, estoque, preco, margem) {
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    
    document.getElementById('listaLivros').innerHTML += `
        <div class="livro-card ${statusClass}">
            <strong>${livro.titulo}</strong>
            <p><small>Autor: ${livro.autor}</small></p>
            <p><small>Estoque: ${estoque} | Lucro: R$ ${margem.toFixed(2)}</small></p>
            <div class="acoes-card">
                <button class="btn-edit" onclick="prepararEdicao('${id}', '${livro.titulo}', '${livro.autor}', ${preco}, ${estoque}, ${livro.custo}, '${livro.categoria}')">Editar</button>
                <button class="btn-del" onclick="deletarLivro('${id}')">Excluir</button>
            </div>
        </div>
    `;
}

function limparFormulario() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
}

// ================================================================
// 6. GRÁFICOS (Chart.js)
// ================================================================
let chartEstoque, chartLucro;

function atualizarGraficos(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');

    if (chartEstoque) chartEstoque.destroy();
    chartEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10)),
            datasets: [{ label: 'Estoque', data: dados.map(d => d.estoque), backgroundColor: '#2ecc71' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    if (chartLucro) chartLucro.destroy();
    chartLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: dados.map(d => d.titulo.substring(0,10)),
            datasets: [{ label: 'Lucro Total (R$)', data: dados.map(d => d.margemAcumulada), borderColor: '#27ae60', fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}