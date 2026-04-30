/* ================================================================
   1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
   ================================================================ */
import { db } from '../firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis Globais de Estado
const vitrine = document.getElementById('vitrine');
const cartCount = document.getElementById('cart-count');
let carrinho = [];      
let todosOsLivros = []; 

/* ================================================================
   2. SINCRONIZAÇÃO COM O FIREBASE (TEMPO REAL)
   ================================================================ */
onSnapshot(collection(db, "livros"), (snapshot) => {
    todosOsLivros = []; 
    snapshot.forEach(docSnap => {
        todosOsLivros.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Renderiza a vitrine inicial
    renderizarVitrine(todosOsLivros);
});

/* ================================================================
   3. LÓGICA DA VITRINE E FILTROS (REVISADA)
   ================================================================ */

function renderizarVitrine(lista) {
    vitrine.innerHTML = "";

    if (lista.length === 0) {
        vitrine.innerHTML = `<p class="carrinho-vazio">Nenhum livro encontrado para esta busca.</p>`;
        return;
    }

    lista.forEach(livro => {
        if (livro.estoque > 0) {
            const urlCapa = livro.capa ? livro.capa : 'https://via.placeholder.com/280x400/161b22/8b949e?text=Sem+Capa';

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

            // Event listener moderno (evita erro de escopo do módulo)
            card.querySelector('.btn-adicionar').addEventListener('click', () => {
                adicionarAoCarrinho(livro.id, livro.titulo, livro.preco);
            });

            vitrine.appendChild(card);
        }
    });
}

// --- Filtro de Busca por Texto ---
document.getElementById('buscaLivro').addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosOsLivros.filter(l => 
        l.titulo.toLowerCase().includes(termo) || 
        l.autor.toLowerCase().includes(termo)
    );
    renderizarVitrine(filtrados);
});

// --- Filtro por Categorias (Botões Pílula) ---
document.querySelectorAll('.btn-filtro').forEach(botao => {
    botao.addEventListener('click', () => {
        // Ajuste visual dos botões
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
        botao.classList.add('active');

        const categoria = botao.getAttribute('data-categoria');
        
        if (categoria === 'todos') {
            renderizarVitrine(todosOsLivros);
        } else {
            const filtrados = todosOsLivros.filter(l => l.categoria === categoria);
            renderizarVitrine(filtrados);
        }
    });
});

/* ================================================================
   4. GESTÃO DO CARRINHO (ADICIONAR/REMOVER)
   ================================================================ */

// Adiciona ao carrinho com feedback visual
window.adicionarAoCarrinho = (id, titulo, preco) => {
    carrinho.push({ id, titulo, preco });
    
    // Atualiza o contador da bolinha vermelha
    const cartCount = document.getElementById('cart-count');
    cartCount.innerText = carrinho.length;
    cartCount.style.display = 'flex'; // Garante que apareça ao adicionar primeiro item

    // Feedback no botão (Usando event.currentTarget para maior precisão)
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = `<i class="fas fa-check"></i> Adicionado!`;
    btn.style.backgroundColor = "#2ecc71";
    btn.disabled = true; // Evita cliques duplos acidentais durante o delay
    
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.style.backgroundColor = "#004d26";
        btn.disabled = false;
    }, 1000);
};

window.removerDoCarrinho = (index) => {
    carrinho.splice(index, 1);
    document.getElementById('cart-count').innerText = carrinho.length;
    renderizarItensCarrinho(); 
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

// Fecha o modal se o usuário clicar fora da caixa branca
window.onclick = (event) => {
    const modal = document.getElementById('modal-carrinho');
    if (event.target == modal) {
        fecharCarrinho();
    }
};

function renderizarItensCarrinho() {
    const container = document.getElementById('itens-carrinho');
    const totalDisplay = document.getElementById('total-valor');
    container.innerHTML = "";
    let total = 0;

    if (carrinho.length === 0) {
        container.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio...</p>`;
        totalDisplay.innerText = "R$ 0,00";
        return;
    }

    carrinho.forEach((item, index) => {
        // Usando as classes que criamos no CSS (Seção 4)
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-carrinho';
        itemDiv.innerHTML = `
            <div class="item-info">
                <h4>${item.titulo}</h4>
                <p>R$ ${item.preco.toFixed(2).replace('.', ',')}</p>
            </div>
            <button class="btn-remover" onclick="removerDoCarrinho(${index})">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(itemDiv);
        total += item.preco;
    });

    totalDisplay.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

/* ================================================================
   6. FINALIZAÇÃO E ENVIO (WHATSAPP)
   ================================================================ */
window.enviarPedido = () => {
    if (carrinho.length === 0) {
        alert("Ops! Seu carrinho está vazio.");
        return;
    }
    
    const data = new Date().toLocaleDateString('pt-BR');
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Agrupamento de itens repetidos
    const resumo = {};
    carrinho.forEach(item => {
        resumo[item.titulo] = (resumo[item.titulo] || { qtd: 0, preco: item.preco });
        resumo[item.titulo].qtd++;
    });

    let texto = `📚 *PEDIDO - FURO LITERÁRIO*\n`;
    texto += `📅 _${data} às ${hora}_\n`;
    texto += `------------------------------------------\n\n`;
    
    let subtotalGeral = 0;

    for (const titulo in resumo) {
        const item = resumo[titulo];
        const subtotalItem = item.qtd * item.preco;
        texto += `📖 *${item.qtd}x* ${titulo}\n`;
        texto += `   R$ ${subtotalItem.toFixed(2).replace('.', ',')}\n\n`;
        subtotalGeral += subtotalItem;
    }
    
    const taxaEntrega = 5.00; 
    const totalFinal = subtotalGeral + taxaEntrega;

    texto += `------------------------------------------\n`;
    texto += `*Subtotal:* R$ ${subtotalGeral.toFixed(2).replace('.', ',')}\n`;
    texto += `*Entrega:* R$ ${taxaEntrega.toFixed(2).replace('.', ',')}\n`;
    texto += `💰 *TOTAL: R$ ${totalFinal.toFixed(2).replace('.', ',')}*\n\n`;
    texto += `------------------------------------------\n`;
    texto += `📍 *ENDEREÇO DE ENTREGA:*\n(Favor digitar abaixo: Rua, Número, Bairro e Ponto de Referência)`;

    const numeroWhats = "5592991222974";
    const link = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(texto)}`;
    
    window.open(link, '_blank');
};
