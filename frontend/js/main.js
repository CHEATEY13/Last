// Main JavaScript for CodeClarity Application

// Global variables
let currentUser = null;
let currentResults = null;

// API Base URL
const API_BASE = window.location.origin;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize the application
function initializeApp() {
    // Check authentication status
    checkAuthStatus();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize mobile menu
    initMobileMenu();
    
    // Initialize file upload
    initFileUpload();
    
    // Initialize export functionality
    initExportFunctionality();
    
    // Initialize contact form
    initContactForm();
    
    // Test navigation (for debugging)
    setTimeout(testNavigation, 1000); // Wait for page to fully load
}

// Check authentication status
async function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const authBtn = document.getElementById('authBtn');
    
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
                const data = await response.json();
                currentUser = data.data.user;
                updateAuthUI(true);
            } else {
                localStorage.removeItem('authToken');
                updateAuthUI(false);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            updateAuthUI(false);
        }
    } else {
        updateAuthUI(false);
    }
}

// Update authentication UI
function updateAuthUI(isAuthenticated) {
    const authBtn = document.getElementById('authBtn');
    
    if (isAuthenticated && currentUser) {
        authBtn.textContent = `Hi, ${currentUser.name || currentUser.email}`;
        authBtn.onclick = () => logout();
    } else {
        authBtn.textContent = 'Sign In';
        authBtn.onclick = () => window.location.href = '/auth';
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    currentUser = null;
    updateAuthUI(false);
    CodeClarityAnimations.showSuccessAnimation(null, 'Logged out successfully');
}

// Initialize event listeners
function initEventListeners() {
    // Navigation links with debugging
    const navLinks = document.querySelectorAll('a[href^="#"]');
    console.log(`🔗 Found ${navLinks.length} navigation links:`, Array.from(navLinks).map(link => link.getAttribute('href')));
    
    navLinks.forEach(link => {
        link.addEventListener('click', handleSmoothScroll);
        console.log(`✅ Added click listener to: ${link.getAttribute('href')}`);
    });
    
    // CTA button
    const ctaBtn = document.querySelector('.cta-btn');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', () => {
            CodeClarityAnimations.smoothScrollTo('#services');
        });
    }
    
    // Action buttons
    const analyzeBtn = document.getElementById('analyzeBtn');
    const translateBtn = document.getElementById('translateBtn');
    const debugBtn = document.getElementById('debugBtn');
    
    console.log('🔘 Button elements found:', {
        analyzeBtn: !!analyzeBtn,
        translateBtn: !!translateBtn,
        debugBtn: !!debugBtn
    });
    
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            console.log('🔘 Analyze button clicked!');
            handleCodeAction('analyze');
        });
    }
    if (translateBtn) {
        translateBtn.addEventListener('click', () => {
            console.log('🔘 Translate button clicked!');
            // Show target language container first
            const targetContainer = document.getElementById('targetLanguageContainer');
            if (targetContainer) {
                targetContainer.classList.remove('hidden');
            }
            // Then handle the translation action
            handleCodeAction('translate');
        });
    }
    if (debugBtn) {
        debugBtn.addEventListener('click', () => {
            console.log('🔘 Debug button clicked!');
            handleCodeAction('debug');
        });
    }
}

// Handle smooth scrolling
function handleSmoothScroll(e) {
    e.preventDefault();
    const target = e.target.getAttribute('href');
    if (target && target.startsWith('#')) {
        console.log(`🔗 Navigating to section: ${target}`);
        
        // Close mobile menu if open
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
        }
        
        // Smooth scroll to target
        CodeClarityAnimations.smoothScrollTo(target);
        
        // Update active navigation state
        updateActiveNavigation(target);
        
        // Add visual feedback
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = 'scale(1)';
        }, 150);
    }
}

// Initialize mobile menu
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Close menu when clicking on links
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }
}

// Update active navigation state
function updateActiveNavigation(targetId) {
    // Remove active class from all nav links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.classList.remove('text-soft-blue', 'font-semibold');
        link.classList.add('text-gray-700');
    });
    
    // Add active class to current nav links (both desktop and mobile)
    document.querySelectorAll(`a[href="${targetId}"]`).forEach(link => {
        link.classList.remove('text-gray-700');
        link.classList.add('text-soft-blue', 'font-semibold');
    });
    
    console.log(`📍 Active section: ${targetId}`);
}

