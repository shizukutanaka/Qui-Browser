/**
 * Qui Browser - Authentication Manager
 *
 * Comprehensive user authentication and authorization system
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class AuthenticationManager {
  constructor(config, databaseManager, notificationService = null) {
    this.config = config;
    this.databaseManager = databaseManager;
    this.notificationService = notificationService;

    // JWT configuration
    this.jwtSecret = config.auth?.jwtSecret || 'change-me-in-production';
    this.jwtExpiresIn = config.auth?.jwtExpiresIn || '24h';
    this.refreshTokenExpiresIn = config.auth?.refreshTokenExpiresIn || '7d';

    // Password configuration
    this.bcryptRounds = config.auth?.bcryptRounds || 12;
    this.minPasswordLength = config.auth?.minPasswordLength || 8;
    this.maxLoginAttempts = config.auth?.maxLoginAttempts || 5;
    this.lockoutDuration = config.auth?.lockoutDuration || 900000; // 15 minutes

    // Session management
    this.sessions = new Map();
    this.sessionTimeout = config.auth?.sessionTimeout || 3600000; // 1 hour

    // OAuth providers
    this.oauthProviders = new Map();

    // Rate limiting for auth attempts
    this.authAttempts = new Map();

    // Initialize bcrypt (will be loaded dynamically)
    this.bcrypt = null;

    this.initialize();
  }

  async initialize() {
    try {
      // Load bcrypt dynamically
      this.bcrypt = require('bcrypt');

      // Initialize OAuth providers
      this.initializeOAuthProviders();

      console.log('Authentication manager initialized');
    } catch (error) {
      console.error('Failed to initialize authentication manager:', error);
      throw error;
    }
  }

  /**
   * Initialize OAuth providers
   */
  initializeOAuthProviders() {
    const providers = this.config.auth?.oauthProviders || {};

    // Google OAuth
    if (providers.google) {
      this.oauthProviders.set('google', {
        clientId: providers.google.clientId,
        clientSecret: providers.google.clientSecret,
        redirectUri: providers.google.redirectUri,
        authorizationUrl: 'https://accounts.google.com/oauth/authorize',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile']
      });
    }

    // GitHub OAuth
    if (providers.github) {
      this.oauthProviders.set('github', {
        clientId: providers.github.clientId,
        clientSecret: providers.github.clientSecret,
        redirectUri: providers.github.redirectUri,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['user:email', 'read:user']
      });
    }

    // Microsoft OAuth
    if (providers.microsoft) {
      this.oauthProviders.set('microsoft', {
        clientId: providers.microsoft.clientId,
        clientSecret: providers.microsoft.clientSecret,
        redirectUri: providers.microsoft.redirectUri,
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile', 'offline_access']
      });
    }
  }

  /**
   * Register a new user
   */
  async register(userData) {
    const { email, username, password, firstName, lastName } = userData;

    // Validate input
    this.validateRegistrationData(userData);

    // Check if user already exists
    const existingUser = await this.databaseManager.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Check username availability
    if (username) {
      const existingUsername = await this.databaseManager.getUserByUsername(username);
      if (existingUsername) {
        throw new Error('Username already taken');
      }
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = {
      id: this.generateUserId(),
      email: email.toLowerCase(),
      username: username?.toLowerCase(),
      firstName,
      lastName,
      passwordHash: hashedPassword,
      role: 'user', // Default role
      isVerified: false,
      verificationToken: this.generateVerificationToken(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null,
      preferences: {
        language: 'en',
        theme: 'light',
        notifications: true
      }
    };

    // Save to database
    await this.databaseManager.createUser(user);

    // Send verification email
    if (this.notificationService) {
      await this.notificationService.sendVerificationEmail(user, user.verificationToken);
    }

    // Return user data (without password)
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Authenticate user login
   */
  async login(credentials) {
    const { email, username, password, rememberMe = false } = credentials;

    // Find user
    const identifier = email || username;
    const user = email
      ? await this.databaseManager.getUserByEmail(identifier)
      : await this.databaseManager.getUserByUsername(identifier);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      await this.handleFailedLogin(user);
      throw new Error('Invalid credentials');
    }

    // Check if account is verified
    if (!user.isVerified) {
      throw new Error('Account not verified. Please check your email for verification instructions.');
    }

    // Successful login
    await this.handleSuccessfulLogin(user);

    // Send welcome notification for first login
    if (this.notificationService && !user.lastLoginAt) {
      await this.notificationService.sendWelcomeEmail(user);
    }

    // Generate tokens and session
    const tokens = await this.generateTokens(user);
    const session = await this.createSession(user, rememberMe);

    return {
      user: this.sanitizeUser(user),
      tokens,
      session
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret + 'refresh');

      // Get user
      const user = await this.databaseManager.getUser(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId, sessionId = null) {
    if (sessionId) {
      // Remove specific session
      this.sessions.delete(sessionId);
    } else {
      // Remove all sessions for user
      for (const [id, session] of this.sessions) {
        if (session.userId === userId) {
          this.sessions.delete(id);
        }
      }
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = await this.databaseManager.getUser(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        user: this.sanitizeUser(user),
        tokenData: decoded
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token) {
    // Decode verification token
    const decoded = jwt.verify(token, this.jwtSecret + 'verify');

    // Update user
    await this.databaseManager.updateUser(decoded.userId, {
      isVerified: true,
      verificationToken: null,
      updatedAt: new Date()
    });

    return { success: true };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    const user = await this.databaseManager.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return { success: true };
    }

    const resetToken = this.generateResetToken(user);
    await this.databaseManager.updateUser(user.id, {
      resetToken,
      resetTokenExpires: new Date(Date.now() + 3600000), // 1 hour
      updatedAt: new Date()
    });

    // Send reset email
    if (this.notificationService) {
      await this.notificationService.sendPasswordResetEmail(user, resetToken);
    }

    return { success: true };
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret + 'reset');
      const user = await this.databaseManager.getUser(decoded.userId);

      if (!user || user.resetToken !== token) {
        throw new Error('Invalid reset token');
      }

      if (user.resetTokenExpires < new Date()) {
        throw new Error('Reset token has expired');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user
      await this.databaseManager.updateUser(user.id, {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date()
      });

      // Invalidate all sessions
      await this.logout(user.id);

      return { success: true };
    } catch (error) {
      throw new Error('Invalid reset token');
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.databaseManager.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidCurrentPassword = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidCurrentPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update user
    await this.databaseManager.updateUser(userId, {
      passwordHash: hashedPassword,
      updatedAt: new Date()
    });

    // Log password change
    await this.logAuthEvent(userId, 'password_changed', { ip: 'system' });

    // Send security notification
    if (this.notificationService) {
      const user = await this.databaseManager.getUser(userId);
      await this.notificationService.sendSecurityAlert(user, 'password_changed', {
        timestamp: new Date(),
        ip: 'system'
      });
    }

    return { success: true };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, profileData) {
    const allowedFields = ['firstName', 'lastName', 'username', 'preferences'];
    const updateData = {};

    // Filter allowed fields
    Object.keys(profileData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = profileData[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Check username availability if being changed
    if (updateData.username) {
      const existingUser = await this.databaseManager.getUserByUsername(updateData.username);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Username already taken');
      }
    }

    updateData.updatedAt = new Date();

    await this.databaseManager.updateUser(userId, updateData);

    // Get updated user
    const updatedUser = await this.databaseManager.getUser(userId);
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId, password) {
    const user = await this.databaseManager.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Delete user data
    await this.databaseManager.deleteUser(userId);

    // Log account deletion
    await this.logAuthEvent(userId, 'account_deleted', { ip: 'system' });

    // Invalidate all sessions
    await this.logout(userId);

    return { success: true };
  }

  /**
   * Create API key for user
   */
  async createApiKey(userId, options = {}) {
    const { name, permissions = ['read'], expiresIn = null } = options;

    const apiKey = {
      id: this.generateApiKeyId(),
      userId,
      name: name || 'Default API Key',
      key: this.generateApiKey(),
      permissions,
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null,
      lastUsedAt: null,
      isActive: true
    };

    await this.databaseManager.createApiKey(apiKey);

    // Send security notification
    if (this.notificationService) {
      const user = await this.databaseManager.getUser(userId);
      await this.notificationService.sendSecurityAlert(user, 'api_key_created', {
        keyName: options.name || 'Unnamed API Key',
        permissions: options.permissions,
        timestamp: new Date(),
        ip: 'system'
      });
    }

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key, // Only returned once for security
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt
    };
  }

  /**
   * Verify API key
   */
  async verifyApiKey(apiKey) {
    const keyData = await this.databaseManager.getApiKeyByKey(apiKey);
    if (!keyData || !keyData.isActive) {
      return null;
    }

    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    await this.databaseManager.updateApiKey(keyData.id, {
      lastUsedAt: new Date()
    });

    // Get user
    const user = await this.databaseManager.getUser(keyData.userId);
    if (!user) {
      return null;
    }

    return {
      user: this.sanitizeUser(user),
      permissions: keyData.permissions,
      keyData: {
        id: keyData.id,
        name: keyData.name,
        lastUsedAt: keyData.lastUsedAt
      }
    };
  }

  /**
   * OAuth login initiation
   */
  async initiateOAuth(provider, options = {}) {
    const oauthConfig = this.oauthProviders.get(provider);
    if (!oauthConfig) {
      throw new Error(`OAuth provider '${provider}' not configured`);
    }

    const state = this.generateOAuthState();
    const scope = oauthConfig.scopes.join(' ');

    const authUrl = new URL(oauthConfig.authorizationUrl);
    authUrl.searchParams.set('client_id', oauthConfig.clientId);
    authUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // Store state for verification
    this.storeOAuthState(state, { provider, ...options });

    return {
      authUrl: authUrl.toString(),
      state
    };
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(provider, code, state) {
    // Verify state
    const stateData = this.verifyOAuthState(state);
    if (!stateData || stateData.provider !== provider) {
      throw new Error('Invalid OAuth state');
    }

    const oauthConfig = this.oauthProviders.get(provider);
    if (!oauthConfig) {
      throw new Error(`OAuth provider '${provider}' not configured`);
    }

    // Exchange code for access token
    const tokenResponse = await this.exchangeOAuthCode(oauthConfig, code);

    // Get user info
    const userInfo = await this.getOAuthUserInfo(oauthConfig, tokenResponse.access_token);

    // Find or create user
    let user = await this.databaseManager.getUserByEmail(userInfo.email);

    if (!user) {
      // Create new user
      user = {
        id: this.generateUserId(),
        email: userInfo.email.toLowerCase(),
        username: userInfo.username || this.generateUsernameFromEmail(userInfo.email),
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        passwordHash: null, // OAuth users don't have passwords
        role: 'user',
        isVerified: true, // OAuth emails are pre-verified
        oauthProvider: provider,
        oauthId: userInfo.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          language: 'en',
          theme: 'light',
          notifications: true
        }
      };

      await this.databaseManager.createUser(user);
    } else {
      // Update OAuth info for existing user
      await this.databaseManager.updateUser(user.id, {
        oauthProvider: provider,
        oauthId: userInfo.id,
        updatedAt: new Date()
      });
    }

    // Generate tokens and session
    const tokens = await this.generateTokens(user);
    const session = await this.createSession(user, false);

    return {
      user: this.sanitizeUser(user),
      tokens,
      session
    };
  }

  /**
   * Check user permissions
   */
  async checkPermission(userId, permission, resource = null) {
    const user = await this.databaseManager.getUser(userId);
    if (!user) {
      return false;
    }

    // Check role-based permissions
    const rolePermissions = this.getRolePermissions(user.role);
    if (rolePermissions.includes(permission) || rolePermissions.includes('*')) {
      return true;
    }

    // Check resource-specific permissions
    if (resource) {
      return await this.checkResourcePermission(userId, permission, resource);
    }

    return false;
  }

  /**
   * Get role permissions
   */
  getRolePermissions(role) {
    const rolePermissions = {
      admin: ['*'], // All permissions
      moderator: [
        'read:*',
        'write:posts',
        'write:comments',
        'moderate:*',
        'delete:comments'
      ],
      user: [
        'read:*',
        'write:own_posts',
        'write:own_comments',
        'write:own_profile',
        'delete:own_content'
      ],
      guest: [
        'read:public'
      ]
    };

    return rolePermissions[role] || [];
  }

  /**
   * Check resource-specific permission
   */
  async checkResourcePermission(userId, permission, resource) {
    // This would check more granular permissions
    // For now, return true if user owns the resource
    return true; // Placeholder
  }

  // Private helper methods

  async hashPassword(password) {
    return await this.bcrypt.hash(password, this.bcryptRounds);
  }

  async verifyPassword(password, hash) {
    return await this.bcrypt.compare(password, hash);
  }

  validateRegistrationData(data) {
    const { email, username, password } = data;

    if (!email || !this.isValidEmail(email)) {
      throw new Error('Valid email is required');
    }

    if (username && !this.isValidUsername(username)) {
      throw new Error('Username must be 3-30 characters, alphanumeric and underscores only');
    }

    if (!password || password.length < this.minPasswordLength) {
      throw new Error(`Password must be at least ${this.minPasswordLength} characters long`);
    }

    if (!this.isStrongPassword(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  }

  isStrongPassword(password) {
    return /[a-z]/.test(password) &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password);
  }

  async handleFailedLogin(user) {
    const newAttempts = user.loginAttempts + 1;

    const updateData = {
      loginAttempts: newAttempts,
      updatedAt: new Date()
    };

    // Lock account if too many attempts
    if (newAttempts >= this.maxLoginAttempts) {
      updateData.lockedUntil = new Date(Date.now() + this.lockoutDuration);
    }

    await this.databaseManager.updateUser(user.id, updateData);

    // Log failed login
    await this.logAuthEvent(user.id, 'login_failed', {
      attempts: newAttempts,
      ip: 'system'
    });

    // Send security alert if account is about to be locked
    if (newAttempts >= this.maxLoginAttempts - 1 && this.notificationService) {
      await this.notificationService.sendSecurityAlert(user, 'login_attempt', {
        attempts: newAttempts,
        maxAttempts: this.maxLoginAttempts,
        ip: 'system'
      });
    }
  }

  async handleSuccessfulLogin(user) {
    await this.databaseManager.updateUser(user.id, {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    });

    // Log successful login
    await this.logAuthEvent(user.id, 'login_success', { ip: 'system' });
  }

  async generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.jwtSecret + 'refresh',
      { expiresIn: this.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTimeToSeconds(this.jwtExpiresIn)
    };
  }

  async createSession(user, rememberMe = false) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (rememberMe ? 604800000 : this.sessionTimeout)), // 7 days or 1 hour
      lastActivity: new Date(),
      userAgent: 'system',
      ip: 'system'
    };

    this.sessions.set(sessionId, session);

    return {
      id: sessionId,
      expiresAt: session.expiresAt
    };
  }

  sanitizeUser(user) {
    const { passwordHash, verificationToken, resetToken, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  generateUserId() {
    return `user_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateApiKeyId() {
    return `key_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateSessionId() {
    return `sess_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateApiKey() {
    return `qb_${crypto.randomBytes(16).toString('hex')}`;
  }

  generateVerificationToken() {
    return jwt.sign(
      { type: 'verification', timestamp: Date.now() },
      this.jwtSecret + 'verify',
      { expiresIn: '24h' }
    );
  }

  generateResetToken(user) {
    return jwt.sign(
      { userId: user.id, type: 'reset', timestamp: Date.now() },
      this.jwtSecret + 'reset',
      { expiresIn: '1h' }
    );
  }

  generateUsernameFromEmail(email) {
    const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    let username = base;
    let counter = 1;

    // Ensure uniqueness (simplified - would check database in real implementation)
    while (username.length < 3) {
      username += counter++;
    }

    return username.substring(0, 20); // Limit length
  }

  generateOAuthState() {
    return crypto.randomBytes(16).toString('hex');
  }

  storeOAuthState(state, data) {
    // In production, store in Redis/database with TTL
    this.oauthStates = this.oauthStates || new Map();
    this.oauthStates.set(state, data);

    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      this.oauthStates.delete(state);
    }, 600000);
  }

  verifyOAuthState(state) {
    this.oauthStates = this.oauthStates || new Map();
    return this.oauthStates.get(state);
  }

  async exchangeOAuthCode(oauthConfig, code) {
    const response = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: oauthConfig.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange OAuth code');
    }

    return await response.json();
  }

  async getOAuthUserInfo(oauthConfig, accessToken) {
    const response = await fetch(oauthConfig.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get OAuth user info');
    }

    const userInfo = await response.json();

    // Normalize user info across providers
    return {
      id: userInfo.id || userInfo.sub,
      email: userInfo.email,
      username: userInfo.login || userInfo.preferred_username,
      firstName: userInfo.given_name || userInfo.name?.split(' ')[0],
      lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ')
    };
  }

  async sendVerificationEmail(user) {
    // Placeholder - would integrate with email service
    console.log(`Verification email sent to ${user.email}: ${user.verificationToken}`);
  }

  async sendPasswordResetEmail(user, resetToken) {
    // Placeholder - would integrate with email service
    console.log(`Password reset email sent to ${user.email}: ${resetToken}`);
  }

  async logAuthEvent(userId, event, data) {
    // Log authentication events for audit
    console.log(`Auth event: ${event} for user ${userId}`, data);
  }

  parseTimeToSeconds(timeString) {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600; // default to 1 hour
    }
  }

  // Cleanup method
  async cleanup() {
    // Clear sessions
    this.sessions.clear();

    // Clear auth attempts
    this.authAttempts.clear();
  }
}

module.exports = AuthenticationManager;
