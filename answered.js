import { db, auth } from './firebase-config.js';
import { collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const authContainer = document.getElementById('authContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const userProfile = document.getElementById('userProfile');
const userNameText = document.getElementById('userNameText');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');

let currentUser = null;
let unsubscribeQuestions = null;

// Ensure DOM is fully loaded before attaching listeners
document.addEventListener('DOMContentLoaded', () => {
    // --- Toast Notification ---
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✅ ' : '❌ ';
        toast.innerHTML = `<span>${icon}${message}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow for animation
        void toast.offsetWidth;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300); // Wait for transition
        }, 3000);
    }

    // --- Authentication ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            authContainer.style.display = 'none';
            userProfile.style.display = 'flex';
            userNameText.textContent = user.displayName || user.email;
            dashboardContainer.style.display = 'block';

            // Start listening to answered questions
            setupAnsweredListener();
        } else {
            currentUser = null;
            authContainer.style.display = 'block';
            dashboardContainer.style.display = 'none';
            userProfile.style.display = 'none';
            if (unsubscribeQuestions) {
                unsubscribeQuestions();
                unsubscribeQuestions = null;
            }
        }
    });

    signInBtn?.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Sign in error:", error);
            showToast("Failed to sign in.", "error");
        }
    });

    signOutBtn?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showToast("Signed out successfully.", "success");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    });

    // --- Firebase Listener ---
    function setupAnsweredListener() {
        const q = query(collection(db, 'questions'), orderBy('timestamp', 'desc'));
        
        unsubscribeQuestions = onSnapshot(q, (snapshot) => {
            const answeredList = document.getElementById('answeredList');
            if (!answeredList) return;

            let count = 0;
            answeredList.innerHTML = '';
            
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                
                if (data.status === 'answered') {
                    count++;
                    const card = createAnsweredCard(docSnap.id, data);
                    answeredList.appendChild(card);
                }
            });

            if (count === 0) {
                answeredList.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p>No answered questions yet.</p>
                    </div>
                `;
            }
        }, (error) => {
            console.error("Error listening to questions:", error);
            showToast("Failed to load questions.", "error");
        });
    }

    // --- UI Helper ---
    function createAnsweredCard(id, data) {
        const card = document.createElement('div');
        card.className = 'question-item answered';
        
        const date = data.timestamp ? new Date(data.timestamp.toMillis()).toLocaleString() : 'Just now';
        
        const escapeHTML = (str) => {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
            );
        };
        
        const author = escapeHTML(data.author || 'Anonymous');
        const text = escapeHTML(data.text);
        const answer = escapeHTML(data.answer || '');
        const answeredBy = escapeHTML(data.answeredBy ? `by ${data.answeredBy}` : '');
        
        card.innerHTML = `
            <div class="question-header">
                <div>
                    <span class="author-name">${author}</span>
                    <span class="badge badge-answered" style="margin-left: 8px;">Answered</span>
                </div>
                <span class="question-time">${date}</span>
            </div>
            <div class="question-text">${text}</div>
            
            <div class="answer-box">
                <span class="answer-label">Admin Answer ${answeredBy}</span>
                <div class="answer-text">${answer}</div>
            </div>
        `;
        
        return card;
    }
});