// Test navigation function (for debugging)
function testNavigation() {
    console.log('🧪 Testing navigation...');
    
    const sections = ['#home', '#services', '#about', '#contact'];
    sections.forEach(section => {
        const element = document.querySelector(section);
        console.log(`${section}: ${element ? '✅ Found' : '❌ Not found'}`);
    });
    
    const navLinks = document.querySelectorAll('a[href^="#"]');
    console.log(`Navigation links found: ${navLinks.length}`);
    navLinks.forEach(link => {
        console.log(`- ${link.getAttribute('href')}: "${link.textContent.trim()}"`);
    });
}

// Make test function available globally for manual testing
window.testNavigation = testNavigation;

// Initialize file upload
function initFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const codeInput = document.getElementById('codeInput');
    const languageSelect = document.getElementById('languageSelect');
    
    if (fileInput && codeInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await readFileAsText(file);
                    codeInput.value = text;
                    
                    // Auto-detect language based on file extension
                    const extension = file.name.split('.').pop().toLowerCase();
                    const language = detectLanguageFromExtension(extension);
                    if (language && languageSelect) {
                        languageSelect.value = language;
                    }
                    
                    CodeClarityAnimations.showSuccessAnimation(null, 'File loaded successfully');
                } catch (error) {
                    CodeClarityAnimations.showErrorAnimation(fileInput, 'Failed to read file');
                }
            }
        });
    }
}

// Read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Detect language from file extension
function detectLanguageFromExtension(extension) {
    const languageMap = {
        'js': 'JavaScript',
        'py': 'Python',
        'java': 'Java',
        'cpp': 'C++',
        'cs': 'C#',
        'go': 'Go',
        'rs': 'Rust',
        'ts': 'TypeScript',
        'html': 'HTML',
        'css': 'CSS'
    };
    
    return languageMap[extension] || null;
}

