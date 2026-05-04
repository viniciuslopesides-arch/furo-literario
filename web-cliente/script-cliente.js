/* ================================================================
   1. IMPORTAÇÕES E CONFIGURAÇÃO DE ROTA
   ================================================================ */
import { db } from '../firebase-config.js';
import { 
    collection, query, where, onSnapshot, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const VENDEDOR_ID = urlParams.get('id');

const vitrine = document.getElementById('vitrine');
let carrinho = [];      
let todosOsLivros = []; 
let dadosVendedor = { whatsapp: "5592991222974", nome_loja: "Furo Literário" };

// Bloqueio de acesso sem ID
if (!VENDEDOR_ID) {
    document.body.innerHTML = `<div class="erro-acesso"><h1>Loja não encontrada 🌌</h1><p>Verifique o link da vitrine.</p></div>`;
} else {
    inicializarVitrine();
}

/* ================================================================
   2. CARREGAMENTO DE DADOS (FIREBASE)
   ================================================================ */
async function inicializarVitrine() {
    // Busca dados da Loja/Vendedor
    const docRef = doc(db, "configuracoes", VENDEDOR_ID);
    const configSnap = await getDoc(docRef);
    
    if (configSnap.exists()) {
        dadosVendedor = configSnap.data();
        document.title = `${dadosVendedor.nome_loja} | Furo Literário`;
        const logoTitulo = document.getElementById('nome-loja-vitrine');
        if (logoTitulo) logoTitulo.innerText = dadosVendedor.nome_loja;
    }

    // Escuta livros em tempo real (apenas deste vendedor e com estoque)
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", VENDEDOR_ID));
    
    onSnapshot(qLivros, (snapshot) => {
        todosOsLivros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarVitrine(todosOsLivros);
    });
}

/* ================================================================
   3. RENDERIZAÇÃO DA VITRINE
   ================================================================ */
function renderizarVitrine(lista) {
    if (!vitrine) return;
    vitrine.innerHTML = "";

    const livrosDisponiveis = lista.filter(l => l.estoque > 0);

    if (livrosDisponiveis.length === 0) {
        vitrine.innerHTML = `<p class="carrinho-vazio">Nenhum livro disponível no momento.</p>`;
        return;
    }

    livrosDisponiveis.forEach(livro => {
        const urlCapa = livro.capaURL || 'https://via.placeholder.com/280x400/161b22/8b949e?text=Sem+Capa';
        
        const card = document.createElement('div');
        card.className = 'livro-card';
        card.innerHTML = `
            <div class="capa-container">
                <img src="${urlCapa}" alt="${livro.titulo}" class="capa-livro" loading="lazy">
            </div>
            <div class="livro-info">
                <h3>${livro.titulo}</h3>
                <p class="autor-cat">${livro.autor} | ${livro.categoria || 'Geral'}</p>
                <span class="preco">R$ ${livro.preco.toFixed(2).replace('.', ',')}</span>
                <button class="btn-adicionar" data-id="${livro.id}">
                    <i class="fas fa-plus"></i> Adicionar
                </button>
            </div>
        `;

        card.querySelector('.btn-adicionar').addEventListener('click', (e) => {
            adicionarAoCarrinho(livro, e.currentTarget);
        });

        vitrine.appendChild(card);
    });
}

/* ================================================================
   4. GESTÃO DO CARRINHO
   ================================================================ */
function adicionarAoCarrinho(livro, botao) {
    carrinho.push(livro);
    atualizarContador();

    // Feedback visual
    const original = botao.innerHTML;
    botao.innerHTML = `<i class="fas fa-check"></i> No Carrinho`;
    botao.style.background = "#2ecc71";
    botao.disabled = true;
    
    setTimeout(() => {
        botao.innerHTML = original;
        botao.style.background = "";
        botao.disabled = false;
    }, 800);
}

function atualizarContador() {
    const count = document.getElementById('cart-count');
    count.innerText = carrinho.length;
    count.style.display = carrinho.length > 0 ? 'flex' : 'none';
}

function renderizarItensCarrinho() {
    const container = document.getElementById('itens-carrinho');
    const totalDisplay = document.getElementById('total-valor');
    container.innerHTML = "";
    let total = 0;

    if (carrinho.length === 0) {
        container.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
        totalDisplay.innerText = "R$ 0,00";
        return;
    }

    carrinho.forEach((item, index) => {
        total += item.preco;
        const div = document.createElement('div');
        div.className = 'item-carrinho';
        div.innerHTML = `
            <div class="item-info">
                <h4>${item.titulo}</h4>
                <p>R$ ${item.preco.toFixed(2).replace('.', ',')}</p>
            </div>
            <button class="btn-remover-item" data-index="${index}">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    });

    totalDisplay.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;

    // Evento de remover
    document.querySelectorAll('.btn-remover-item').forEach(btn => {
        btn.onclick = () => {
            carrinho.splice(btn.dataset.index, 1);
            atualizarContador();
            renderizarItensCarrinho();
        };
    });
}

/* ================================================================
   5. FINALIZAÇÃO WHATSAPP
   ================================================================ */
function enviarPedido() {
    if (carrinho.length === 0) return alert("Adicione livros primeiro!");

    let texto = `📚 *NOVO PEDIDO - ${dadosVendedor.nome_loja.toUpperCase()}*\n\n`;
    let total = 0;

    // Agrupa repetidos para mensagem limpa
    const resumo = carrinho.reduce((acc, curr) => {
        acc[curr.titulo] = (acc[curr.titulo] || 0) + 1;
        return acc;
    }, {});

    for (const titulo in resumo) {
        const livro = carrinho.find(l => l.titulo === titulo);
        const qtd = resumo[titulo];
        texto += `📖 *${qtd}x* ${titulo} - R$ ${(livro.preco * qtd).toFixed(2)}\n`;
        total += (livro.preco * qtd);
    }

    texto += `\n*TOTAL: R$ ${total.toFixed(2)}*\n`;
    texto += `\n📍 *Favor informar endereço para entrega abaixo:*`;

    const fone = dadosVendedor.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(texto)}`, '_blank');
}

/* ================================================================
   6. EVENTOS DE INTERFACE
   ================================================================ */
const modal = document.getElementById('modal-carrinho');

document.getElementById('btn-carrinho-abrir').onclick = () => {
    modal.style.display = 'block';
    renderizarItensCarrinho();
};

document.getElementById('btn-fechar-modal').onclick = () => modal.style.display = 'none';
document.getElementById('btn-continuar').onclick = () => modal.style.display = 'none';
document.getElementById('btn-finalizar').onclick = enviarPedido;

// Filtro de busca
document.getElementById('buscaLivro').oninput = (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosOsLivros.filter(l => 
        l.titulo.toLowerCase().includes(termo) || l.autor.toLowerCase().includes(termo)
    );
    renderizarVitrine(filtrados);
};

// Filtro por categoria
document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.onclick = () => {
        document.querySelector('.btn-filtro.active').classList.remove('active');
        btn.classList.add('active');
        const cat = btn.dataset.categoria;
        const filtrados = cat === 'todos' ? todosOsLivros : todosOsLivros.filter(l => l.categoria === cat);
        renderizarVitrine(filtrados);
    };
});