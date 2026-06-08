// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcWfz25r-iDasyfFUgVd8w4D6Ts5D3-lQ",
  authDomain: "capassowork.firebaseapp.com",
  projectId: "capassowork",
  storageBucket: "capassowork.firebasestorage.app",
  messagingSenderId: "898969905434",
  appId: "1:898969905434:web:52d645b0f1f0038b67a4a3"
};

// App principale docente
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// App secondaria per creare utenti alunni
const secondaryApp = initializeApp(firebaseConfig, "secondary");
const secondaryAuth = getAuth(secondaryApp);

// App separata per login alunno
const studentApp = initializeApp(firebaseConfig, "student");
const studentAuth = getAuth(studentApp);

export { db, auth, secondaryAuth, studentAuth };