// Handle code actions (analyze, debug, translate)
async function handleCodeAction(action) {
    console.log(`🔍 Starting ${action} action`);
    
    const codeInput = document.getElementById('codeInput');
    const languageSelect = document.getElementById('languageSelect');
    const targetLanguageSelect = document.getElementById('targetLanguageSelect');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const resultsContainer = document.getElementById('resultsContainer');
    const exportButtons = document.querySelector('.export-buttons');
    
    console.log('🔍 Elements found:', {
        codeInput: !!codeInput,
        languageSelect: !!languageSelect,
        loadingState: !!loadingState,
        emptyState: !!emptyState,
        resultsContainer: !!resultsContainer
    });
    
    // Validate inputs
    const code = codeInput?.value?.trim();
    const language = languageSelect?.value;
    
    if (!code) {
        CodeClarityAnimations.showErrorAnimation(codeInput, 'Please enter some code');
        return;
    }
    
    if (!language) {
        CodeClarityAnimations.showErrorAnimation(languageSelect, 'Please select a programming language');
        return;
    }
    
    if (action === 'translate') {
        const targetLanguage = targetLanguageSelect?.value;
        if (!targetLanguage) {
            CodeClarityAnimations.showErrorAnimation(targetLanguageSelect, 'Please select a target language');
            return;
        }
    }
    
    // Show loading state
    if (loadingState && emptyState && resultsContainer) {
        loadingState.classList.remove('hidden');
        emptyState.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        if (exportButtons) exportButtons.classList.add('hidden');
    }
    
    try {
        // Prepare request data
        const requestData = {
            code,
            language
        };
        
        if (action === 'translate') {
            requestData.targetLanguage = targetLanguageSelect.value;
        }
        
        // Make API request
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        console.log(`🌐 Making API call to: ${API_BASE}/api/${action}`);
        console.log('📤 Request data:', requestData);
        
        const response = await fetch(`${API_BASE}/api/${action}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestData)
        });
        
        console.log('📥 Response status:', response.status);
        const data = await response.json();
        console.log('📥 Response data:', data);
        
        if (data.success) {
            console.log('✅ API call successful, received data:', data.data);
            console.log('📊 Data structure check:', {
                hasLanguage: !!data.data.language,
                hasOverview: !!data.data.overview,
                hasKeyComponents: !!data.data.keyComponents,
                hasLineByLineAnalysis: !!data.data.lineByLineAnalysis,
                hasAnalysis: !!data.data.analysis,
                hasSummary: !!data.data.summary
            });
            currentResults = { action, data: data.data, originalCode: code, language };
            displayResults(action, data.data);
            if (window.CodeClarityAnimations) {
                CodeClarityAnimations.showSuccessAnimation(null, `Code ${action} completed successfully`);
            }
        } else {
            throw new Error(data.message || `Failed to ${action} code`);
        }
        
    } catch (error) {
        console.error(`${action} error:`, error);
        CodeClarityAnimations.showErrorAnimation(null, error.message || `Failed to ${action} code`);
        
        // Show empty state on error
        if (loadingState && emptyState) {
            loadingState.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }
    }
}

// Display results
function displayResults(action, data) {
    console.log(`🎨 Displaying results for ${action}:`, data);
    
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsContent = document.getElementById('resultsContent');
    const exportButtons = document.querySelector('.export-buttons');
    
    console.log('🎨 Display elements found:', {
        loadingState: !!loadingState,
        emptyState: !!emptyState,
        resultsContainer: !!resultsContainer,
        resultsContent: !!resultsContent,
        exportButtons: !!exportButtons
    });
    
    if (!resultsContent) {
        console.error('❌ resultsContent element not found!');
        return;
    }
    
    // Hide loading, show results
    if (loadingState) loadingState.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (exportButtons) exportButtons.classList.remove('hidden');
    
    // Generate HTML based on action
    let html = '';
    
    switch (action) {
        case 'analyze':
            html = generateAnalysisHTML(data);
            break;
        case 'translate':
            html = generateTranslationHTML(data);
            break;
        case 'debug':
            html = generateDebugHTML(data);
            break;
    }
    
    resultsContent.innerHTML = html;
    
    // Animate results
    gsap.fromTo(resultsContent.children, {
        opacity: 0,
        y: 30
    }, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power3.out"
    });
}

// Generate analysis HTML
function generateAnalysisHTML(data) {
    console.log('🎨 generateAnalysisHTML called with data:', data);
    console.log('🔍 Data keys:', Object.keys(data));
    
    let html = `
        <div class="results-item">
            <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <i class="ph ph-magnifying-glass text-soft-blue"></i>
                Code Analysis
            </h4>
    `;
    
    // Language detection
    if (data.language) {
        html += `
            <div class="mb-4 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                <span class="text-sm font-medium text-gray-600">Detected Language: </span>
                <span class="px-2 py-1 bg-purple-500 text-white rounded text-sm font-medium">${data.language}</span>
            </div>
        `;
    }
    
    // Overview section
    if (data.overview) {
        html += `
            <div class="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <h5 class="font-medium text-gray-800 mb-2">📋 Overview</h5>
                <p class="text-gray-700">${data.overview}</p>
            </div>
        `;
    }
    
    // Line-by-line analysis (support both old 'analysis' and new 'lineByLineAnalysis')
    const analysisData = data.lineByLineAnalysis || data.analysis;
    if (analysisData && analysisData.length > 0) {
        html += `<h5 class="font-medium text-gray-800 mb-3">📝 Detailed Line-by-Line Analysis</h5>`;
        analysisData.forEach((item, index) => {
            html += `
                <div class="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div class="code-block mb-2">${escapeHtml(item.line)}</div>
                    <p class="text-gray-700 text-sm">${item.explanation}</p>
                </div>
            `;
        });
    }
    
    // Expected output section
    if (data.output) {
        html += `
            <div class="mb-4 p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-400">
                <h5 class="font-medium text-gray-800 mb-2">🖥️ Expected Output</h5>
                <div class="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm whitespace-pre-wrap">${escapeHtml(data.output)}</div>
            </div>
        `;
    }
    
    // Summary and suggestions removed as per user request
    
    html += `</div>`;
    console.log('🎨 Generated HTML length:', html.length);
    console.log('🎨 Generated HTML preview:', html.substring(0, 200) + '...');
    return html;
}

// Helper function to get color for component types
function getComponentTypeColor(type) {
    const colorMap = {
        'function': 'bg-blue-500',
        'class': 'bg-purple-500',
        'variable': 'bg-green-500',
        'for loop': 'bg-orange-500',
        'while loop': 'bg-orange-600',
        'forEach loop': 'bg-orange-400',
        'loop': 'bg-orange-500',
        'conditional': 'bg-red-500',
        'main entry point': 'bg-indigo-600',
        'import/library': 'bg-teal-500'
    };
    return colorMap[type] || 'bg-gray-500';
}


// Generate debug HTML
function generateDebugHTML(data) {
    console.log('🐛 generateDebugHTML called with data:', data);
    console.log('🔍 Data keys:', Object.keys(data));
    
    let html = `
        <div class="results-item">
            <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <i class="ph ph-bug text-red-500"></i>
                Debug Analysis
            </h4>
    `;
    
    // Language detection
    if (data.language) {
        html += `
            <div class="mb-4 p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                <span class="text-sm font-medium text-gray-600">Detected Language: </span>
                <span class="px-2 py-1 bg-red-500 text-white rounded text-sm font-medium">${data.language}</span>
            </div>
        `;
    }
    
    // Issues found section
    if (data.issues && data.issues.length > 0) {
        html += `
            <div class="mb-4 p-4 bg-red-50 rounded-lg border-l-4 border-red-400">
                <h5 class="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <i class="ph ph-warning text-red-500"></i>
                    Issues Found (${data.issues.length})
                </h5>
                <div class="space-y-3">
        `;
        
        data.issues.forEach((issue, index) => {
            const severityColor = issue.severity === 'high' ? 'bg-red-500' : 
                                issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500';
            html += `
                <div class="p-3 bg-white rounded border-l-4 border-red-300">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="px-2 py-1 ${severityColor} text-white rounded text-xs font-medium uppercase">${issue.severity}</span>
                        <span class="text-sm font-medium text-gray-800">${issue.type}</span>
                    </div>
                    <p class="text-gray-700 mb-2">${issue.description}</p>
                    ${issue.line ? `<div class="text-xs text-gray-500">Line: ${issue.line}</div>` : ''}
                    ${issue.suggestion ? `<div class="mt-2 p-2 bg-green-50 rounded text-sm text-green-700"><strong>Suggestion:</strong> ${issue.suggestion}</div>` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    // Suggestions section
    if (data.suggestions && data.suggestions.length > 0) {
        html += `
            <div class="mb-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                <h5 class="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <i class="ph ph-lightbulb text-green-500"></i>
                    Improvement Suggestions
                </h5>
                <ul class="space-y-2">
        `;
        
        data.suggestions.forEach(suggestion => {
            html += `<li class="text-gray-700 flex items-start gap-2"><i class="ph ph-check text-green-500 mt-1"></i>${suggestion}</li>`;
        });
        
        html += `
                </ul>
            </div>
        `;
    }
    
    // Fixed code section
    if (data.fixedCode) {
        html += `
            <div class="mb-4">
                <div class="flex items-center justify-between mb-2">
                    <h5 class="font-medium text-gray-800 flex items-center gap-2">
                        <i class="ph ph-check-circle text-green-500"></i>
                        Fixed Code
                    </h5>
                    <button onclick="copyFixedCode('${escapeHtml(data.fixedCode).replace(/'/g, "\\'")}');" 
                            class="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm">
                        📋 Copy Fixed Code
                    </button>
                </div>
                <div class="code-block bg-gray-900 rounded-lg p-4">
                    <pre class="text-green-400 text-sm overflow-x-auto"><code>${escapeHtml(data.fixedCode)}</code></pre>
                </div>
            </div>
        `;
    }
    
    // Summary section
    if (data.summary) {
        html += `
            <div class="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <h5 class="font-medium text-gray-800 mb-2">📋 Summary</h5>
                <p class="text-gray-700">${data.summary}</p>
            </div>
        `;
    }
    
    html += `</div>`;
    console.log('🐛 Generated HTML length:', html.length);
    return html;
}

// Generate translation HTML
function generateTranslationHTML(data) {
    let html = `
        <div class="results-item">
            <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <i class="ph ph-translate text-pastel-green"></i>
                Translated to ${data.language}
            </h4>
    `;
    
    if (data.translatedCode) {
        // Clean up the translated code by removing demo comments and metadata
        let cleanCode = data.translatedCode;
        
        // Remove demo-specific comments and metadata
        cleanCode = cleanCode.replace(/# Demo translation.*?\n/g, '');
        cleanCode = cleanCode.replace(/# Original code:.*?\n/g, '');
        cleanCode = cleanCode.replace(/# This is a demo translation.*?\n/g, '');
        cleanCode = cleanCode.replace(/# TODO: Add your.*?\n/g, '');
        cleanCode = cleanCode.replace(/print\("Demo translation.*?"\)\s*\n/g, '');
        cleanCode = cleanCode.replace(/# Basic Python equivalent structure\s*\n/g, '');
        
        // Remove repetitive "# Translated to Python" comments
        cleanCode = cleanCode.replace(/\s*# .* # Translated to Python/g, '');
        cleanCode = cleanCode.replace(/# Translated to Python\s*\n/g, '');
        
        // Clean up excessive whitespace and empty lines
        cleanCode = cleanCode.replace(/\n\s*\n\s*\n/g, '\n\n');
        cleanCode = cleanCode.trim();
        
        html += `
            <div class="mb-4">
                <div class="flex items-center justify-between mb-2">
                    <h5 class="font-medium text-gray-800">Python Code</h5>
                    <button onclick="copyTranslatedCode('${escapeHtml(cleanCode).replace(/'/g, "\\'")}');" 
                            class="px-3 py-1 bg-pastel-green text-white rounded-lg hover:bg-green-600 transition-colors text-sm">
                        📋 Copy Code
                    </button>
                </div>
                <div class="code-block bg-gray-900 rounded-lg p-4">
                    <pre class="text-green-400 text-sm overflow-x-auto"><code>${escapeHtml(cleanCode)}</code></pre>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize export functionality
function initExportFunctionality() {
    const copyBtn = document.getElementById('copyBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);
    if (downloadTxtBtn) downloadTxtBtn.addEventListener('click', downloadAsTxt);
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', downloadAsPdf);
}

// Copy to clipboard
async function copyToClipboard() {
    if (!currentResults) return;
    
    try {
        const text = generateMarkdownOutput(currentResults);
        await navigator.clipboard.writeText(text);
        CodeClarityAnimations.showSuccessAnimation(null, 'Copied to clipboard');
    } catch (error) {
        CodeClarityAnimations.showErrorAnimation(null, 'Failed to copy to clipboard');
    }
}

// Download as TXT
function downloadAsTxt() {
    if (!currentResults) return;
    
    const text = generateMarkdownOutput(currentResults);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `codeclarity-${currentResults.action}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    CodeClarityAnimations.showSuccessAnimation(null, 'Downloaded as TXT');
}

// Download as PDF
function downloadAsPdf() {
    if (!currentResults || !window.jsPDF) return;
    
    try {
        const { jsPDF } = window.jsPDF;
        const doc = new jsPDF();
        
        const text = generateMarkdownOutput(currentResults);
        const lines = doc.splitTextToSize(text, 180);
        
        doc.setFontSize(16);
        doc.text('CodeClarity Analysis Report', 20, 20);
        
        doc.setFontSize(12);
        doc.text(lines, 20, 40);
        
        doc.save(`codeclarity-${currentResults.action}-${Date.now()}.pdf`);
        CodeClarityAnimations.showSuccessAnimation(null, 'Downloaded as PDF');
    } catch (error) {
        CodeClarityAnimations.showErrorAnimation(null, 'Failed to generate PDF');
    }
}

// Generate markdown output
function generateMarkdownOutput(results) {
    const { action, data, originalCode, language } = results;
    
    let markdown = `# CodeClarity ${action.charAt(0).toUpperCase() + action.slice(1)} Report\n\n`;
    markdown += `**Language:** ${language}\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    
    markdown += `## Original Code\n\`\`\`${language.toLowerCase()}\n${originalCode}\n\`\`\`\n\n`;
    
    switch (action) {
        case 'analyze':
            if (data.overview) markdown += `## Overview\n${data.overview}\n\n`;
            
            // Add line-by-line analysis if available
            const analysisData = data.lineByLineAnalysis || data.analysis;
            if (analysisData && analysisData.length > 0) {
                markdown += `## Line-by-Line Analysis\n\n`;
                analysisData.forEach((item, index) => {
                    markdown += `### Line ${index + 1}\n\`\`\`\n${item.line}\n\`\`\`\n${item.explanation}\n\n`;
                });
            }
            
            // Add expected output if available
            if (data.output) {
                markdown += `## Expected Output\n\`\`\`\n${data.output}\n\`\`\`\n\n`;
            }
            break;
        case 'translate':
            markdown += `## Translated Code (${data.language})\n\`\`\`${data.language.toLowerCase()}\n${data.translatedCode}\n\`\`\`\n\n`;
            if (data.dependencies) {
                markdown += `## Dependencies\n`;
                data.dependencies.forEach(dep => markdown += `- ${dep}\n`);
                markdown += '\n';
            }
            if (data.notes) markdown += `## Notes\n${data.notes}\n\n`;
            break;
        case 'debug':
            if (data.issues && data.issues.length > 0) {
                markdown += `## Issues Found\n\n`;
                data.issues.forEach((issue, index) => {
                    markdown += `### ${issue.type} (${issue.severity})\n`;
                    markdown += `${issue.description}\n`;
                    if (issue.line) markdown += `**Line:** ${issue.line}\n`;
                    if (issue.suggestion) markdown += `**Suggestion:** ${issue.suggestion}\n`;
                    markdown += '\n';
                });
            }
            if (data.suggestions && data.suggestions.length > 0) {
                markdown += `## Improvement Suggestions\n`;
                data.suggestions.forEach(suggestion => markdown += `- ${suggestion}\n`);
                markdown += '\n';
            }
            if (data.fixedCode) {
                markdown += `## Fixed Code\n\`\`\`${language.toLowerCase()}\n${data.fixedCode}\n\`\`\`\n\n`;
            }
            if (data.summary) markdown += `## Summary\n${data.summary}\n\n`;
            break;
    }
    
    return markdown;
}

// Initialize contact form
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const data = {
                name: document.getElementById('contactName')?.value,
                email: document.getElementById('contactEmail')?.value,
                message: document.getElementById('contactMessage')?.value
            };
            
            // Simulate form submission (replace with actual endpoint)
            try {
                // Show loading state
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Sending...';
                submitBtn.disabled = true;
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                CodeClarityAnimations.showSuccessAnimation(null, 'Message sent successfully!');
                contactForm.reset();
                
                // Reset button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                
            } catch (error) {
                CodeClarityAnimations.showErrorAnimation(contactForm, 'Failed to send message');
                
                // Reset button
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Send Message';
                submitBtn.disabled = false;
            }
        });
    }
}


// Copy translated code to clipboard
function copyTranslatedCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        // Show success message
        if (window.CodeClarityAnimations) {
            CodeClarityAnimations.showSuccessAnimation(null, '✅ Python code copied to clipboard!');
        } else {
            alert('Python code copied to clipboard!');
        }
    }).catch(err => {
        console.error('Failed to copy translated code:', err);
        // Fallback: create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (window.CodeClarityAnimations) {
            CodeClarityAnimations.showSuccessAnimation(null, '✅ Python code copied to clipboard!');
        } else {
            alert('Python code copied to clipboard!');
        }
    });
}

// Copy fixed code to clipboard
function copyFixedCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        // Show success message
        if (window.CodeClarityAnimations) {
            CodeClarityAnimations.showSuccessAnimation(null, '✅ Fixed code copied to clipboard!');
        } else {
            alert('Fixed code copied to clipboard!');
        }
    }).catch(err => {
        console.error('Failed to copy fixed code:', err);
        // Fallback: create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (window.CodeClarityAnimations) {
            CodeClarityAnimations.showSuccessAnimation(null, '✅ Fixed code copied to clipboard!');
        } else {
            alert('Fixed code copied to clipboard!');
        }
    });
}
