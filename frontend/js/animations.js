// GSAP Animations and Locomotive Scroll for CodeClarity

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Initialize Locomotive Scroll
let locoScroll;

// Preloader Animation
function initPreloader() {
    const preloader = document.querySelector('.preloader');
    const progressBar = document.querySelector('.progress-bar');
    
    if (!preloader || !progressBar) return;

    // Animate progress bar
    gsap.to(progressBar, {
        width: "100%",
        duration: 2,
        ease: "power2.out",
        onComplete: () => {
            // Hide preloader
            gsap.to(preloader, {
                opacity: 0,
                scale: 0.9,
                duration: 1,
                ease: "power2.inOut",
                onComplete: () => {
                    preloader.style.display = "none";
                    initMainAnimations();
                }
            });
        }
    });
}

// Initialize Locomotive Scroll
function initLocomotiveScroll() {
    locoScroll = new LocomotiveScroll({
        el: document.querySelector('[data-scroll-container]'),
        smooth: true,
        multiplier: 1,
        class: 'is-revealed'
    });

    // Update ScrollTrigger when Locomotive Scroll updates
    locoScroll.on('scroll', ScrollTrigger.update);

    // Setup ScrollTrigger to use Locomotive Scroll
    ScrollTrigger.scrollerProxy('[data-scroll-container]', {
        scrollTop(value) {
            return arguments.length ? locoScroll.scrollTo(value, 0, 0) : locoScroll.scroll.instance.scroll.y;
        },
        getBoundingClientRect() {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
        },
        pinType: document.querySelector('[data-scroll-container]').style.transform ? 'transform' : 'fixed'
    });

    // Refresh ScrollTrigger and Locomotive Scroll
    ScrollTrigger.addEventListener('refresh', () => locoScroll.update());
    ScrollTrigger.refresh();
}

// Main animations after preloader
function initMainAnimations() {
    // Initialize Locomotive Scroll
    initLocomotiveScroll();

    // Hero section animations
    animateHeroSection();
    
    // Floating orbs animation
    animateFloatingOrbs();
    
    // Section reveal animations
    animateSectionReveals();
    
    // Button hover animations
    initButtonAnimations();
    
    // Form animations
    initFormAnimations();
    
    // Particle animations
    animateParticles();
}

