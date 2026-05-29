import { db, auth } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// --- Theme Toggle Logic ---
const themeToggleBtn = document.getElementById('themeToggleBtn');
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
if(themeToggleBtn) {
    themeToggleBtn.textContent = currentTheme === 'dark' ? 'Light' : 'Dark';
    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        theme = (theme === 'dark') ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggleBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const authContainer = document.getElementById('authContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const unauthorizedMsg = document.getElementById('unauthorizedMsg');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const userProfile = document.getElementById('userProfile');
    const userNameText = document.getElementById('userNameText');

    let currentAdmin = null;
    let unsubscribeQuestions = null; // To store the questions listener

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewSections = document.querySelectorAll('.view-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            viewSections.forEach(v => v.style.display = 'none');
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';
        });
    });

    // Auth State Listener
    if (auth) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in, check if they are an admin
                authContainer.style.display = 'none';
                userProfile.style.display = 'flex';
                userNameText.textContent = user.displayName;

                try {
                    const adminRef = doc(db, "admins", user.uid);
                    const adminSnap = await getDoc(adminRef);

                    if (adminSnap.exists()) {
                        // User IS an admin
                        currentAdmin = user;
                        unauthorizedMsg.style.display = 'none';
                        dashboardContainer.style.display = 'block';
                        
                        // Load Dashboard Data
                        loadDashboard();
                    } else {
                        // User IS NOT an admin
                        currentAdmin = null;
                        unauthorizedMsg.style.display = 'block';
                        dashboardContainer.style.display = 'none';
                        if(unsubscribeQuestions) unsubscribeQuestions();
                    }
                } catch (error) {
                    console.error("Error checking admin status:", error);
                    showToast("Failed to verify admin status.", "error");
                }
            } else {
                // User is signed out
                currentAdmin = null;
                authContainer.style.display = 'block';
                unauthorizedMsg.style.display = 'none';
                dashboardContainer.style.display = 'none';
                userProfile.style.display = 'none';
                userNameText.textContent = '';
                
                if(unsubscribeQuestions) unsubscribeQuestions();
            }
        });
    }

    // Sign In / Out Logic
    signInBtn?.addEventListener('click', async () => {
        if (!auth) return showToast("Auth not initialized. Check config.", "error");
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
            showToast("Signed out successfully", "success");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    });

    function loadDashboard() {
        if (!db) return;
        
        const q = query(collection(db, "questions"), orderBy("timestamp", "desc"));
        
        unsubscribeQuestions = onSnapshot(q, (snapshot) => {
            const pendingList = document.getElementById('pendingList');
            const answeredList = document.getElementById('answeredList');
            
            pendingList.innerHTML = '';
            answeredList.innerHTML = '';
            
            let pendingCount = 0;
            let answeredCount = 0;

            snapshot.forEach((docSnapshot) => {
                const question = { id: docSnapshot.id, ...docSnapshot.data() };
                
                if (question.status === 'pending') {
                    pendingList.appendChild(createPendingCard(question));
                    pendingCount++;
                } else if (question.status === 'answered') {
                    answeredList.appendChild(createAnsweredCard(question));
                    answeredCount++;
                }
            });

            if (pendingCount === 0) {
                pendingList.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <p>No pending questions. All caught up!</p>
                    </div>`;
            }

            if (answeredCount === 0) {
                answeredList.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p>No answered questions yet.</p>
                    </div>`;
            }
        }, (error) => {
            console.error("Error fetching questions: ", error);
            showToast("Error loading questions.", "error");
        });
    }

    function createPendingCard(question) {
        const card = document.createElement('div');
        card.className = 'question-item';
        
        const date = question.timestamp ? new Date(question.timestamp.toMillis()).toLocaleString() : 'Just now';

        card.innerHTML = `
            <div class="question-header">
                <div>
                    <span class="author-name">${escapeHTML(question.author)}</span>
                    <span class="badge badge-pending" style="margin-left: 8px;">Pending</span>
                </div>
                <span class="question-time">${date}</span>
            </div>
            <div class="question-text">${escapeHTML(question.text)}</div>
            
            <form class="answer-form" data-id="${question.id}" style="margin-top: 1rem;">
                <div class="form-group" style="margin-bottom: 0.5rem;">
                    <textarea class="form-textarea" placeholder="Type your answer here..." required style="min-height: 80px;"></textarea>
                </div>
                <div style="text-align: right;">
                    <button type="submit" class="btn btn-secondary" style="padding: 0.5rem 1.5rem; font-size: 0.875rem;">Submit Answer</button>
                </div>
            </form>
        `;

        const form = card.querySelector('.answer-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const answerText = form.querySelector('textarea').value.trim();
            if (!answerText || !currentAdmin) return;

            const btn = form.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Submitting...';

            try {
                const questionRef = doc(db, "questions", question.id);
                await updateDoc(questionRef, {
                    status: 'answered',
                    answer: answerText,
                    answeredBy: currentAdmin.displayName || 'Admin',
                    answeredAt: new Date()
                });
                showToast('Answer submitted successfully', 'success');
            } catch (error) {
                console.error("Error updating document: ", error);
                showToast('Failed to submit answer', 'error');
                btn.disabled = false;
                btn.textContent = 'Submit Answer';
            }
        });

        return card;
    }

    function createAnsweredCard(question) {
        const card = document.createElement('div');
        card.className = 'question-item answered';
        
        const date = question.timestamp ? new Date(question.timestamp.toMillis()).toLocaleString() : '';
        const answeredBy = question.answeredBy ? `by ${question.answeredBy}` : '';

        card.innerHTML = `
            <div class="question-header">
                <div>
                    <span class="author-name">${escapeHTML(question.author)}</span>
                    <span class="badge badge-answered" style="margin-left: 8px;">Answered</span>
                </div>
                <span class="question-time">${date}</span>
            </div>
            <div class="question-text">${escapeHTML(question.text)}</div>
            
            <div class="answer-box">
                <span class="answer-label">Admin Answer ${escapeHTML(answeredBy)}</span>
                <div class="answer-text">${escapeHTML(question.answer || '')}</div>
            </div>
        `;

        return card;
    }

    function escapeHTML(str) {
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
    }

    function showToast(message, type) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        if (type === 'error') {
            toast.style.backgroundColor = 'var(--md-sys-color-error)';
        } else if (type === 'success') {
            toast.style.backgroundColor = 'var(--md-sys-color-secondary)';
        }

        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
