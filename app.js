const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 80;
const SQLiteStore = require('connect-sqlite3')(session);
const multer = require('multer');
const fs = require('fs');
const uploadPath = './public/uploads';

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath); // Use the path variable
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
// Setting up the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


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
            manufacturer TEXT,
            name TEXT,
            weight INTEGER,
            plastic_type TEXT,
            disc_type TEXT,
            stats TEXT,
            color TEXT,
            checked_out BOOLEAN DEFAULT false,
            imageUrl TEXT DEFAULT '/uploads/defaultDiscImage',
            speed INTEGER DEFAULT 0,
            glide INTEGER DEFAULT 0,
            turn INTEGER DEFAULT 0,
            fade INTEGER DEFAULT 0,
            stability TEXT,
            times_checked_out INTEGER DEFAULT 0,
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
    const { checkedOut } = req.query; // Get query parameter
    let sql = "SELECT * FROM discs WHERE user_id = ?";
    let params = [req.session.user.id];

    // If filter is applied, modify the SQL query to get only checked out discs
    if (checkedOut === 'true') {
        sql += " AND checked_out = 1"; // Assuming 'is_checked_out' is a column indicating status
    }

    db.all(sql, params, (err, discs) => {
        if (err) {
            console.error("Database error when fetching discs:", err);
            res.render('disc-management', { user: req.session.user, discs: [], error: "Failed to fetch discs due to database error." });
        } else {
            res.render('disc-management', { user: req.session.user, discs: discs });
        }
    });
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

// Route for adding a single disc (GET request expected)
app.get('/add-disc', (req, res) => {
    res.render('add-disc', { user: req.session.user });
});

// Route for adding discs in bulk (GET request expected)
app.get('/bulk-add-discs', (req, res) => {
    res.render('bulk-add-discs', { user: req.session.user });
});

// Route for viewing disc details
app.get('/disc-details/:discId', checkAuthentication, (req, res) => {
    const discId = req.params.discId;
    const sql = "SELECT * FROM discs WHERE id = ? AND user_id = ?";
    db.get(sql, [discId, req.session.user.id], (err, disc) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Database error");
        }
        if (!disc) {
            return res.status(404).send("Disc not found or not available for your account.");
        }
        res.render('disc-details', { user: req.session.user, disc: disc });
    });
});

app.post('/update-disc/:discId', (req, res) => {
    const { name, weight, plastic_type, stats, color, speed, glide, turn, fade, stability, range_type } = req.body;
    const discId = req.params.discId;

    const sql = `UPDATE discs SET name = ?, weight = ?, plastic_type = ?, stats = ?, color = ?, speed = ?, glide = ?, turn = ?, fade = ?, stability = ?, disc_type = ? WHERE id = ? AND user_id = ?`;
    db.run(sql, [name, weight, plastic_type, stats, color, speed, glide, turn, fade, stability, range_type, discId, req.session.user.id], function (err) {
        if (err) {
            console.error("Error updating disc details:", err.message);
            res.status(500).send("Failed to update disc details due to database error.");
            return;
        }
        res.redirect(`/disc-details/${discId}`);
    });
});

app.post('/update-disc-image/:discId', upload.single('discImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const newImagePath = `/uploads/${req.file.filename}`;
    const discId = req.params.discId;

    // First, retrieve the current image path
    db.get(`SELECT imageUrl FROM discs WHERE id = ?`, [discId], (err, row) => {
        if (err) {
            console.error("Error reading from database:", err.message);
            return res.status(500).json({ error: "Database error during retrieval" });
        }

        const currentImagePath = row.imageUrl;

        // Now update the database with the new image path
        db.run(`UPDATE discs SET imageUrl = ? WHERE id = ?`, [newImagePath, discId], function (err) {
            if (err) {
                console.error("Error updating database:", err.message);
                return res.status(500).json({ error: "Database error during update" });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "Disc not found" });
            }

            // If the current image is not the default, delete it
            if (currentImagePath && currentImagePath !== '/uploads/defaultDiscImage.png') {
                fs.unlink(path.join(__dirname, 'public', currentImagePath), err => {
                    if (err) {
                        console.error("Failed to delete old image:", err);
                    }
                });
            }

            res.json({ success: true, message: "Image updated successfully", imagePath: newImagePath });
        });
    });
});

app.post('/add-disc', upload.single('discImage'), (req, res) => {
    const { manufacturer, name, weight, plastic_type, color, speed, glide, turn, fade, stability, range_type } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/defaultDiscImage.png'; // Path where the image is saved

    const sql = `INSERT INTO discs (user_id, manufacturer, name, weight, plastic_type, color, speed, glide, turn, fade, imageUrl, stability, disc_type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
        req.session.user.id, manufacturer, name, weight, plastic_type, color, speed, glide, turn, fade, imageUrl, stability, range_type
    ], function (err) {
        if (err) {
            console.error("Database error:", err.message);
            res.status(500).send("Failed to add disc due to database error.");
            return;
        }
        res.redirect('/disc-management');
    });
});



app.post('/toggle-checkout/:id', (req, res) => {
    const discId = req.params.id;
    // First, retrieve the current checked_out status
    const getDisc = `SELECT checked_out FROM discs WHERE id = ?`;
    db.get(getDisc, [discId], (err, disc) => {
        if (err) {
            console.error("Database error when fetching disc:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (!disc) {
            return res.status(404).json({ error: "Disc not found" });
        }

        // Determine new checked out status and increment if needed
        const newCheckedOut = !disc.checked_out;
        const increment = disc.checked_out ? ', times_checked_out = times_checked_out + 1' : '';
        const sql = `UPDATE discs SET checked_out = ?${increment} WHERE id = ?`;

        db.run(sql, [newCheckedOut, discId], function (err) {
            if (err) {
                console.error("Database error when toggling checkout status:", err);
                return res.status(500).json({ error: "Database error" });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "No disc updated" });
            }
            res.json({ success: true });
        });
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
