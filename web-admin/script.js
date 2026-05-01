// ================================================================
// 1. IMPORTAÇÕES (Dependências do Firebase)
// ================================================================
import { db } from '../firebase-config.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const auth = getAuth();
const storage = getStorage();
let USUARIO_ID = ""; // "Capitão" do acesso: define quem vê o quê.

// ================================================================
// 2. SEGURANÇA E AUTH (O Filtro do Sistema)
// ================================================================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html"; // Redireciona se não houver login
    } else {
        USUARIO_ID = user.uid; 
        document.getElementById('user-greeting').innerText = `Olá, ${user.email.split('@')[0]}`;
        inicializarPainel(); // Ativa os observadores de dados
    }
});

// Ação de Saída
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth));

// Exibe o nome do arquivo selecionado antes do upload
document.getElementById('capaLivro').addEventListener('change', (e) => {
    document.getElementById('nomeArquivo').innerText = e.target.files[0]?.name || "";
});

// ================================================================
// 3. CORE: SINCRONIZAÇÃO EM TEMPO REAL (Snapshot)
// ================================================================
function inicializarPainel() {
    // Filtra livros pelo ID do admin logado (Multi-tenancy)
    const qLivros = query(collection(db, "livros"), where("ownerID", "==", USUARIO_ID));
    
    onSnapshot(qLivros, (snapshot) => {
        const listaDiv = document.getElementById('listaLivros');
        listaDiv.innerHTML = ""; 
        let totalEstoque = 0, lucroTotal = 0;
        const dadosGrafico = [];

        snapshot.forEach((docSnap) => {
            const livro = docSnap.data();
            const estoque = Number(livro.estoque) || 0;
            const margem = (Number(livro.preco) || 0) - (Number(livro.custo) || 0);

            totalEstoque += estoque;
            lucroTotal += (margem * estoque);
            
            dadosGrafico.push({ titulo: livro.titulo, estoque, margemAcumulada: margem * estoque });
            renderizarCardLivro(docSnap.id, livro, estoque, margem);
        });

        // Atualiza UI global
        document.getElementById('total-estoque').innerText = totalEstoque;
        document.getElementById('lucro-total').innerText = `R$ ${lucroTotal.toFixed(2)}`;
        atualizarGraficos(dadosGrafico);
    });
}

// ================================================================
// 4. OPERAÇÕES DE DADOS (Create / Update / Upload)
// ================================================================
const btnSalvar = document.getElementById('btnSalvarLivro');

btnSalvar.addEventListener('click', async () => {
    const idEdicao = btnSalvar.dataset.idEdicao;
    const file = document.getElementById('capaLivro').files[0];
    
    // UI Feedback: Evita cliques duplos durante o processamento
    btnSalvar.disabled = true;
    btnSalvar.innerText = "Processando...";

    try {
        // Lógica de Imagem: Mantém a URL antiga se não subir uma nova
        let urlCapa = btnSalvar.dataset.urlAtual || ""; 
        if (file) {
            urlCapa = await subirCapa(file);
        }

        const dados = {
            titulo: document.getElementById('tituloLivro').value.trim(),
            autor: document.getElementById('autorLivro').value.trim(),
            categoria: document.getElementById('categoriaLivro').value,
            preco: Number(document.getElementById('precoLivro').value),
            custo: Number(document.getElementById('custoLivro').value),
            estoque: Number(document.getElementById('estoqueLivro').value),
            capaURL: urlCapa,
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
        console.error("Erro na operação:", error);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerText = "Salvar no Acervo";
        delete btnSalvar.dataset.idEdicao;
        delete btnSalvar.dataset.urlAtual;
    }
});

// "Lego" de Upload: Envia para o Firebase Storage
async function subirCapa(arquivo) {
    const storageRef = ref(storage, `capas/${USUARIO_ID}/${Date.now()}_${arquivo.name}`);
    const uploadTask = uploadBytesResumable(storageRef, arquivo);
    const progressBar = document.getElementById('uploadProgress');
    
    progressBar.style.display = 'block';

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
            (s) => progressBar.value = (s.bytesTransferred / s.totalBytes) * 100,
            (e) => reject(e),
            () => getDownloadURL(uploadTask.snapshot.ref).then(url => {
                progressBar.style.display = 'none';
                resolve(url);
            })
        );
    });
}

// ================================================================
// 5. AUXILIARES E UI (Renderização e Limpeza)
// ================================================================
window.prepararEdicao = (id, t, a, p, e, c, cat, url) => {
    document.getElementById('tituloLivro').value = t;
    document.getElementById('autorLivro').value = a;
    document.getElementById('precoLivro').value = p;
    document.getElementById('estoqueLivro').value = e;
    document.getElementById('custoLivro').value = c;
    document.getElementById('categoriaLivro').value = cat;
    
    btnSalvar.dataset.idEdicao = id;
    btnSalvar.dataset.urlAtual = url; 
    btnSalvar.innerText = "Atualizar Livro";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderizarCardLivro(id, livro, estoque, margem) {
    const statusClass = estoque <= 0 ? "status-zerado" : (estoque <= 5 ? "status-baixo" : "status-ok");
    const imgHtml = livro.capaURL ? `<img src="${livro.capaURL}" class="capa-mini">` : `<div class="capa-placeholder">Sem Capa</div>`;
    
    document.getElementById('listaLivros').innerHTML += `
        <div class="livro-card ${statusClass}">
            ${imgHtml}
            <div class="livro-info">
                <strong>${livro.titulo}</strong>
                <p><small>Estoque: ${estoque} | Lucro: R$ ${margem.toFixed(2)}</small></p>
            </div>
            <div class="acoes-card">
                <button class="btn-edit" onclick="prepararEdicao('${id}', '${livro.titulo}', '${livro.autor}', ${livro.preco}, ${estoque}, ${livro.custo}, '${livro.categoria}', '${livro.capaURL || ''}')">Editar</button>
                <button class="btn-del" onclick="window.deletarLivro('${id}')">Excluir</button>
            </div>
        </div>
    `;
}

// Excluir documento
window.deletarLivro = async (id) => { 
    if(confirm("Confirmar exclusão?")) await deleteDoc(doc(db, "livros", id));
};

function limparFormulario() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(i => i.value = "");
    document.getElementById('nomeArquivo').innerText = "";
    document.getElementById('capaLivro').value = "";
}

// ================================================================
// 6. GRÁFICOS (Visualização de Negócio)
// ================================================================
let chartEstoque, chartLucro;

function atualizarGraficos(dados) {
    const ctxE = document.getElementById('graficoEstoque');
    const ctxL = document.getElementById('graficoLucro');
    
    if (chartEstoque) chartEstoque.destroy();
    if (chartLucro) chartLucro.destroy();

    chartEstoque = new Chart(ctxE, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.titulo.substring(0,8)),
            datasets: [{ label: 'Qtd Estoque', data: dados.map(d => d.estoque), backgroundColor: '#2ecc71' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartLucro = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: dados.map(d => d.titulo.substring(0,8)),
            datasets: [{ label: 'Lucro (R$)', data: dados.map(d => d.margemAcumulada), borderColor: '#27ae60', fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}