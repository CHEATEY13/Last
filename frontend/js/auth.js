// Authentication JavaScript for CodeClarity

// API Base URL
const API_BASE = window.location.origin;

// Initialize authentication page
document.addEventListener('DOMContentLoaded', function() {
    initAuthPage();
});

// Initialize the authentication page
function initAuthPage() {
    // Initialize tab switching
    initTabSwitching();
    
    // Initialize form submissions
    initFormSubmissions();
    
    // Initialize password toggles
    initPasswordToggles();
    
    // Initialize guest access
    initGuestAccess();
    
    // Initialize form animations
    initFormAnimations();
    
    // Check if already authenticated
    checkExistingAuth();
}

// Check if user is already authenticated
async function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    
    if (token) {
        try {
            const response = await fetch(`${API_BASE}/api/auth/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // User is already authenticated, redirect to home
                window.location.href = '/';
                return;
            }
        } catch (error) {
            // Token is invalid, remove it
            localStorage.removeItem('authToken');
        }
    }
}

// Initialize tab switching
function initTabSwitching() {
    const signinTab = document.getElementById('signinTab');
    const signupTab = document.getElementById('signupTab');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    
    if (signinTab && signupTab && signinForm && signupForm) {
        signinTab.addEventListener('click', () => {
            switchTab('signin');
        });
        
        signupTab.addEventListener('click', () => {
            switchTab('signup');
        });
    }
}

// Switch between tabs
function switchTab(tab) {
    const signinTab = document.getElementById('signinTab');
    const signupTab = document.getElementById('signupTab');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const authMessage = document.getElementById('authMessage');
    
    // Hide any existing messages
    if (authMessage) {
        authMessage.classList.add('hidden');
    }
    
    if (tab === 'signin') {
        // Update tab styles
        signinTab.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
        signinTab.classList.remove('text-gray-600');
        signupTab.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
        signupTab.classList.add('text-gray-600');
        
        // Show/hide forms
        signinForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        
        // Animate form
        gsap.fromTo(signinForm, {
            opacity: 0,
            x: -20
        }, {
            opacity: 1,
            x: 0,
            duration: 0.3,
            ease: "power2.out"
        });
        
    } else if (tab === 'signup') {
        // Update tab styles
        signupTab.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
        signupTab.classList.remove('text-gray-600');
        signinTab.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
        signinTab.classList.add('text-gray-600');
        
        // Show/hide forms
        signupForm.classList.remove('hidden');
        signinForm.classList.add('hidden');
        
        // Animate form
        gsap.fromTo(signupForm, {
            opacity: 0,
            x: 20
        }, {
            opacity: 1,
            x: 0,
            duration: 0.3,
            ease: "power2.out"
        });
    }
}

// Initialize form submissions
function initFormSubmissions() {
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    
    if (signinForm) {
        signinForm.addEventListener('submit', handleSignIn);
    }
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignUp);
    }
}

// Handle sign in
async function handleSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('signinEmail')?.value;
    const password = document.getElementById('signinPassword')?.value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Validate inputs
    if (!email || !password) {
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }
    
    // Show loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store token
            localStorage.setItem('authToken', data.data.token);
            
            // Show success message
            showAuthMessage('Sign in successful! Redirecting...', 'success');
            
            // Redirect after delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            
        } else {
            throw new Error(data.message || 'Sign in failed');
        }
        
    } catch (error) {
        console.error('Sign in error:', error);
        showAuthMessage(error.message || 'Sign in failed. Please try again.', 'error');
        
        // Shake form on error
        gsap.to(e.target, {
            x: -10,
            duration: 0.1,
            repeat: 5,
            yoyo: true,
            ease: "power2.inOut",
            onComplete: () => {
                gsap.set(e.target, { x: 0 });
            }
        });
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Handle sign up
async function handleSignUp(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName')?.value;
    const email = document.getElementById('signupEmail')?.value;
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthMessage('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthMessage('Please enter a valid email address', 'error');
        return;
    }
    
    // Show loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store token
            localStorage.setItem('authToken', data.data.token);
            
            // Show success message
            showAuthMessage('Account created successfully! Redirecting...', 'success');
            
            // Redirect after delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            
        } else {
            throw new Error(data.message || 'Sign up failed');
        }
        
    } catch (error) {
        console.error('Sign up error:', error);
        showAuthMessage(error.message || 'Sign up failed. Please try again.', 'error');
        
        // Shake form on error
        gsap.to(e.target, {
            x: -10,
            duration: 0.1,
            repeat: 5,
            yoyo: true,
            ease: "power2.inOut",
            onComplete: () => {
                gsap.set(e.target, { x: 0 });
            }
        });
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Show authentication message
function showAuthMessage(message, type) {
    const authMessage = document.getElementById('authMessage');
    const messageIcon = authMessage?.querySelector('.message-icon');
    const messageText = authMessage?.querySelector('.message-text');
    
    if (!authMessage || !messageIcon || !messageText) return;
    
    // Set message content
    messageText.textContent = message;
    
    // Set icon and styles based on type
    authMessage.classList.remove('message-success', 'message-error', 'message-info');
    
    switch (type) {
        case 'success':
            authMessage.classList.add('message-success');
            messageIcon.className = 'message-icon ph ph-check-circle';
            break;
        case 'error':
            authMessage.classList.add('message-error');
            messageIcon.className = 'message-icon ph ph-warning-circle';
            break;
        case 'info':
        default:
            authMessage.classList.add('message-info');
            messageIcon.className = 'message-icon ph ph-info';
            break;
    }
    
    // Show message with animation
    authMessage.classList.remove('hidden');
    gsap.fromTo(authMessage, {
        opacity: 0,
        y: -10,
        scale: 0.95
    }, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "back.out(1.7)"
    });
    
    // Auto-hide after delay (except for success messages)
    if (type !== 'success') {
        setTimeout(() => {
            gsap.to(authMessage, {
                opacity: 0,
                y: -10,
                scale: 0.95,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => {
                    authMessage.classList.add('hidden');
                }
            });
        }, 5000);
    }
}

// Set button loading state
function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    const submitText = button.querySelector('.submit-text');
    const submitLoader = button.querySelector('.submit-loader');
    
    if (isLoading) {
        button.disabled = true;
        if (submitText) submitText.classList.add('hidden');
        if (submitLoader) submitLoader.classList.remove('hidden');
    } else {
        button.disabled = false;
        if (submitText) submitText.classList.remove('hidden');
        if (submitLoader) submitLoader.classList.add('hidden');
    }
}

// Initialize password toggles
function initPasswordToggles() {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            
            const input = toggle.parentElement.querySelector('input');
            const icon = toggle.querySelector('i');
            
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'ph ph-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'ph ph-eye';
                }
                
                // Animate toggle
                gsap.to(toggle, {
                    scale: 1.2,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                    ease: "power2.inOut"
                });
            }
        });
    });
}

// Initialize guest access
function initGuestAccess() {
    const guestBtn = document.getElementById('guestBtn');
    
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            // Animate button
            gsap.to(guestBtn, {
                scale: 0.95,
                duration: 0.1,
                yoyo: true,
                repeat: 1,
                ease: "power2.inOut",
                onComplete: () => {
                    // Redirect to home as guest
                    window.location.href = '/';
                }
            });
        });
    }
}

// Initialize form animations
function initFormAnimations() {
    // Animate auth container on load
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
        gsap.fromTo(authContainer, {
            opacity: 0,
            y: 30,
            scale: 0.95
        }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: "back.out(1.7)",
            delay: 0.2
        });
    }
    
    // Animate feature items
    const featureItems = document.querySelectorAll('.feature-item');
    featureItems.forEach((item, index) => {
        gsap.fromTo(item, {
            opacity: 0,
            y: 20,
            scale: 0.9
        }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            ease: "back.out(1.7)",
            delay: 0.8 + (index * 0.1)
        });
    });
    
    // Input focus animations
    const inputs = document.querySelectorAll('.auth-input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            gsap.to(input.parentElement, {
                scale: 1.02,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        
        input.addEventListener('blur', () => {
            gsap.to(input.parentElement, {
                scale: 1,
                duration: 0.3,
                ease: "power2.out"
            });
        });
    });
    
    // Form group stagger animation
    const formGroups = document.querySelectorAll('.form-group');
    gsap.fromTo(formGroups, {
        opacity: 0,
        y: 20
    }, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.5
    });
}

// Real-time password validation
document.addEventListener('input', function(e) {
    if (e.target.id === 'signupPassword' || e.target.id === 'signupConfirmPassword') {
        validatePasswordMatch();
    }
});

// Validate password match
function validatePasswordMatch() {
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
    const confirmInput = document.getElementById('signupConfirmPassword');
    
    if (confirmInput && password && confirmPassword) {
        if (password === confirmPassword) {
            confirmInput.classList.remove('border-red-300');
            confirmInput.classList.add('border-green-300');
        } else {
            confirmInput.classList.remove('border-green-300');
            confirmInput.classList.add('border-red-300');
        }
    }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Enter key to switch between forms
    if (e.key === 'Enter' && e.ctrlKey) {
        const activeTab = document.querySelector('.auth-tab.bg-white');
        if (activeTab && activeTab.id === 'signinTab') {
            switchTab('signup');
        } else {
            switchTab('signin');
        }
    }
});

// Add floating animation to background elements
function animateBackgroundElements() {
    const glowOrbs = document.querySelectorAll('.glow-orb');
    
    glowOrbs.forEach((orb, index) => {
        gsap.to(orb, {
            y: `random(-30, 30)`,
            x: `random(-20, 20)`,
            duration: `random(4, 8)`,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.5
        });
        
        gsap.to(orb, {
            opacity: `random(0.3, 0.7)`,
            duration: `random(2, 4)`,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.3
        });
    });
}

// Initialize background animations after page load
window.addEventListener('load', () => {
    animateBackgroundElements();
});
