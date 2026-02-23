import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'safeconnect.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize database schema
export const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if users table exists and needs migration
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, table) => {
        if (table) {
          // Table exists, check if we need to migrate
          db.get("PRAGMA table_info(users)", (err, info) => {
            // Check if phone is unique - if not, we need to recreate the table
            db.all("PRAGMA index_list(users)", (err, indexes) => {
              const hasPhoneUnique = indexes?.some(idx => idx.name.includes('phone'));
              
              if (!hasPhoneUnique) {
                console.log('Migrating users table to make phone unique...');
                // Backup and recreate table
                db.run(`ALTER TABLE users RENAME TO users_old`, (err) => {
                  if (err) {
                    console.log('Users table already up to date');
                    createOtherTables();
                    return;
                  }
                  
                  createUsersTable(() => {
                    // Migrate data
                    db.run(`INSERT INTO users (id, email, password, firstName, lastName, phone, createdAt, updatedAt)
                            SELECT id, email, password, firstName, lastName, phone, createdAt, updatedAt 
                            FROM users_old WHERE phone IS NOT NULL`, (err) => {
                      if (err) console.error('Migration error:', err);
                      db.run(`DROP TABLE users_old`, () => {
                        console.log('Migration completed');
                        createOtherTables();
                      });
                    });
                  });
                });
              } else {
                createOtherTables();
              }
            });
          });
        } else {
          // Table doesn't exist, create it
          createUsersTable(createOtherTables);
        }
      });

      function createUsersTable(callback) {
        db.run(
          `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            password TEXT NOT NULL,
            firstName TEXT,
            lastName TEXT,
            phone TEXT UNIQUE NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          (err) => {
            if (err) {
              console.error('Error creating users table:', err);
              reject(err);
            } else {
              console.log('Users table created/verified');
              if (callback) callback();
            }
          }
        );
      }

      function createOtherTables() {
        let tablesCreated = 0;
        const totalTables = 2;
        let hasErrored = false;

        const onTableDone = (tableName, err) => {
          if (hasErrored) return;
          if (err) {
            hasErrored = true;
            return reject(err);
          }
          console.log(`${tableName} table created/verified`);
          tablesCreated++;
          if (tablesCreated === totalTables) resolve();
        };

        // Create sessions table
        db.run(
          `CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id)
          )`,
          (err) => onTableDone('Sessions', err)
        );

        // Create emergency_contacts table
        db.run(
          `CREATE TABLE IF NOT EXISTS emergency_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            relationship TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id)
          )`,
          (err) => onTableDone('Emergency contacts', err)
        );
      }
    });
  });
};

export default db;
