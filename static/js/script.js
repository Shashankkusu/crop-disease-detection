document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const fileUpload = document.getElementById('fileUpload');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultBox = document.getElementById('resultBox');
    const resultContent = document.getElementById('resultContent');
    const diseaseName = document.getElementById('diseaseName');
    const plantTypeText = document.getElementById('plantTypeText');
    const confidenceLevel = document.getElementById('confidenceLevel');
    const confidenceText = document.getElementById('confidenceText');
    const treatmentInfo = document.getElementById('treatmentInfo');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    const plantTypeSelect = document.getElementById('plantType');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginModal = document.getElementById('loginModal');
    const closeBtn = document.querySelector('.close-btn');
    const loginForm = document.getElementById('loginForm');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // JWT Token storage
    let authToken = localStorage.getItem('authToken');

    // Event Listeners
    fileUpload.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageUpload);
    analyzeBtn.addEventListener('click', analyzeImage);
    newAnalysisBtn.addEventListener('click', resetAnalysis);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    loginBtn.addEventListener('click', () => loginModal.style.display = 'flex');
    registerBtn.addEventListener('click', () => alert('Registration feature coming soon!'));
    closeBtn.addEventListener('click', () => loginModal.style.display = 'none');
    loginForm.addEventListener('submit', handleLogin);
    getStartedBtn.addEventListener('click', () => {
        document.getElementById('detection').scrollIntoView({ behavior: 'smooth' });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Check auth state on load
    checkAuthState();

    // Initialize chat with greeting
    setTimeout(() => {
        addMessage("Hello! I'm your farming assistant. How can I help you with your crops today?", 'bot');
    }, 1000);

    // Functions
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreview.style.display = 'block';
                analyzeBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        }
    }

    async function analyzeImage() {
        const file = imageInput.files[0];
        const plantType = plantTypeSelect.value;
        
        if (!file) {
            alert('Please upload an image first');
            return;
        }

        if (!authToken) {
            alert('Please login first');
            loginModal.style.display = 'flex';
            return;
        }

        // Show loading state
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        analyzeBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('plant_type', plantType);

            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to analyze image');
            }

            const data = await response.json();
            displayResults(plantType, data.disease, data.confidence);
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error analyzing image: ' + error.message);
        } finally {
            // Reset button
            analyzeBtn.innerHTML = 'Analyze Image';
            analyzeBtn.disabled = false;
        }
    }

    function displayResults(plantType, disease, confidence) {
        // Update result content
        diseaseName.textContent = disease.replace(/_/g, ' ');
        plantTypeText.textContent = `Plant: ${plantType.charAt(0).toUpperCase() + plantType.slice(1)}`;
        confidenceText.textContent = `${Math.round(confidence * 100)}%`;
        
        // Animate confidence meter
        setTimeout(() => {
            confidenceLevel.style.width = `${confidence * 100}%`;
        }, 100);
        
        // Add treatment info (mock)
        treatmentInfo.innerHTML = `
            <h4>Recommended Treatment:</h4>
            <p>${getTreatmentAdvice(plantType, disease)}</p>
        `;
        
        // Show results
        resultBox.style.display = 'block';
        
        // Scroll to results
        setTimeout(() => {
            resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 500);
    }

    function getTreatmentAdvice(plantType, disease) {
        // Mock treatment advice - replace with actual recommendations
        const treatments = {
            "Pepper__bell___Bacterial_spot": "Apply copper-based fungicides and remove infected plants to prevent spread.",
            "Pepper__bell___healthy": "Your plant is healthy! Continue with regular care and monitoring.",
            "Potato___Late_blight": "Remove and destroy infected plants. Apply fungicides containing chlorothalonil or mancozeb.",
            "Potato___Early_blight": "Apply fungicides and practice crop rotation. Remove infected leaves.",
            "Tomato_Bacterial_spot": "Use copper-based sprays and remove infected plants. Avoid overhead watering.",
            "Tomato_healthy": "Your tomato plant looks great! Maintain proper watering and fertilization.",
            "Tomato__Target_Spot": "Apply fungicides containing chlorothalonil or mancozeb. Remove infected leaves.",
            "Tomato__Tomato_mosaic_virus": "Remove and destroy infected plants. Control aphid populations.",
            "Tomato__Tomato_YellowLeaf__Curl_Virus": "Use virus-free plants and control whitefly populations.",
            "Tomato_Early_blight": "Apply fungicides and practice crop rotation. Remove infected leaves.",
            "Tomato_Late_blight": "Remove and destroy infected plants. Apply fungicides containing chlorothalonil or mancozeb.",
            "Tomato_Leaf_Mold": "Improve air circulation and reduce humidity. Apply appropriate fungicides.",
            "Tomato_Septoria_leaf_spot": "Remove infected leaves and apply fungicides. Avoid overhead watering.",
            "Tomato_Spider_mites_Two_spotted_spider_mite": "Use miticides or insecticidal soaps. Increase humidity to deter mites."
        };
        
        return treatments[disease] || "Consult with a local agricultural expert for specific treatment recommendations.";
    }

    function resetAnalysis() {
        imageInput.value = '';
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        analyzeBtn.disabled = true;
        resultBox.style.display = 'none';
        confidenceLevel.style.width = '0%';
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        userInput.value = '';
        
        if (!authToken) {
            addMessage("Please login to use the chatbot", 'bot');
            loginModal.style.display = 'flex';
            return;
        }

        try {
            // Show typing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('bot-message');
            typingIndicator.innerHTML = '<p class="typing-indicator"><span></span><span></span><span></span></p>';
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ message })
            });

            // Remove typing indicator
            chatMessages.removeChild(typingIndicator);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get chatbot response');
            }

            const data = await response.json();
            addMessage(data.reply, 'bot');
        } catch (error) {
            console.error('Error:', error);
            addMessage(error.message || "Sorry, I'm having trouble responding. Please try again later.", 'bot');
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add(`${sender}-message`);
        messageDiv.innerHTML = `<p>${text}</p>`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function handleLogin(e) {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }

            const data = await response.json();
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);
            
            loginModal.style.display = 'none';
            loginForm.reset();
            checkAuthState();
            addMessage("Welcome back! How can I assist you with your farming questions today?", 'bot');
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || 'Login failed. Please check your credentials.');
        }
    }

    function checkAuthState() {
        if (authToken) {
            loginBtn.textContent = 'Logout';
            loginBtn.onclick = handleLogout;
            registerBtn.style.display = 'none';
        } else {
            loginBtn.textContent = 'Login';
            loginBtn.onclick = () => loginModal.style.display = 'flex';
            registerBtn.style.display = 'inline-block';
        }
    }

    function handleLogout() {
        localStorage.removeItem('authToken');
        authToken = null;
        checkAuthState();
        addMessage("You've been logged out. Please login again to continue using the chatbot.", 'bot');
    }

    // Initialize SVG Animations
    function initAnimations() {
        // Make plants grow when farmer "works" near them
        const plants = document.querySelectorAll('#plants path');
        const farmer = document.getElementById('farmer');
        
        farmer.addEventListener('animationiteration', () => {
            plants.forEach(plant => {
                plant.style.transform = 'scaleY(1.2)';
                setTimeout(() => {
                    plant.style.transform = 'scaleY(1)';
                }, 500);
            });
        });

        // Make tractor loop continuously
        const tractor = document.getElementById('tractor');
        tractor.addEventListener('animationend', () => {
            tractor.style.transform = 'translate(500px, 220px)';
            setTimeout(() => {
                tractor.style.animation = 'tractorMove 15s linear infinite';
            }, 100);
        });
    }

    // Start animations when page loads
    initAnimations();
    
    // Show loaded content
    document.body.classList.add('loaded');
});