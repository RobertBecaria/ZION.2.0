// MongoDB Initialization Script
// Creates indexes and initial admin user for ZION.CITY

db = db.getSiblingDB('zion_city');

// SECURITY: Require password from environment variable
const appPassword = process.env.MONGO_APP_PASSWORD;
if (!appPassword || appPassword === 'change_this_password') {
  print('ERROR: MONGO_APP_PASSWORD environment variable is required and must be changed from default!');
  print('Generate a secure password with: openssl rand -base64 32');
  throw new Error('MONGO_APP_PASSWORD not properly configured');
}

// Create application user
db.createUser({
  user: 'zion_app',
  pwd: appPassword,
  roles: [
    { role: 'readWrite', db: 'zion_city' }
  ]
});

// Create indexes for optimal performance
print('Creating indexes...');

// Users collection
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "id": 1 }, { unique: true });
db.users.createIndex({ "created_at": -1 });

// Posts collection
db.posts.createIndex({ "id": 1 }, { unique: true });
db.posts.createIndex({ "created_at": -1 });
db.posts.createIndex({ "user_id": 1, "created_at": -1 });
db.posts.createIndex({ "family_id": 1, "created_at": -1 });
db.posts.createIndex({ "source_module": 1, "created_at": -1 });
db.posts.createIndex({ "visibility": 1 });

// Family profiles
db.family_profiles.createIndex({ "id": 1 }, { unique: true });
db.family_profiles.createIndex({ "creator_id": 1 });

// Family members
db.family_members.createIndex({ "family_id": 1 });
db.family_members.createIndex({ "user_id": 1 });
db.family_members.createIndex({ "family_id": 1, "user_id": 1 }, { unique: true });

// Connections
db.connections.createIndex({ "from_user_id": 1, "to_user_id": 1 }, { unique: true });
db.connections.createIndex({ "to_user_id": 1, "status": 1 });
db.connections.createIndex({ "from_user_id": 1, "status": 1 });

// Organizations
db.organizations.createIndex({ "id": 1 }, { unique: true });
db.organizations.createIndex({ "organization_type": 1 });
db.organizations.createIndex({ "name": "text", "description": "text" });

// Chat groups
db.chat_groups.createIndex({ "id": 1 }, { unique: true });
db.chat_groups.createIndex({ "members": 1 });

// Messages
db.messages.createIndex({ "group_id": 1, "created_at": -1 });
db.messages.createIndex({ "sender_id": 1 });

// Notifications
db.notifications.createIndex({ "user_id": 1, "read": 1, "created_at": -1 });
db.notifications.createIndex({ "created_at": -1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// Services
db.service_listings.createIndex({ "id": 1 }, { unique: true });
db.service_listings.createIndex({ "provider_id": 1 });
db.service_listings.createIndex({ "category": 1 });
db.service_listings.createIndex({ "location": "2dsphere" });

// Marketplace
db.marketplace_products.createIndex({ "id": 1 }, { unique: true });
db.marketplace_products.createIndex({ "seller_id": 1 });
db.marketplace_products.createIndex({ "status": 1, "created_at": -1 });
db.marketplace_products.createIndex({ "title": "text", "description": "text" });

// Events
db.goodwill_events.createIndex({ "id": 1 }, { unique: true });
db.goodwill_events.createIndex({ "organizer_id": 1 });
db.goodwill_events.createIndex({ "start_date": 1 });
db.goodwill_events.createIndex({ "status": 1, "start_date": 1 });

print('Indexes created successfully!');
print('MongoDB initialization complete.');
