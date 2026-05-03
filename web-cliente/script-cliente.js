/* ================================================================
   1. IMPORTAÇÕES E CONFIGURAÇÃO DE ROTA (ID DO VENDEDOR)
   ================================================================ */
import { db } from '../firebase-config.js';
import { 
    collection, query, where, onSnapshot, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Captura o ID do vendedor pela URL (ex: vitrine.html?id=ABC123)
const urlParams = new URLSearchParams(window.location.search);
const VENDEDOR_ID = urlParams.get('id');

// Variáveis de Estado da Vitrine
const vitrine = document.getElementById('vitrine');
let carrinho = [];      
let todosOsLivros = []; 
let dadosVendedor = {
    whatsapp: "5592991222974", // Fallback (seu número)
    nome_loja: "Furo Literário"
};

// Verificação de segurança: Se não houver ID, impede o carregamento
if (!VENDEDOR_ID) {
    document.body.innerHTML = `
        <div style="text-align:center; padding:50px; color:white; background:#161b22; height:100vh;">
            <h1>Loja não encontrada 🌌</h1>
            <p>O link acessado é inválido ou a vitrine não existe.</p>
        </div>`;
} else {
    inicializarVitrine();
}

/* ================================================================
   2. SINCRONIZAÇÃO E BUSCA DE DADOS (DADOS DO VENDEDOR + LIVROS)
   ================================================================ */
async function inicializarVitrine() {
    // A. Busca Configurações do Vendedor (Nome da Loja e WhatsApp)
    const docRef = doc(db, "configuracoes", VENDEDOR_ID);
    const configSnap = await getDoc(docRef);
    
    if (configSnap.exists()) {
        dadosVendedor = configSnap.data();
        document.title = `${dadosVendedor.nome_loja} | Furo Literário`;
        
        // Se você tiver um elemento de título na página, atualiza aqui:
        const logoTitulo = document.getElementById('nome-loja-vitrine');
        if (logoTitulo) logoTitulo.innerText = dadosVendedor.nome_loja;
    }

    // B. Sincroniza Livros Filtrados pelo ownerID (Tempo Real)
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", VENDEDOR_ID));
    
    onSnapshot(qLivros, (snapshot) => {
        todosOsLivros = []; 
        snapshot.forEach(docSnap => {
            todosOsLivros.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderizarVitrine(todosOsLivros);
    });
}

/* ================================================================
   3. LÓGICA DE RENDERIZAÇÃO DA VITRINE
   ================================================================ */
function renderizarVitrine(lista) {
    if (!vitrine) return;
    vitrine.innerHTML = "";

    if (lista.length === 0) {
        vitrine.innerHTML = `<p class="carrinho-vazio">Esta livraria ainda não possui livros no acervo.</p>`;
        return;
    }

    lista.forEach(livro => {
        if (livro.estoque > 0) {
            // Usa capaURL do banco ou placeholder
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
                    <button class="btn-adicionar">
                        <i class="fas fa-plus"></i> Adicionar
                    </button>
                </div>
            `;

            card.querySelector('.btn-adicionar').addEventListener('click', (e) => {
                adicionarAoCarrinho(livro.id, livro.titulo, livro.preco, e);
            });

            vitrine.appendChild(card);
        }
    });
}

/* ================================================================
   4. GESTÃO DO CARRINHO (ADICIONAR/REMOVER)
   ================================================================ */
window.adicionarAoCarrinho = (id, titulo, preco, event) => {
    carrinho.push({ id, titulo, preco });
    
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.innerText = carrinho.length;
        cartCount.style.display = 'flex';
    }

    // Feedback visual no botão
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = `<i class="fas fa-check"></i> Adicionado!`;
    btn.style.backgroundColor = "#2ecc71";
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.style.backgroundColor = ""; // Volta ao CSS original
        btn.disabled = false;
    }, 1000);
};

window.removerDoCarrinho = (index) => {
    carrinho.splice(index, 1);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) cartCount.innerText = carrinho.length;
    renderizarItensCarrinho(); 
};

/* ================================================================
   5. CONTROLE DO MODAL DO CARRINHO
   ================================================================ */
window.abrirCarrinho = () => {
    const modal = document.getElementById('modal-carrinho');
    if (modal) {
        modal.style.display = 'block';
        renderizarItensCarrinho();
    }
};

window.fecharCarrinho = () => {
    const modal = document.getElementById('modal-carrinho');
    if (modal) modal.style.display = 'none';
};

function renderizarItensCarrinho() {
    const container = document.getElementById('itens-carrinho');
    const totalDisplay = document.getElementById('total-valor');
    if (!container) return;

    container.innerHTML = "";
    let total = 0;

    if (carrinho.length === 0) {
        container.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio...</p>`;
        if (totalDisplay) totalDisplay.innerText = "R$ 0,00";
        return;
    }

    carrinho.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-carrinho';
        itemDiv.innerHTML = `
            <div class="item-info">
                <h4>${item.titulo}</h4>
                <p>R$ ${item.preco.toFixed(2).replace('.', ',')}</p>
            </div>
            <button class="btn-remover" onclick="window.removerDoCarrinho(${index})">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(itemDiv);
        total += item.preco;
    });

    if (totalDisplay) totalDisplay.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

/* ================================================================
   6. FINALIZAÇÃO E ENVIO DINÂMICO (WHATSAPP DO VENDEDOR)
   ================================================================ */
window.enviarPedido = () => {
    if (carrinho.length === 0) {
        alert("Ops! Seu carrinho está vazio.");
        return;
    }
    
    const data = new Date().toLocaleDateString('pt-BR');
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Agrupa itens repetidos
    const resumo = {};
    carrinho.forEach(item => {
        resumo[item.titulo] = (resumo[item.titulo] || { qtd: 0, preco: item.preco });
        resumo[item.titulo].qtd++;
    });

    let texto = `📚 *NOVO PEDIDO - ${dadosVendedor.nome_loja.toUpperCase()}*\n`;
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
    
    // Taxa de entrega (Pode ser dinamizada futuramente no banco)
    const taxaEntrega = 5.00; 
    const totalFinal = subtotalGeral + taxaEntrega;

    texto += `------------------------------------------\n`;
    texto += `*Subtotal:* R$ ${subtotalGeral.toFixed(2).replace('.', ',')}\n`;
    texto += `*Entrega:* R$ ${taxaEntrega.toFixed(2).replace('.', ',')}\n`;
    texto += `💰 *TOTAL: R$ ${totalFinal.toFixed(2).replace('.', ',')}*\n\n`;
    texto += `------------------------------------------\n`;
    texto += `📍 *ENDEREÇO DE ENTREGA:*\n(Favor digitar abaixo: Rua, Número, Bairro e Ponto de Referência)`;

    // USA O WHATSAPP DO VENDEDOR QUE FOI BUSCADO NO INÍCIO
    const numeroWhats = dadosVendedor.whatsapp.replace(/\D/g, ''); // Remove caracteres não numéricos
    const link = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(texto)}`;
    
    window.open(link, '_blank');
};

/* ================================================================
   7. EVENTOS DE FILTRO
   ================================================================ */
document.getElementById('buscaLivro')?.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosOsLivros.filter(l => 
        l.titulo.toLowerCase().includes(termo) || 
        l.autor.toLowerCase().includes(termo)
    );
    renderizarVitrine(filtrados);
});

document.querySelectorAll('.btn-filtro').forEach(botao => {
    botao.addEventListener('click', () => {
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
        botao.classList.add('active');
        const categoria = botao.getAttribute('data-categoria');
        const filtrados = categoria === 'todos' ? todosOsLivros : todosOsLivros.filter(l => l.categoria === categoria);
        renderizarVitrine(filtrados);
    });
});