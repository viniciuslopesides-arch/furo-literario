import { app } from '../firebase-config.js'; 
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth(app);

const btnLogin = document.getElementById('btnLogin');
const erroDisplay = document.getElementById('erro');

const realizarLogin = async () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    if (!email || !senha) {
        erroDisplay.innerText = "Preencha todos os campos.";
        erroDisplay.style.display = "block";
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
        btnLogin.innerText = "Entrar";
        erroDisplay.style.display = "block";
        
        if (error.code === 'auth/invalid-credential') {
            erroDisplay.innerText = "E-mail ou senha incorretos.";
        } else {
            erroDisplay.innerText = "Erro ao conectar com o servidor.";
        }
    }
};

btnLogin.addEventListener('click', realizarLogin);

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') realizarLogin();
});