/**
 * Qui Browser - GraphQL Schema Definition
 *
 * Comprehensive GraphQL schema for flexible API queries
 */

const { gql } = require('apollo-server-core');

// GraphQL Schema Definition
const typeDefs = gql`
  # Enums
  enum UserRole {
    GUEST
    USER
    MODERATOR
    ADMIN
  }

  enum SessionStatus {
    ACTIVE
    EXPIRED
    TERMINATED
  }

  enum BookmarkFolder {
    UNCATEGORIZED
    FAVORITES
    WORK
    PERSONAL
    DEVELOPMENT
    DESIGN
    MARKETING
    SALES
    SUPPORT
  }

  enum AnalyticsEventType {
    PAGE_VIEW
    SESSION_START
    SESSION_END
    API_CALL
    CONVERSION
    ERROR
    FEATURE_USED
    BOOKMARK_ADDED
    BOOKMARK_DELETED
    SEARCH_PERFORMED
    EXPORT_COMPLETED
    IMPORT_COMPLETED
  }

  enum SortDirection {
    ASC
    DESC
  }

  enum ExportFormat {
    JSON
    CSV
    XML
  }

  enum NotificationType {
    INFO
    WARNING
    ERROR
    SUCCESS
  }

  # Input Types
  input CreateUserInput {
    email: String!
    username: String
    password: String!
    firstName: String!
    lastName: String!
    preferences: UserPreferencesInput
  }

  input UpdateUserInput {
    firstName: String
    lastName: String
    username: String
    preferences: UserPreferencesInput
  }

  input UserPreferencesInput {
    language: String
    theme: String
    notifications: Boolean
    timezone: String
    dateFormat: String
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input CreateBookmarkInput {
    url: String!
    title: String!
    description: String
    tags: [String!]
    folder: BookmarkFolder
    faviconUrl: String
  }

  input UpdateBookmarkInput {
    title: String
    description: String
    tags: [String!]
    folder: BookmarkFolder
    faviconUrl: String
  }

  input CreateSessionInput {
    name: String!
    tabs: [TabInput!]
    windows: [WindowInput!]
  }

  input TabInput {
    url: String!
    title: String
    favicon: String
  }

  input WindowInput {
    tabs: [ID!]
    activeTab: ID
  }

  input CreateApiKeyInput {
    name: String!
    permissions: [String!]!
    expiresIn: Int
  }

  input ExportDataInput {
    format: ExportFormat!
    includeBookmarks: Boolean
    includeHistory: Boolean
    includeSettings: Boolean
    includeSessions: Boolean
    includeFiles: Boolean
    dateRange: DateRangeInput
    compress: Boolean
  }

  input DateRangeInput {
    start: String
    end: String
  }

  input AnalyticsQueryInput {
    startDate: String
    endDate: String
    eventType: AnalyticsEventType
    userId: ID
    limit: Int
    offset: Int
  }

  input CreateNotificationInput {
    type: NotificationType!
    title: String!
    message: String!
    actionUrl: String
    expiresAt: String
  }

  input PaginationInput {
    limit: Int
    offset: Int
  }

  input SortInput {
    field: String!
    direction: SortDirection!
  }

  # Object Types
  type User {
    id: ID!
    email: String!
    username: String
    firstName: String!
    lastName: String!
    role: UserRole!
    isVerified: Boolean!
    lastLoginAt: String
    createdAt: String!
    updatedAt: String!
    preferences: UserPreferences!
    apiKeys: [ApiKey!]!
    bookmarks(limit: Int, offset: Int): [Bookmark!]!
    history(limit: Int, offset: Int): [HistoryEntry!]!
    sessions(limit: Int, offset: Int): [Session!]!
    analytics(startDate: String, endDate: String): UserAnalytics!
    quota: UserQuota
  }

  type UserPreferences {
    language: String!
    theme: String!
    notifications: Boolean!
    timezone: String
    dateFormat: String
  }

  type UserAnalytics {
    totalEvents: Int!
    pageViews: Int!
    sessionsCount: Int!
    avgSessionDuration: Float!
    topPages: [PageStats!]!
    featureUsage: [FeatureUsage!]!
    lastActivity: String
  }

  type PageStats {
    url: String!
    title: String
    views: Int!
    avgTimeSpent: Float
    bounceRate: Float
  }

  type FeatureUsage {
    feature: String!
    usage: Int!
    lastUsed: String
  }

  type UserQuota {
    limit: Int!
    used: Int!
    remaining: Int!
    resetTime: String!
    period: String!
  }

  type ApiKey {
    id: ID!
    name: String!
    key: String!
    permissions: [String!]!
    createdAt: String!
    lastUsedAt: String
    expiresAt: String
    isActive: Boolean!
  }

  type Bookmark {
    id: ID!
    url: String!
    title: String!
    description: String
    tags: [String!]!
    folder: BookmarkFolder!
    faviconUrl: String
    createdAt: String!
    updatedAt: String!
    user: User!
    clickCount: Int!
    lastClickedAt: String
  }

  type HistoryEntry {
    id: ID!
    url: String!
    title: String!
    visitCount: Int!
    lastVisit: String!
    firstVisit: String!
    user: User!
    timeSpent: Int
    device: String
    browser: String
  }

  type Session {
    id: ID!
    name: String!
    tabs: [Tab!]!
    windows: [Window!]!
    createdAt: String!
    updatedAt: String!
    lastActivity: String!
    duration: Int!
    user: User!
    status: SessionStatus!
    device: String
    browser: String
    ip: String
  }

  type Tab {
    id: ID!
    url: String!
    title: String!
    favicon: String
    loading: Boolean!
    canGoBack: Boolean!
    canGoForward: Boolean!
    createdAt: String!
    session: Session
  }

  type Window {
    id: ID!
    tabs: [ID!]!
    activeTab: ID
    session: Session
  }

  type AnalyticsEvent {
    id: ID!
    type: AnalyticsEventType!
    userId: ID
    sessionId: ID
    timestamp: String!
    data: String
    ip: String
    userAgent: String
  }

  type AnalyticsSummary {
    totalEvents: Int!
    totalUsers: Int!
    totalSessions: Int!
    pageViews: Int!
    apiCalls: Int!
    errors: Int!
    conversions: Int!
    avgResponseTime: Float!
    topPages: [PageStats!]!
    topUsers: [UserAnalytics!]!
    eventsByType: [EventTypeStats!]!
    hourlyDistribution: [HourlyStats!]!
    dailyDistribution: [DailyStats!]!
  }

  type EventTypeStats {
    type: AnalyticsEventType!
    count: Int!
    percentage: Float!
  }

  type HourlyStats {
    hour: Int!
    events: Int!
    users: Int!
  }

  type DailyStats {
    date: String!
    events: Int!
    users: Int!
    sessions: Int!
  }

  type ExportResult {
    id: ID!
    fileName: String!
    size: Int!
    format: ExportFormat!
    compressed: Boolean!
    downloadUrl: String!
    expiresAt: String!
    recordCounts: RecordCounts!
    createdAt: String!
  }

  type RecordCounts {
    bookmarks: Int!
    history: Int!
    sessions: Int!
    settings: Int!
    files: Int!
  }

  type Notification {
    id: ID!
    type: NotificationType!
    title: String!
    message: String!
    actionUrl: String
    read: Boolean!
    createdAt: String!
    expiresAt: String
    user: User!
  }

  type HealthCheck {
    status: String!
    version: String!
    uptime: Int!
    timestamp: String!
    services: ServiceHealth!
  }

  type ServiceHealth {
    database: String!
    cache: String!
    websocket: String!
    analytics: String!
  }

  type RateLimitStatus {
    limit: Int!
    remaining: Int!
    resetTime: String!
    retryAfter: Int
  }

  # Query Types
  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int, sort: SortInput): [User!]!

    # Bookmark queries
    bookmark(id: ID!): Bookmark
    bookmarks(
      userId: ID
      folder: BookmarkFolder
      tags: [String!]
      search: String
      limit: Int
      offset: Int
      sort: SortInput
    ): [Bookmark!]!

    # History queries
    historyEntry(id: ID!): HistoryEntry
    history(
      userId: ID
      startDate: String
      endDate: String
      search: String
      limit: Int
      offset: Int
      sort: SortInput
    ): [HistoryEntry!]!

    # Session queries
    session(id: ID!): Session
    sessions(
      userId: ID
      status: SessionStatus
      limit: Int
      offset: Int
      sort: SortInput
    ): [Session!]!

    # Analytics queries
    analytics(query: AnalyticsQueryInput): [AnalyticsEvent!]!
    analyticsSummary(startDate: String, endDate: String): AnalyticsSummary!

    # Export queries
    exports(userId: ID): [ExportResult!]!
    export(id: ID!): ExportResult

    # Notification queries
    notifications(read: Boolean, limit: Int, offset: Int): [Notification!]!
    notification(id: ID!): Notification

    # System queries
    health: HealthCheck!
    rateLimit: RateLimitStatus!
  }

  # Mutation Types
  type Mutation {
    # Authentication mutations
    register(input: CreateUserInput!): AuthResult!
    login(email: String!, password: String!, rememberMe: Boolean): AuthResult!
    logout: Boolean!
    refreshToken: AuthResult!
    verifyEmail(token: String!): Boolean!
    forgotPassword(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!

    # User mutations
    updateProfile(input: UpdateUserInput!): User!
    changePassword(input: ChangePasswordInput!): Boolean!
    deleteAccount(password: String!): Boolean!

    # OAuth mutations
    initiateOAuth(provider: String!): OAuthResult!
    completeOAuth(code: String!, state: String!): AuthResult!

    # API Key mutations
    createApiKey(input: CreateApiKeyInput!): ApiKey!
    deleteApiKey(id: ID!): Boolean!

    # Bookmark mutations
    createBookmark(input: CreateBookmarkInput!): Bookmark!
    updateBookmark(id: ID!, input: UpdateBookmarkInput!): Bookmark!
    deleteBookmark(id: ID!): Boolean!
    bulkDeleteBookmarks(ids: [ID!]!): Int!

    # Session mutations
    createSession(input: CreateSessionInput!): Session!
    updateSession(id: ID!, input: CreateSessionInput!): Session!
    deleteSession(id: ID!): Boolean!
    restoreSession(id: ID!): Session!

    # Export mutations
    exportData(input: ExportDataInput!): ExportResult!
    deleteExport(id: ID!): Boolean!

    # Notification mutations
    createNotification(input: CreateNotificationInput!): Notification!
    markNotificationRead(id: ID!): Boolean!
    markAllNotificationsRead: Boolean!
    deleteNotification(id: ID!): Boolean!

    # Analytics mutations
    trackEvent(type: AnalyticsEventType!, data: String): Boolean!
  }

  type AuthResult {
    user: User!
    tokens: AuthTokens!
    session: Session!
  }

  type AuthTokens {
    accessToken: String!
    refreshToken: String!
    expiresIn: Int!
    tokenType: String!
  }

  type OAuthResult {
    authUrl: String!
    state: String!
  }

  # Subscription Types
  type Subscription {
    # Real-time updates
    userUpdated(userId: ID!): User!
    bookmarkCreated(userId: ID!): Bookmark!
    bookmarkUpdated(userId: ID!): Bookmark!
    bookmarkDeleted(userId: ID!): ID!
    sessionCreated(userId: ID!): Session!
    sessionUpdated(userId: ID!): Session!
    analyticsEvent(userId: ID!): AnalyticsEvent!
    notificationReceived(userId: ID!): Notification!

    # System events
    systemHealthChanged: HealthCheck!
    rateLimitExceeded: RateLimitStatus!
  }
`;

module.exports = typeDefs;
