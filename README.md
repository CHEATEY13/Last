# 🔧 CodeClarity

A premium, modern, responsive web application that allows users to analyze, debug, and translate code using AI-powered insights.

## ✨ Features

- **Code Analysis**: Get step-by-step explanations of your code
- **Code Debugging**: Find and fix errors with AI suggestions
- **Code Translation**: Convert code between different programming languages
- **User Authentication**: Secure sign up/sign in with JWT
- **3D Visuals**: Interactive Spline 3D models
- **Animations**: Smooth GSAP and Locomotive Scroll animations
- **Responsive Design**: Works perfectly on all devices
- **Export Options**: Copy as Markdown, download as PDF/TXT

## 🔨 Tech Stack

### Frontend
- HTML5
- Tailwind CSS
- JavaScript (ES6+)
- GSAP (Animations)
- Locomotive Scroll
- Spline (3D Models)

### Backend
- Node.js
- Express.js
- JWT Authentication
- OpenAI API
- bcryptjs (Password Hashing)

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- OpenAI API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd codeclarity
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key and other configurations.

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
codeclarity/
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── auth.html           # Authentication page
│   ├── css/
│   │   └── styles.css      # Custom styles
│   └── js/
│       ├── main.js         # Main JavaScript
│       ├── auth.js         # Authentication logic
│       └── animations.js   # GSAP animations
├── server/
│   ├── server.js           # Express server
│   ├── routes/
│   │   ├── auth.js         # Authentication routes
│   │   └── api.js          # API routes
│   ├── middleware/
│   │   └── auth.js         # JWT middleware
│   └── models/
│       └── user.js         # User model
├── package.json
├── .env.example
└── README.md
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration time | No (default: 7d) |
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment mode | No (default: development) |

## 🎨 Design System

- **Font**: Inter
- **Colors**: Light Gray (#f0f8ff), Soft Blue (#87ceeb), Light Purple (#d8bfd8), Pastel Green (#90ee90)
- **Effects**: Glow, blur, soft shadows
- **Icons**: Phosphor Icons
- **Buttons**: Neumorphic style with glow

## 📱 Responsive Features

- Mobile-first design
- Hamburger navigation on mobile
- Responsive code editor
- Touch-friendly interactions
- Optimized 3D model scaling

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - User login

### Code Operations
- `POST /api/analyze` - Analyze code
- `POST /api/debug` - Debug code
- `POST /api/translate` - Translate code

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for the powerful AI API
- Spline for 3D model integration
- GSAP for smooth animations
- Tailwind CSS for rapid styling