// Hero Section Animations with Letter-by-Letter Effect
function animateHeroSection() {
    console.log('🎬 Starting hero section animation...');
    
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const ctaBtn = document.querySelector('.cta-btn');
    const line1Container = document.querySelector('.hero-text-line-1');
    const line2Container = document.querySelector('.hero-text-line-2');

    console.log('🔍 Elements found:', {
        heroTitle: !!heroTitle,
        heroSubtitle: !!heroSubtitle,
        ctaBtn: !!ctaBtn,
        line1Container: !!line1Container,
        line2Container: !!line2Container
    });

    if (heroTitle && heroSubtitle && ctaBtn && line1Container && line2Container) {
        console.log('✅ All elements found, creating letter animation...');
        
        // Create letter-by-letter spans for both lines
        const line1Text = "Hi, Welcome to";
        const line2Text = "CodeClarity";
        
        console.log('📝 Setting up text:', { line1Text, line2Text });
        
        // Clear existing content and create letter spans
        line1Container.innerHTML = '';
        line2Container.innerHTML = '';
        
        // Create spans for line 1
        const line1Letters = [];
        for (let i = 0; i < line1Text.length; i++) {
            const letter = line1Text[i];
            const span = document.createElement('span');
            span.textContent = letter === ' ' ? '\u00A0' : letter; // Use non-breaking space
            span.style.opacity = '0';
            span.style.transform = 'translateY(50px)';
            span.style.display = 'inline-block';
            span.style.minWidth = letter === ' ' ? '0.3em' : 'auto'; // Ensure spaces have width
            line1Container.appendChild(span);
            line1Letters.push(span);
        }
        
        // Create spans for line 2
        const line2Letters = [];
        for (let i = 0; i < line2Text.length; i++) {
            const letter = line2Text[i];
            const span = document.createElement('span');
            span.textContent = letter;
            span.style.opacity = '0';
            span.style.transform = 'translateY(50px)';
            span.style.display = 'inline-block';
            line2Container.appendChild(span);
            line2Letters.push(span);
        }
        
        console.log('📊 Created letters:', { 
            line1Count: line1Letters.length, 
            line2Count: line2Letters.length 
        });
        
        // Animation timeline
        console.log('🎭 Creating GSAP timeline...');
        const tl = gsap.timeline({ 
            delay: 0.5,
            onStart: () => console.log('🚀 Animation started!'),
            onComplete: () => console.log('✅ Animation completed!')
        });
        
        // First show the title container
        tl.to(heroTitle, {
            opacity: 1,
            duration: 0.1,
            onComplete: () => console.log('📝 Title container visible')
        })
        // Animate line 1 letters
        .to(line1Letters, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "back.out(1.7)",
            stagger: 0.05
        })
        // Animate line 2 letters with a slight delay
        .to(line2Letters, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "back.out(1.7)",
            stagger: 0.08
        }, "-=0.2")
        // Add a glow effect to CodeClarity
        .to(line2Container, {
            textShadow: "0 0 20px rgba(144, 238, 144, 0.5), 0 0 40px rgba(135, 206, 235, 0.3)",
            duration: 0.5,
            ease: "power2.out"
        }, "-=0.3")
        // Animate subtitle
        .to(heroSubtitle, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out"
        }, "-=0.5")
        // Animate CTA button
        .to(ctaBtn, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            ease: "back.out(1.7)"
        }, "-=0.3");
    } else {
        console.error('❌ Missing elements for hero animation:', {
            heroTitle: !!heroTitle,
            heroSubtitle: !!heroSubtitle,
            ctaBtn: !!ctaBtn,
            line1Container: !!line1Container,
            line2Container: !!line2Container
        });
        
        // Fallback: show original text if elements are missing
        if (line1Container) line1Container.textContent = "Hi, Welcome to";
        if (line2Container) line2Container.textContent = "CodeClarity";
        
        // Simple fallback animation
        if (heroTitle) {
            gsap.to(heroTitle, { opacity: 1, duration: 1, delay: 0.5 });
        }
        if (heroSubtitle) {
            gsap.to(heroSubtitle, { opacity: 1, y: 0, duration: 0.8, delay: 1 });
        }
        if (ctaBtn) {
            gsap.to(ctaBtn, { opacity: 1, y: 0, scale: 1, duration: 0.6, delay: 1.3 });
        }
    }
}

// Floating Orbs Animation
function animateFloatingOrbs() {
    const orbs = document.querySelectorAll('.glow-orb');
    
    orbs.forEach((orb, index) => {
        gsap.to(orb, {
            y: -20,
            duration: 3 + index,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.5
        });
        
        gsap.to(orb, {
            x: 10,
            duration: 4 + index,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.3
        });
    });
}

// Section Reveal Animations
function animateSectionReveals() {
    // Animate elements on scroll
    gsap.utils.toArray('[data-scroll]').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            y: 50
        }, {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: element,
                scroller: '[data-scroll-container]',
                start: "top 80%",
                end: "bottom 20%",
                toggleActions: "play none none reverse"
            }
        });
    });

    // Stagger animations for grid items
    gsap.utils.toArray('.feature-item').forEach((item, index) => {
        gsap.fromTo(item, {
            opacity: 0,
            scale: 0.8,
            y: 30
        }, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.6,
            ease: "back.out(1.7)",
            delay: index * 0.1,
            scrollTrigger: {
                trigger: item,
                scroller: '[data-scroll-container]',
                start: "top 85%",
                toggleActions: "play none none reverse"
            }
        });
    });
}

