# 🚀 CodeClarity Setup Guide

Welcome to CodeClarity! This guide will help you set up and run the complete application.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

## 🛠️ Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your configuration:
   ```bash
   # OpenAI Configuration
   OPENAI_API_KEY=your_actual_openai_api_key_here
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:3000
   ```

### 3. Start the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

### 4. Access the Application

Open your browser and navigate to:
- **Main Application**: http://localhost:3000
- **Authentication**: http://localhost:3000/auth
- **API Health Check**: http://localhost:3000/api/health

## 🔧 Configuration Details

### OpenAI API Key Setup

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and paste it in your `.env` file

**Important**: Keep your API key secure and never commit it to version control.

### JWT Secret

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET` in the `.env` file.

## 📁 Project Structure

```
codeclarity/
├── frontend/                 # Frontend files
│   ├── index.html           # Main application page
│   ├── auth.html            # Authentication page
│   ├── css/
│   │   └── styles.css       # Custom styles
│   └── js/
│       ├── main.js          # Main application logic
│       ├── auth.js          # Authentication logic
│       └── animations.js    # GSAP animations
├── server/                  # Backend files
│   ├── server.js           # Express server
│   ├── routes/
│   │   ├── auth.js         # Authentication routes
│   │   └── api.js          # API routes
│   ├── middleware/
│   │   └── auth.js         # JWT middleware
│   └── models/
│       └── user.js         # User model
├── package.json            # Dependencies
├── .env.example           # Environment template
├── README.md              # Project documentation
└── SETUP.md              # This setup guide
```

## 🎯 Features Overview

### 🔐 Authentication System
- **Sign Up**: Create new accounts with email/password
- **Sign In**: Authenticate existing users
- **JWT Tokens**: Secure session management
- **Guest Access**: Use without authentication

### 🧠 AI-Powered Code Analysis
- **Code Analysis**: Get detailed explanations of your code
- **Bug Detection**: Find and fix errors automatically
- **Language Translation**: Convert code between programming languages
- **20+ Languages Supported**: JavaScript, Python, Java, C++, and more

### 🎨 Modern UI/UX
- **Responsive Design**: Works on all devices
- **GSAP Animations**: Smooth, professional animations
- **Locomotive Scroll**: Smooth scrolling experience
- **3D Spline Model**: Interactive background
- **Glassmorphism**: Modern design effects

### 📤 Export Options
- **Copy to Clipboard**: Markdown format
- **Download TXT**: Plain text reports
- **Download PDF**: Professional reports

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify` - Verify token

### Code Operations
- `POST /api/analyze` - Analyze code
- `POST /api/debug` - Debug code
- `POST /api/translate` - Translate code
- `GET /api/languages` - Get supported languages
- `GET /api/health` - Health check

## 🧪 Testing the Application

### 1. Test Authentication
1. Go to http://localhost:3000/auth
2. Create a new account or sign in
3. Verify you're redirected to the main page

### 2. Test Code Analysis
1. Paste some code in the input area
2. Select the programming language
3. Click "Analyze", "Debug", or "Translate"
4. Verify the AI response appears

### 3. Test Export Features
1. After getting results, try:
   - Copy to clipboard
   - Download as TXT
   - Download as PDF

## 🚨 Troubleshooting

### Common Issues

**1. "Cannot find module" errors**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**2. OpenAI API errors**
- Verify your API key is correct
- Check your OpenAI account has credits
- Ensure the key has proper permissions

**3. Port already in use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
PORT=3001 npm run dev
```

**4. CORS errors**
- Ensure `FRONTEND_URL` in `.env` matches your actual URL
- Check browser console for specific CORS messages

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

## 🔒 Security Considerations

### Production Deployment

1. **Environment Variables**:
   - Use strong, unique JWT secrets
   - Keep API keys secure
   - Set `NODE_ENV=production`

2. **HTTPS**:
   - Always use HTTPS in production
   - Update CORS settings for your domain

3. **Rate Limiting**:
   - The app includes built-in rate limiting
   - Adjust limits in `server/server.js` as needed

4. **API Key Security**:
   - Never expose API keys in frontend code
   - Use environment variables only
   - Rotate keys regularly

## 📊 Performance Tips

### Frontend Optimization
- Images are optimized and lazy-loaded
- CSS and JS are minified in production
- GSAP animations are hardware-accelerated

### Backend Optimization
- API responses are cached where appropriate
- Rate limiting prevents abuse
- Gzip compression is enabled

## 🎨 Customization

### Styling
- Edit `frontend/css/styles.css` for custom styles
- Modify Tailwind config in HTML files
- Update color scheme in CSS variables

### Animations
- Customize GSAP animations in `frontend/js/animations.js`
- Adjust timing and easing functions
- Add new animation triggers

### API Integration
- Modify OpenAI prompts in `server/routes/api.js`
- Add new analysis types
- Integrate additional AI services

## 📞 Support

If you encounter any issues:

1. Check this setup guide
2. Review the troubleshooting section
3. Check the browser console for errors
4. Verify your environment variables
5. Ensure all dependencies are installed

## 🎉 You're Ready!

Your CodeClarity application should now be running successfully. Enjoy analyzing, debugging, and translating code with AI-powered insights!

### Next Steps
- Explore all the features
- Try different programming languages
- Test the export functionality
- Customize the styling to your preference

Happy coding! 🚀
