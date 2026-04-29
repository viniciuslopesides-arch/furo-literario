import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDSPnvIYjoUShy6zhZbn1hSkYgYoJwrrHg", 
    authDomain: "livraria-pro.firebaseapp.com",
    projectId: "livraria-pro",
    storageBucket: "livraria-pro.appspot.com",
    messagingSenderId: "1014913671902",
    appId: "1:1014913671902:web:2cc231433da5652886584f"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o db para o gráfico e o app para o login
export const db = getFirestore(app);
export { app };