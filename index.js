const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;
const cors = require('cors');

    

app.use(express.json());
app.use(cors());

// Open or create the database
const db = new sqlite3.Database('./database.sqlite');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      type TEXT, -- 'email' or 'phone'
      value TEXT,
      UNIQUE(type, value),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      item TEXT,
      amount REAL,
      purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS identity_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id_1 INTEGER,
      customer_id_2 INTEGER,
      UNIQUE(customer_id_1, customer_id_2)
    )
  `);
});

// Helper: Find or create customer by contact
function findOrCreateCustomer(type, value, callback) {
  db.get(
    `SELECT c.customer_id FROM contacts c WHERE c.type = ? AND c.value = ?`,
    [type, value],
    (err, row) => {
      if (err) return callback(err);
      if (row) {
        callback(null, row.customer_id);
      } else {
        // Create new customer
        db.run(`INSERT INTO customers DEFAULT VALUES`, function (err) {
          if (err) return callback(err);
          const customerId = this.lastID;
          db.run(
            `INSERT INTO contacts (customer_id, type, value) VALUES (?, ?, ?)`,
            [customerId, type, value],
            (err) => {
              if (err) return callback(err);
              callback(null, customerId);
            }
          );
        });
      }
    }
  );
}

// API to add purchase
app.post('/purchase', (req, res) => {
  const { contactType, contactValue, item, amount } = req.body;

  if (!contactType || !contactValue || !item || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  findOrCreateCustomer(contactType, contactValue, (err, customerId) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run(
      `INSERT INTO purchases (customer_id, item, amount) VALUES (?, ?, ?)`,
      [customerId, item, amount],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          message: 'Purchase recorded',
          purchaseId: this.lastID,
          customerId,
        });
      }
    );
  });
});

// API to get purchases by contact
app.get('/purchases', (req, res) => {
  const { contactType, contactValue } = req.query;

  if (!contactType || !contactValue) {
    return res.status(400).json({ error: 'Missing query params' });
  }

  db.get(
    `SELECT customer_id FROM contacts WHERE type = ? AND value = ?`,
    [contactType, contactValue],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json({ purchases: [] });

      const customerId = row.customer_id;

      db.all(
        `SELECT item, amount, purchase_date FROM purchases WHERE customer_id = ? ORDER BY purchase_date DESC`,
        [customerId],
        (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ purchases: rows });
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
app.post('/identify', (req, res) => {
    const { email, phoneNumber } = req.body;
  
    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Provide at least email or phoneNumber' });
    }
  
    // Step 1: Find all contacts that match either email or phone
    db.all(`
      SELECT * FROM contacts 
      WHERE (type = 'email' AND value = ?) OR (type = 'phone' AND value = ?)
    `, [email, phoneNumber], (err, contacts) => {
      if (err) return res.status(500).json({ error: err.message });
  
      let existingCustomerIds = [...new Set(contacts.map(c => c.customer_id))];
  
      const mergeIdentities = () => {
        // Pick the lowest customer_id as primary
        const primaryCustomerId = Math.min(...existingCustomerIds);
        const secondaryIds = existingCustomerIds.filter(id => id !== primaryCustomerId);
  
        // Link identities if not already linked
        secondaryIds.forEach(secondaryId => {
          db.run(`INSERT OR IGNORE INTO identity_links (customer_id_1, customer_id_2) VALUES (?, ?)`, [primaryCustomerId, secondaryId]);
        });
  
        // Collect all emails/phones under this unified customer group
        db.all(`
          SELECT DISTINCT value, type FROM contacts WHERE customer_id IN (
            SELECT customer_id_1 FROM identity_links WHERE customer_id_2 = ?
            UNION
            SELECT customer_id_2 FROM identity_links WHERE customer_id_1 = ?
            UNION
            SELECT ?
          )
        `, [primaryCustomerId, primaryCustomerId, primaryCustomerId], (err, allContacts) => {
          if (err) return res.status(500).json({ error: err.message });
  
          const emails = allContacts.filter(c => c.type === 'email').map(c => c.value);
          const phones = allContacts.filter(c => c.type === 'phone').map(c => c.value);
  
          res.json({
            primaryContactId: primaryCustomerId,
            emails,
            phoneNumbers: phones,
            secondaryContactIds: secondaryIds
          });
        });
      };
  
      if (existingCustomerIds.length > 0) {
        mergeIdentities();
      } else {
        // Create new customer if none found
        db.run(`INSERT INTO customers DEFAULT VALUES`, function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const newCustomerId = this.lastID;
  
          const insertContacts = [];
          if (email) insertContacts.push(['email', email]);
          if (phoneNumber) insertContacts.push(['phone', phoneNumber]);
  
          insertContacts.forEach(([type, value]) => {
            db.run(`INSERT INTO contacts (customer_id, type, value) VALUES (?, ?, ?)`,
              [newCustomerId, type, value]);
          });
  
          res.json({
            primaryContactId: newCustomerId,
            emails: email ? [email] : [],
            phoneNumbers: phoneNumber ? [phoneNumber] : [],
            secondaryContactIds: []
          });
        });
      }
    });
  });
  app.put('/contacts/:id', (req, res) => {
    const contactId = req.params.id;
    const { type, value } = req.body;
  
    if (!['email', 'phone'].includes(type) || !value) {
      return res.status(400).json({ error: 'Invalid type or value' });
    }
  
    db.run(`UPDATE contacts SET type = ?, value = ? WHERE id = ?`, [type, value, contactId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
  
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }
  
      res.json({ message: 'Contact updated' });
    });
  });
