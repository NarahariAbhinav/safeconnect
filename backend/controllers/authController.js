import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database.js';

const JWT_EXPIRY = '7d';

/** Read JWT_SECRET lazily — dotenv.config() runs in server.js after ES imports resolve */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Create a .env file with JWT_SECRET=<your-secret>');
  }
  return secret;
};

// Register user
export const registerUser = (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Validate inputs - phone and password are required
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone number and password are required' });
  }

  // Validate phone has at least 10 digits
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }

  // Hash password
  bcryptjs.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: 'Error hashing password' });
    }

    // Insert user into database
    db.run(
      `INSERT INTO users (email, password, firstName, lastName, phone) 
       VALUES (?, ?, ?, ?, ?)`,
      [email || null, hashedPassword, firstName || null, lastName || null, phone],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            if (err.message.includes('phone')) {
              return res.status(409).json({ error: 'Phone number already exists' });
            }
            return res.status(409).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Error registering user' });
        }

        // Capture user ID from the INSERT statement context
        const newUserId = this.lastID;

        // Generate JWT token
        const token = jwt.sign({ userId: newUserId, phone }, getJwtSecret(), {
          expiresIn: JWT_EXPIRY,
        });

        // Store session
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.run(
          `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`,
          [newUserId, token, expiresAt],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Error creating session' });
            }

            res.status(201).json({
              message: 'User registered successfully',
              token,
              user: {
                id: newUserId,
                email: email || null,
                firstName,
                lastName,
                phone,
              },
            });
          }
        );
      }
    );
  });
};

// Login user
export const loginUser = (req, res) => {
  const { email, password } = req.body;

  // Validate inputs
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/Phone and password are required' });
  }

  // Determine if input is email or phone
  const isPhone = /^\+?[\d\s\-()]+$/.test(email.trim());
  const query = isPhone 
    ? `SELECT * FROM users WHERE phone = ?`
    : `SELECT * FROM users WHERE email = ?`;

  // Find user by email or phone
  db.get(query, [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare passwords
    bcryptjs.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: 'Error comparing passwords' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, phone: user.phone }, getJwtSecret(), {
        expiresIn: JWT_EXPIRY,
      });

      // Store session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.run(
        `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`,
        [user.id, token, expiresAt],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error creating session' });
          }

          res.status(200).json({
            message: 'Login successful',
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
            },
          });
        }
      );
    });
  });
};

// Logout user
export const logoutUser = (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }

  db.run(`DELETE FROM sessions WHERE token = ?`, [token], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }

    res.status(200).json({ message: 'Logout successful' });
  });
};

// Get user profile
export const getUserProfile = (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    db.get(`SELECT * FROM users WHERE id = ?`, [decoded.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
