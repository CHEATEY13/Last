const bcrypt = require('bcryptjs');

// In-memory user storage (replace with database in production)
let users = [];
let nextUserId = 1;

class User {
  constructor(email, password, name = '') {
    this.id = nextUserId++;
    this.email = email;
    this.password = password;
    this.name = name;
    this.createdAt = new Date();
    this.sessions = []; // Store user sessions/code history
  }

  // Hash password before saving
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password with hash
  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Create new user
  static async create(userData) {
    const { email, password, name } = userData;
    
    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await User.hashPassword(password);
    
    // Create new user
    const newUser = new User(email, hashedPassword, name);
    users.push(newUser);
    
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt
    };
  }

  // Find user by email
  static findByEmail(email) {
    return users.find(user => user.email === email);
  }

  // Find user by ID
  static findById(id) {
    return users.find(user => user.id === id);
  }

  // Authenticate user
  static async authenticate(email, password) {
    const user = User.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await User.comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  }

  // Add session/code history to user
  static addSession(userId, sessionData) {
    const user = User.findById(userId);
    if (user) {
      user.sessions.push({
        id: Date.now(),
        ...sessionData,
        timestamp: new Date()
      });
      return true;
    }
    return false;
  }

  // Get user sessions
  static getUserSessions(userId) {
    const user = User.findById(userId);
    return user ? user.sessions : [];
  }

  // Get all users (admin function)
  static getAll() {
    return users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      sessionsCount: user.sessions.length
    }));
  }
}

module.exports = User;
