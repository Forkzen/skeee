import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, doc, setDoc, increment, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// --- Theme Toggle Logic ---
const themeToggleBtn = document.getElementById('themeToggleBtn');
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
if (themeToggleBtn) {
    themeToggleBtn.textContent = currentTheme === 'dark' ? 'Light' : 'Dark';
    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        theme = (theme === 'dark') ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggleBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
}

// --- Splash Screen Logic ---
const splashScreen = document.getElementById('dinoSplashScreen');
if (splashScreen) {
    if (!sessionStorage.getItem('splashPlayed')) {
        splashScreen.style.display = 'flex';

        setTimeout(() => {
            splashScreen.classList.add('jumping');

            setTimeout(() => {
                splashScreen.classList.add('hidden');
                sessionStorage.setItem('splashPlayed', 'true');

                setTimeout(() => {
                    splashScreen.remove();
                }, 500);
            }, 600);
        }, 1800);
    } else {
        splashScreen.remove();
    }
}

// --- Ranking Logic ---
function getRankInfo(count) {
    if (count <= 1) return { name: 'Rookie', class: 'rank-rookie', emoji: '🔰' };
    if (count <= 3) return { name: 'Bronze', class: 'rank-bronze', emoji: '🥉' };
    if (count <= 6) return { name: 'Silver', class: 'rank-silver', emoji: '🥈' };
    if (count <= 10) return { name: 'Gold', class: 'rank-gold', emoji: '🥇' };
    if (count <= 15) return { name: 'Platinum', class: 'rank-platinum', emoji: '💠' };
    if (count <= 20) return { name: 'Diamond', class: 'rank-diamond', emoji: '💎' };
    if (count <= 29) return { name: 'Master', class: 'rank-master', emoji: '🔥' };
    if (count <= 45) return { name: 'Crimson', class: 'rank-crimson', emoji: '🩸' };
    if (count <= 74) return { name: 'Iridescent', class: 'rank-iridescent', emoji: '🌈' };
    return { name: 'Top 250', class: 'rank-top250', emoji: '👑' };
}

