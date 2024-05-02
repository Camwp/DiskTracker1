const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const SQLiteStore = require('connect-sqlite3')(session);
// Setting up the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const fs = require('fs');
const dbPath = './db';
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath);
}

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: 'OnewheelIsLife',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if you're using https
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days by default
    }
}));


// Setting up EJS as the template engine
app.set('view engine', 'ejs');

// Initialize the database
const db = new sqlite3.Database('./db/database.sqlite', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

// Create tables
const initDb = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS discs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            weight INTEGER,
            plastic_type TEXT,
            stats TEXT,
            color TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
            if (err) console.error(err.message);
            else console.log('Tables created or already exist.');
        });
    });
};

initDb();

// Routes
app.get('/', (req, res) => {
    console.log(req.session.user); // Check what's actually in your session
    res.render('index', { user: req.session.user || null });
});


app.get('/register', (req, res) => {
    // Redirects to the home page which contains the modal for registration
    if (req.session.user) {
        res.redirect('/');
    } else {
        res.redirect('/');  // Redirect to home if there's an attempt to access `/register` directly
    }
});
app.get('/login', (req, res) => {
    // Redirects to the home page which contains the modal for login
    if (req.session.user) {
        res.redirect('/');
    } else {
        res.redirect('/');  // Redirect to home if there's an attempt to access `/login` directly
    }
});

app.get('/profile', checkAuthentication, (req, res) => {
    // Ensure 'user' is passed consistently
    res.render('profile', { user: req.session.user });
});

app.get('/disc-management', checkAuthentication, (req, res) => {
    res.render('disc-management', { user: req.session.user });
});

app.post('/login', (req, res) => {
    const { email, password, remember } = req.body; // Make sure the 'remember' checkbox sends this data
    const sql = `SELECT id, username, email, password FROM users WHERE email = ?`;

    db.get(sql, [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };
        if (remember) {
            req.session.cookie.maxAge = 90 * 24 * 60 * 60 * 1000; // Extend session to 90 days
        } else {
            req.session.cookie.expires = false; // Session ends when the browser closes
        }
        req.session.save(err => {
            if (err) {
                return res.status(500).json({ error: "Failed to create session" });
            }
            res.json({ message: "Login successful", redirect: '/' });
        });
    });
});



app.post('/update-profile', (req, res) => {
    const { username, email } = req.body;
    const userId = req.session.user.id;

    const sql = `UPDATE users SET username = ?, email = ? WHERE id = ?`;
    db.run(sql, [username, email, userId], function (err) {
        if (err) {
            console.error("Error updating user:", err.message);
            res.redirect('/profile?error=Unable to update profile');
        } else {
            // Update session with new user info
            req.session.user.username = username;
            req.session.user.email = email;
            res.redirect('/profile?success=Profile updated successfully');
        }
    });
});





app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);  // Ensure bcrypt is correctly required at the top

    const sql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
    db.run(sql, [username, email, hashedPassword], function (err) {
        if (err) {
            console.error("DB Error: ", err.message);
            res.render('/', { error: "Email already exists or other database error." });
        } else {
            req.session.user = { id: this.lastID, username, email };  // Set user in session
            res.redirect('/');
        }
    });
});


app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Failed to logout');
        }
        res.redirect('/');
    });
});

function getDiscs(callback) {
    db.all("SELECT * FROM discs", function (err, rows) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}



app.get('/disc-management', (req, res) => {
    getDiscs((err, discs) => {
        if (err) {
            console.error("Failed to retrieve discs:", err);
            res.status(500).send("Error retrieving discs data");
        } else {
            // Make sure to pass the discs data to the render method
            res.render('disc-management', { discs: discs });
        }
    });
});




// Middleware to check if the user is authenticated
function checkAuthentication(req, res, next) {
    if (!req.session.user) {
        res.redirect('/');
    } else {
        next();
    }
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
