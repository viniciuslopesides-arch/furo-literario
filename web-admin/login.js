// ================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
// ================================================================
import { app } from '../firebase-config.js'; 
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth(app);

// ================================================================
// 2. ELEMENTOS DA INTERFACE (DOM) - Captura Segura
// ================================================================

// Elementos da Página de Login
const btnLogin = document.getElementById('btnLogin');
const erroDisplay = document.getElementById('erro');
const campoEmail = document.getElementById('email');
const campoSenha = document.getElementById('senha');

// Elementos da Página de Recuperação
const btnRecuperar = document.getElementById('btnRecuperar');
const msgFeedback = document.getElementById('msgFeedback');
const campoEmailRecuperar = document.getElementById('emailRecuperar');

// ================================================================
// 3. LÓGICA DE AUTENTICAÇÃO (LOGIN)
// ================================================================
const realizarLogin = async () => {
    if (!campoEmail || !campoSenha) return;

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    if (!email || !senha) {
        exibirFeedback(erroDisplay, "Preencha todos os campos.", "#e74c3c");
        return;
    }

    erroDisplay.style.display = "none";
    btnLogin.disabled = true;
    btnLogin.innerText = "Autenticando...";

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "index.html"; 
    } catch (error) {
        btnLogin.disabled = false;
        btnLogin.innerText = "Entrar no Painel";
        
        console.error("Erro Firebase:", error.code);
        const msg = error.code === 'auth/invalid-credential' ? "E-mail ou senha incorretos." : "Erro ao conectar.";
        exibirFeedback(erroDisplay, msg, "#e74c3c");
    }
};

// ================================================================
// 4. LÓGICA DE RECUPERAÇÃO DE SENHA
// ================================================================
const solicitarRecuperacao = async () => {
    if (!campoEmailRecuperar) return;

    const email = campoEmailRecuperar.value.trim();

    if (!email) {
        exibirFeedback(msgFeedback, "Digite seu e-mail para continuar.", "#e74c3c");
        return;
    }

    btnRecuperar.disabled = true;
    btnRecuperar.innerText = "Enviando...";

    try {
        await sendPasswordResetEmail(auth, email);
        exibirFeedback(msgFeedback, "E-mail enviado! Verifique sua caixa.", "#27ae60");
        campoEmailRecuperar.value = "";
        btnRecuperar.innerText = "Enviado!";
    } catch (error) {
        btnRecuperar.disabled = false;
        btnRecuperar.innerText = "Enviar E-mail";
        
        console.error("Erro Recuperação:", error.code);
        const msg = error.code === 'auth/user-not-found' ? "E-mail não cadastrado." : "Erro ao enviar.";
        exibirFeedback(msgFeedback, msg, "#e74c3c");
    }
};

// ================================================================
// 5. FUNÇÕES AUXILIARES
// ================================================================
function exibirFeedback(elemento, texto, cor) {
    if (!elemento) return;
    elemento.innerText = texto;
    elemento.style.color = cor;
    elemento.style.display = "block";
}

// ================================================================
// 6. EVENT LISTENERS (GATILHOS)
// ================================================================

// Só ativa os eventos se os botões específicos existirem na página carregada
if (btnLogin) {
    btnLogin.addEventListener('click', realizarLogin);
    
    // Atalho Enter para login
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') realizarLogin();
    });
}

if (btnRecuperar) {
    btnRecuperar.addEventListener('click', solicitarRecuperacao);
    
    // Atalho Enter para recuperação usando encadeamento opcional
    campoEmailRecuperar?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') solicitarRecuperacao();
    });
}