let globalUserCounts = {};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('questionForm');
    const submitBtn = document.getElementById('submitBtn');
    const questionInput = document.getElementById('questionText');
    const authorNameInput = document.getElementById('authorName');

    // --- Flip Card Listeners ---
    const flipCard = document.getElementById('flipCard');
    document.getElementById('flipToFrontBtn')?.addEventListener('click', () => {
        flipCard?.classList.remove('is-flipped');
    });

    const flipToLeaderboardBtnTop = document.getElementById('flipToLeaderboardBtnTop');
    flipToLeaderboardBtnTop?.addEventListener('click', () => {
        // Toggle flip state
        flipCard?.classList.toggle('is-flipped');

        // Update top button text depending on state
        if (flipCard?.classList.contains('is-flipped')) {
            flipToLeaderboardBtnTop.innerHTML = '&larr; Ask Question';
        } else {
            flipToLeaderboardBtnTop.innerHTML = 'Leaderboard';
        }
    });

    // We should also update the top button text when the inside-card buttons are clicked
    const resetTopBtnTextToLeaderboard = () => {
        if (flipToLeaderboardBtnTop) flipToLeaderboardBtnTop.innerHTML = 'Leaderboard';
    };
    const resetTopBtnTextToQuestions = () => {
        if (flipToLeaderboardBtnTop) flipToLeaderboardBtnTop.innerHTML = '&larr; Ask Question';
    };

    document.getElementById('flipToLeaderboardBtn1')?.addEventListener('click', () => {
        flipCard?.classList.add('is-flipped');
        resetTopBtnTextToQuestions();
    });
    document.getElementById('flipToLeaderboardBtn2')?.addEventListener('click', () => {
        flipCard?.classList.add('is-flipped');
        resetTopBtnTextToQuestions();
    });
    document.getElementById('flipToFrontBtn')?.addEventListener('click', () => {
        flipCard?.classList.remove('is-flipped');
        resetTopBtnTextToLeaderboard();
    });

    // --- Leaderboard Listener (Aggregating from 'questions') ---
    const leaderboardList = document.getElementById('leaderboardList');
    if (leaderboardList && db) {
        const q = query(collection(db, 'questions'));
        onSnapshot(q, (snapshot) => {
            const userCounts = {};
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.uid) {
                    if (!userCounts[data.uid]) {
                        userCounts[data.uid] = {
                            count: 0,
                            displayName: data.author || 'Anonymous User'
                        };
                    }
                    userCounts[data.uid].count++;
                }
            });
            globalUserCounts = userCounts;

            // Render Leaderboard
            const sortedUsers = Object.values(userCounts).sort((a, b) => b.count - a.count).slice(0, 10);
            leaderboardList.innerHTML = '';

            if (sortedUsers.length === 0) {
                leaderboardList.innerHTML = '<div class="empty-state" style="padding: 2rem 1rem;"><p>No contributors yet. Be the first!</p></div>';
            } else {
                let pos = 1;
                sortedUsers.forEach((data) => {
                    const count = data.count;
                    const rank = getRankInfo(count);

                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    item.innerHTML = `
                        <div class="leaderboard-user">
                            <span class="leaderboard-pos">#${pos}</span>
                            <div>
                                <div class="leaderboard-name">${data.displayName}</div>
                                <span class="rank-badge ${rank.class}" style="font-size: 0.65rem; padding: 0.1rem 0.3rem; margin-top: 2px;">${rank.emoji} ${rank.name}</span>
                            </div>
                        </div>
                        <div class="leaderboard-score">${count}</div>
                    `;
                    leaderboardList.appendChild(item);
                    pos++;
                });
            }

            // Update logged in user badge if they are signed in
            if (currentUser) {
                const badge = document.getElementById('userRankBadge');
                if (badge) {
                    const count = globalUserCounts[currentUser.uid] ? globalUserCounts[currentUser.uid].count : 0;
                    const rank = getRankInfo(count);
                    badge.textContent = `${rank.emoji} ${rank.name}`;
                    badge.className = `rank-badge ${rank.class}`;
                    badge.style.display = 'inline-block';
                }
            }
        }, (error) => {
            console.error("Leaderboard error:", error);
            leaderboardList.innerHTML = '<div class="empty-state"><p>Could not load leaderboard.</p></div>';
        });
    }

    // --- Interactive Q&A Input Features ---

    // 1. Auto-resize Textarea
    if (questionInput) {
        questionInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        // 2. Typewriter Placeholder Effect
        const prompts = [
            "What's the best way to start Web Dev?",
            "Any tips for the upcoming hackathon?",
            "What's your favorite coding snack?",
            "Just dropping by to say hi! 👋",
            "How do I center a div? 😭",
            "Tabs or spaces? Let's settle this."
        ];
        let promptIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeDelay = 100;

        function typeWriter() {
            if (document.activeElement === questionInput && questionInput.value.length > 0) {
                // Pause effect if user is actively typing
                setTimeout(typeWriter, 1000);
                return;
            }

            const currentPrompt = prompts[promptIndex];

            if (isDeleting) {
                questionInput.setAttribute('placeholder', currentPrompt.substring(0, charIndex - 1));
                charIndex--;
                typeDelay = 30; // Delete faster
            } else {
                questionInput.setAttribute('placeholder', currentPrompt.substring(0, charIndex + 1));
                charIndex++;
                typeDelay = 80; // Type speed
            }

            if (!isDeleting && charIndex === currentPrompt.length) {
                typeDelay = 2500; // Pause at the end before deleting
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                promptIndex = (promptIndex + 1) % prompts.length;
                typeDelay = 500; // Pause before typing next prompt
            }

            setTimeout(typeWriter, typeDelay);
        }

        // Start typing effect slightly after load
        setTimeout(typeWriter, 1500);
    }

    // Auth UI elements
    const authContainer = document.getElementById('authContainer');
    const formContainer = document.getElementById('formContainer');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const userProfile = document.getElementById('userProfile');
    const userNameText = document.getElementById('userNameText');

    let currentUser = null;

    // Listen for Auth State Changes
    let userUnsubscribe = null;
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                authContainer.style.display = 'none';

                const interactiveArea = document.getElementById('interactiveArea');
                if (interactiveArea) interactiveArea.style.display = 'block';

                const topLeaderboardBtn = document.getElementById('flipToLeaderboardBtnTop');
                if (topLeaderboardBtn) topLeaderboardBtn.style.display = 'block';

                formContainer.style.display = 'flex';

                userProfile.style.display = 'flex';
                userNameText.textContent = user.displayName;
                authorNameInput.value = user.displayName; // Pre-fill name
                authorNameInput.disabled = true; // Lock it to their authenticated name

                // Listen to user score for badge (Now handled inside leaderboard listener)
                const badge = document.getElementById('userRankBadge');
                if (badge) {
                    const count = globalUserCounts[currentUser.uid] ? globalUserCounts[currentUser.uid].count : 0;
                    const rank = getRankInfo(count);
                    badge.textContent = `${rank.emoji} ${rank.name}`;
                    badge.className = `rank-badge ${rank.class}`;
                    badge.style.display = 'inline-block';
                }
            } else {
                currentUser = null;
                authContainer.style.display = 'block';

                const interactiveArea = document.getElementById('interactiveArea');
                if (interactiveArea) interactiveArea.style.display = 'none';

                const topLeaderboardBtn = document.getElementById('flipToLeaderboardBtnTop');
                if (topLeaderboardBtn) topLeaderboardBtn.style.display = 'none';

                formContainer.style.display = 'none';
                userProfile.style.display = 'none';
                userNameText.textContent = '';
                authorNameInput.value = '';
                authorNameInput.disabled = false;
            }
        });
    }

    // Sign In Logic
    signInBtn?.addEventListener('click', async () => {
        if (!auth) return showToast("Auth not initialized. Check config.", "error");
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // onAuthStateChanged will handle the UI update
        } catch (error) {
            console.error("Sign in error:", error);
            showToast("Failed to sign in.", "error");
        }
    });

    // Sign Out Logic
    signOutBtn?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showToast("Signed out successfully", "success");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showToast("You must be signed in to submit a question.", "error");
            return;
        }

        const questionText = questionInput.value.trim();
        if (!questionText) return;

        const authorName = currentUser.displayName || 'Anonymous User';
        const uid = currentUser.uid;

        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Submitting...';

        try {
            if (!db) throw new Error("Firebase DB not initialized.");

            await addDoc(collection(db, "questions"), {
                author: authorName,
                uid: uid,
                text: questionText,
                status: 'pending',
                timestamp: serverTimestamp()
            });

            // Trigger Rocket Animation
            const rocket = document.getElementById('rocketIcon');
            const formContainerInner = document.querySelector('#formContainer .card-content');

            if (rocket && formContainerInner) {
                // Shrink the form slightly
                formContainerInner.classList.add('form-shrinking');

                // Launch rocket
                rocket.classList.add('rocket-launching');

                // Reset after animation and SHOW MOOD GAME
                setTimeout(() => {
                    rocket.classList.remove('rocket-launching');
                    formContainerInner.classList.remove('form-shrinking');
                    questionInput.value = '';
                    questionInput.style.height = 'auto'; // Reset auto-resize height

                    // Show Mood Game
                    document.getElementById('formContainer').style.display = 'none';
                    document.getElementById('moodGameContainer').style.display = 'block';
                    document.getElementById('moodGameUI').style.display = 'flex';
                    document.getElementById('recommendationUI').style.display = 'none';

                }, 1000);
            } else {
                questionInput.value = '';
                questionInput.style.height = 'auto';
                document.getElementById('formContainer').style.display = 'none';
                document.getElementById('moodGameContainer').style.display = 'block';
                document.getElementById('moodGameUI').style.display = 'flex';
                document.getElementById('recommendationUI').style.display = 'none';
            }

        } catch (error) {
            console.error("Error adding document: ", error);
            showToast("Failed to submit question.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
});

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

