import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

// Register user
export const registerUser = (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Validate inputs
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
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
      [email, hashedPassword, firstName || null, lastName || null, phone || null],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Error registering user' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET, {
          expiresIn: JWT_EXPIRY,
        });

        // Store session
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.run(
          `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`,
          [this.lastID, token, expiresAt],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Error creating session' });
            }

            res.status(201).json({
              message: 'User registered successfully',
              token,
              user: {
                id: this.lastID,
                email,
                firstName,
                lastName,
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
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find user by email
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare passwords
    bcryptjs.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: 'Error comparing passwords' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
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
    const decoded = jwt.verify(token, JWT_SECRET);
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
