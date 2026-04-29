/* ================================================================
   1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
   ================================================================ */
// Buscando a configuração do Firebase na raiz (../) para centralizar os dados
import { db } from '../firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis Globais de Estado
const vitrine = document.getElementById('vitrine');
const cartCount = document.getElementById('cart-count');
let carrinho = [];      // Armazena os livros escolhidos pelo cliente
let todosOsLivros = []; // Cache local dos livros para busca rápida sem novo download

/* ================================================================
   2. SINCRONIZAÇÃO COM O FIREBASE (TEMPO REAL)
   ================================================================ */
// O onSnapshot mantém o site atualizado se você mudar algo no Admin
onSnapshot(collection(db, "livros"), (snapshot) => {
    todosOsLivros = []; // Limpa o cache para atualizar
    snapshot.forEach(docSnap => {
        todosOsLivros.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Renderiza a vitrine inicial com todos os livros que possuem estoque
    renderizarVitrine(todosOsLivros);
});

/* ================================================================
   3. LÓGICA DA VITRINE E FILTRO DE BUSCA
   ================================================================ */

// Função que desenha os cards na tela
function renderizarVitrine(lista) {
    vitrine.innerHTML = "";
    lista.forEach(livro => {
        // Regra de Ouro: Só mostra pro cliente se houver estoque disponível
        if (livro.estoque > 0) {
            vitrine.innerHTML += `
                <div class="livro-card">
                    <div class="capa-placeholder">📖</div>
                    <h3>${livro.titulo}</h3>
                    <p>${livro.autor} | ${livro.categoria || 'Geral'}</p>
                    <span class="preco">R$ ${livro.preco.toFixed(2)}</span>
                    <button class="btn-adicionar" onclick="adicionarAoCarrinho('${livro.id}', '${livro.titulo}', ${livro.preco})">
                        Adicionar
                    </button>
                </div>
            `;
        }
    });
}

// Filtro de Busca: Dispara a cada tecla digitada pelo cliente
document.getElementById('buscaLivro').addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosOsLivros.filter(l => 
        l.titulo.toLowerCase().includes(termo) || 
        l.autor.toLowerCase().includes(termo)
    );
    renderizarVitrine(filtrados);
});

/* ================================================================
   4. GESTÃO DO CARRINHO (ADICIONAR/REMOVER)
   ================================================================ */

// Adiciona itens ao array e dá feedback visual no botão
window.adicionarAoCarrinho = (id, titulo, preco) => {
    carrinho.push({ id, titulo, preco });
    cartCount.innerText = carrinho.length;
    
    // Feedback de sucesso no botão (UX)
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "✅ Adicionado!";
    btn.style.backgroundColor = "#2ecc71";
    
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.backgroundColor = "#004d26";
    }, 1200);
};

// Remove um item específico pelo índice
window.removerDoCarrinho = (index) => {
    carrinho.splice(index, 1);
    cartCount.innerText = carrinho.length;
    renderizarItensCarrinho(); // Atualiza a lista visual do modal
};

/* ================================================================
   5. CONTROLE DO MODAL E INTERFACE DO CARRINHO
   ================================================================ */

window.abrirCarrinho = () => {
    document.getElementById('modal-carrinho').style.display = 'block';
    renderizarItensCarrinho();
};

window.fecharCarrinho = () => {
    document.getElementById('modal-carrinho').style.display = 'none';
};

// Gera a lista de itens dentro do modal com o botão de excluir
function renderizarItensCarrinho() {
    const container = document.getElementById('itens-carrinho');
    const totalDisplay = document.getElementById('total-valor');
    container.innerHTML = "";
    let total = 0;

    if (carrinho.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#8b949e;'>Seu carrinho está vazio...</p>";
    }

    carrinho.forEach((item, index) => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#0d1117; padding:10px; border-radius:8px; margin-bottom:10px; border: 1px solid #30363d;">
                <div>
                    <strong style="display:block;">${item.titulo}</strong>
                    <span style="color:#2ecc71; font-size:0.9rem;">R$ ${item.preco.toFixed(2)}</span>
                </div>
                <button onclick="removerDoCarrinho(${index})" style="background:none; border:none; color:#e74c3c; cursor:pointer; padding: 5px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        total += item.preco;
    });

    totalDisplay.innerText = `R$ ${total.toFixed(2)}`;
}

/* ================================================================
   6. FINALIZAÇÃO (GERAÇÃO DA NOTA COM QUANTIDADES SOMADAS)
   ================================================================ */
window.enviarPedido = () => {
    if (carrinho.length === 0) {
        alert("Escolha pelo menos um livro antes de finalizar!");
        return;
    }
    
    const data = new Date().toLocaleDateString('pt-BR');
    const pedidoNum = Math.floor(Math.random() * 10000);

    // --- LÓGICA DE AGRUPAMENTO ---
    // Criamos um objeto para somar livros repetidos
    const contagemItens = {};
    
    carrinho.forEach(item => {
        if (contagemItens[item.titulo]) {
            contagemItens[item.titulo].quantidade += 1;
            contagemItens[item.titulo].subtotal += item.preco;
        } else {
            contagemItens[item.titulo] = {
                quantidade: 1,
                precoUnitario: item.preco,
                subtotal: item.preco
            };
        }
    });

    // --- CONSTRUÇÃO DO TEXTO DA NOTA ---
    let texto = `*FURO LITERÁRIO - PEDIDO #${pedidoNum}*\n`;
    texto += `_Data: ${data}_\n`;
    texto += `--------------------------------\n\n`;
    
    let totalLivros = 0;

    // Percorremos o objeto de contagem para escrever na nota
    for (const titulo in contagemItens) {
        const item = contagemItens[titulo];
        texto += `📖 *${item.quantidade}x ${titulo}*\n`;
        texto += `   Subtotal: R$ ${item.subtotal.toFixed(2)}\n\n`;
        totalLivros += item.subtotal;
    }
    
    const taxaEntrega = 5.00; 
    const totalGeral = totalLivros + taxaEntrega;

    texto += `--------------------------------\n`;
    texto += `Subtotal: R$ ${totalLivros.toFixed(2)}\n`;
    texto += `Entrega: R$ ${taxaEntrega.toFixed(2)}\n`;
    texto += `*TOTAL: R$ ${totalGeral.toFixed(2)}*\n`;
    texto += `--------------------------------\n`;
    texto += `*Endereço de Entrega:* \n(Por favor, digite seu endereço completo abaixo)`;

    const meuWhatsapp = "5592991222974"; // Seu número
    const url = `https://wa.me/${meuWhatsapp}?text=${encodeURIComponent(texto)}`;
    
    window.open(url, '_blank');
};