// --- Mood Game Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const moodOrbs = document.querySelectorAll('.mood-orb');
    const moodGameUI = document.getElementById('moodGameUI');
    const recommendationUI = document.getElementById('recommendationUI');
    const recCard = document.getElementById('recCard');
    const playAgainBtn = document.getElementById('playAgainBtn');

    // Dataset based on user requirements
    const recommendations = {
        sad: [
            { title: "No Surprises", artist: "Radiohead", type: "Song" },
            { title: "Glimpse of Us", artist: "Joji", type: "Song" },
            { title: "Amnesia", artist: "5SOS", type: "Song" },
            { title: "Interstellar", artist: "Movie", type: "Movie" }
        ],
        chill: [
            { title: "Sweater Weather", artist: "The Neighbourhood", type: "Song" },
            { title: "Gravity", artist: "John Mayer", type: "Song" },
            { title: "RUNAWAY", artist: "Dutch Melrose", type: "Song" },
            { title: "Spirited Away", artist: "Movie", type: "Movie" }
        ],
        energetic: [
            { title: "Dynamite", artist: "BTS", type: "Song" },
            { title: "A Sky Full of Stars", artist: "Coldplay", type: "Song" },
            { title: "Youngblood", artist: "5SOS", type: "Song" },
            { title: "Spider-Man: Into the Spider-Verse", artist: "Movie", type: "Movie" }
        ],
        focused: [
            { title: "Everything In Its Right Place", artist: "Radiohead", type: "Song" },
            { title: "Slow Dancing in a Burning Room", artist: "John Mayer", type: "Song" },
            { title: "The Social Network", artist: "Movie", type: "Movie" },
            { title: "Mr. Robot", artist: "Series", type: "Series" }
        ]
    };

    moodOrbs.forEach(orb => {
        orb.addEventListener('click', () => {
            const mood = orb.getAttribute('data-mood');
            const recs = recommendations[mood];
            const randomRec = recs[Math.floor(Math.random() * recs.length)];

            let actionText = "checking out";
            if (randomRec.type === "Song") {
                actionText = "listening to";
            } else if (randomRec.type === "Movie" || randomRec.type === "Series") {
                actionText = "watching";
            }

            // Update Card UI
            recCard.innerHTML = `
                <div style="font-size: 0.95rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 0.75rem;">
                    You should try ${actionText}...
                </div>
                <span class="rec-type">${randomRec.type}</span>
                <div class="rec-title">${randomRec.title}</div>
                <div class="rec-artist">${randomRec.artist}</div>
            `;

            // Transition UI
            moodGameUI.style.display = 'none';
            recommendationUI.style.display = 'flex';
        });
    });

    // --- Interactive Rating Logic ---
    const ratingEmojis = document.querySelectorAll('.rating-emoji');
    const submitRatingBtn = document.getElementById('submitRatingBtn');
    const ratingSection = document.getElementById('ratingSection');
    const thankYouMessage = document.getElementById('thankYouMessage');

    let currentRatings = {};

    ratingEmojis.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.closest('.rating-row').getAttribute('data-category');
            const val = btn.getAttribute('data-val');

            // Remove active class from all siblings
            const siblings = btn.closest('.rating-options').querySelectorAll('.rating-emoji');
            siblings.forEach(s => s.classList.remove('active', 'pop'));

            // Add active and pop to clicked
            btn.classList.add('active', 'pop');

            currentRatings[category] = parseInt(val);

            // Check if all 4 are rated
            if (Object.keys(currentRatings).length === 4) {
                submitRatingBtn.disabled = false;
                // Small animation for button
                submitRatingBtn.style.animation = 'slideUp 0.3s ease-out forwards';
            }
        });
    });

    submitRatingBtn?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            showToast("You must be signed in to rate.", "error");
            return;
        }

        submitRatingBtn.disabled = true;
        submitRatingBtn.innerHTML = 'Submitting...';

        try {
            if (!db) throw new Error("Firebase DB not initialized.");

            await addDoc(collection(db, "questions"), {
                type: 'rating',
                author: user.displayName || 'Anonymous',
                uid: user.uid,
                ratings: currentRatings,
                timestamp: serverTimestamp()
            });

            ratingSection.style.display = 'none';
            thankYouMessage.style.display = 'block';
            showToast("Rating submitted successfully!", "success");
        } catch (error) {
            console.error("Error adding rating: ", error);
            showToast("Failed to submit rating.", "error");
            submitRatingBtn.disabled = false;
            submitRatingBtn.innerHTML = 'Submit Rating &rarr;';
        }
    });

    playAgainBtn?.addEventListener('click', () => {
        document.getElementById('moodGameContainer').style.display = 'none';
        document.getElementById('formContainer').style.display = 'block';

        // Reset Rating UI
        currentRatings = {};
        ratingEmojis.forEach(btn => btn.classList.remove('active', 'pop'));
        submitRatingBtn.disabled = true;
        submitRatingBtn.innerHTML = 'Submit Rating &rarr;';
        ratingSection.style.display = 'flex';
        thankYouMessage.style.display = 'none';
    });
});