// Button Animations
function initButtonAnimations() {
    const buttons = document.querySelectorAll('.cta-btn, .auth-btn, .action-btn, .export-btn');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            gsap.to(button, {
                scale: 1.05,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        
        button.addEventListener('mouseleave', () => {
            gsap.to(button, {
                scale: 1,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        
        button.addEventListener('mousedown', () => {
            gsap.to(button, {
                scale: 0.95,
                duration: 0.1,
                ease: "power2.out"
            });
        });
        
        button.addEventListener('mouseup', () => {
            gsap.to(button, {
                scale: 1.05,
                duration: 0.1,
                ease: "power2.out"
            });
        });
    });
}

// Form Animations
function initFormAnimations() {
    const formGroups = document.querySelectorAll('.form-group');
    const inputs = document.querySelectorAll('.contact-input, .auth-input');
    
    // Animate form groups on scroll
    formGroups.forEach((group, index) => {
        gsap.fromTo(group, {
            opacity: 0,
            y: 30
        }, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            delay: index * 0.1,
            scrollTrigger: {
                trigger: group,
                scroller: '[data-scroll-container]',
                start: "top 85%",
                toggleActions: "play none none reverse"
            }
        });
    });
    
    // Input focus animations
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            gsap.to(input, {
                scale: 1.02,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        
        input.addEventListener('blur', () => {
            gsap.to(input, {
                scale: 1,
                duration: 0.3,
                ease: "power2.out"
            });
        });
    });
}

// Particle Animations
function animateParticles() {
    const particles = document.querySelectorAll('.particle');
    
    particles.forEach((particle, index) => {
        // Random floating animation
        gsap.to(particle, {
            x: `random(-20, 20)`,
            y: `random(-30, 30)`,
            duration: `random(3, 6)`,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.5
        });
        
        // Opacity animation
        gsap.to(particle, {
            opacity: `random(0.2, 0.8)`,
            duration: `random(2, 4)`,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
            delay: index * 0.3
        });
    });
}

// Loading Animation
function showLoadingAnimation(container) {
    const loadingHTML = `
        <div class="loading-animation text-center py-12">
            <div class="loading-spinner mx-auto mb-4"></div>
            <p class="text-gray-600">Processing your request...</p>
        </div>
    `;
    
    if (container) {
        container.innerHTML = loadingHTML;
        
        // Animate loading spinner
        const spinner = container.querySelector('.loading-spinner');
        if (spinner) {
            gsap.to(spinner, {
                rotation: 360,
                duration: 1,
                repeat: -1,
                ease: "none"
            });
        }
    }
}

// Success Animation
function showSuccessAnimation(element, message) {
    if (!element) return;
    
    // Create success indicator
    const successDiv = document.createElement('div');
    successDiv.className = 'success-indicator fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    successDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="ph ph-check-circle text-xl"></i>
            <span>${message || 'Success!'}</span>
        </div>
    `;
    
    document.body.appendChild(successDiv);
    
    // Animate in
    gsap.fromTo(successDiv, {
        opacity: 0,
        x: 100,
        scale: 0.8
    }, {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)"
    });
    
    // Animate out after delay
    gsap.to(successDiv, {
        opacity: 0,
        x: 100,
        scale: 0.8,
        duration: 0.3,
        delay: 3,
        ease: "power2.in",
        onComplete: () => {
            successDiv.remove();
        }
    });
}

// Error Animation
function showErrorAnimation(element, message) {
    if (!element) return;
    
    // Shake animation for error
    gsap.to(element, {
        x: -10,
        duration: 0.1,
        repeat: 5,
        yoyo: true,
        ease: "power2.inOut",
        onComplete: () => {
            gsap.set(element, { x: 0 });
        }
    });
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-indicator fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="ph ph-warning-circle text-xl"></i>
            <span>${message || 'Error occurred!'}</span>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Animate in
    gsap.fromTo(errorDiv, {
        opacity: 0,
        x: 100,
        scale: 0.8
    }, {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)"
    });
    
    // Animate out after delay
    gsap.to(errorDiv, {
        opacity: 0,
        x: 100,
        scale: 0.8,
        duration: 0.3,
        delay: 4,
        ease: "power2.in",
        onComplete: () => {
            errorDiv.remove();
        }
    });
}

// Smooth scroll to element
function smoothScrollTo(target) {
    console.log(`🎯 Attempting to scroll to: ${target}`);
    
    if (locoScroll && target) {
        console.log('✅ Using Locomotive Scroll');
        locoScroll.scrollTo(target);
    } else {
        console.log('⚠️ Locomotive Scroll not available, using fallback');
        // Fallback to native smooth scroll
        const element = document.querySelector(target);
        if (element) {
            element.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            console.log('✅ Used native smooth scroll');
        } else {
            console.error(`❌ Element not found: ${target}`);
        }
    }
}

// Initialize animations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Start with preloader
    initPreloader();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (locoScroll) {
        locoScroll.update();
    }
    ScrollTrigger.refresh();
});

// Export functions for use in other files
window.CodeClarityAnimations = {
    showLoadingAnimation,
    showSuccessAnimation,
    showErrorAnimation,
    smoothScrollTo
};
