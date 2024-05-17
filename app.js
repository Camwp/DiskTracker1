const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 443;
const DEVPORT = process.env.PORT || 80;

const SQLiteStore = require('connect-sqlite3')(session);
const multer = require('multer');
const fs = require('fs');
const uploadPath = './public/uploads';
const csv = require('csv-parse');
const https = require('https');
const http = require('http');








let manufacturers = [];

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


fs.createReadStream('./db/discManufacturer.csv')
    .pipe(csv.parse({ columns: true, delimiter: ',' }))
    .on('data', (data) => {
        manufacturers.push(data.Manufacturer); // Adjust 'Manufacturer' based on your CSV headers
    })
    .on('end', () => {
        // Sort manufacturers alphabetically
        manufacturers.sort();
        //console.log('Manufacturers sorted alphabetically:', manufacturers);
    });
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
        db.run(`ALTER TABLE users ADD COLUMN backup BOOLEAN DEFAULT 1`, (err) => {
            if (err) {
                console.error("Error adding backup column:", err.message);
            } else {
                console.log("Backup column added successfully.");
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            username TEXT NOT NULL,
            suggestion TEXT NOT NULL,
            completed BOOL DEFAULT false,
            FOREIGN KEY (userId) REFERENCES users (id),
            FOREIGN KEY (username) REFERENCES users (username)
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
        db.run(`CREATE TABLE IF NOT EXISTS bags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            is_primary BOOLEAN DEFAULT false,
            checked_out BOOLEAN DEFAULT false,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error(err.message);
            else console.log('Tables created or already exist.');
        });
        db.run(`CREATE TABLE IF NOT EXISTS discs_bags (
            disc_id INTEGER,
            bag_id INTEGER,
            FOREIGN KEY (disc_id) REFERENCES discs(id),
            FOREIGN KEY (bag_id) REFERENCES bags(id),
            PRIMARY KEY (disc_id, bag_id)
        )`, (err) => {
            if (err) console.error(err.message);
            else console.log('Tables created or already exist.');
        });
    });
};

initDb();

// Routes
app.get('/', (req, res) => {
    console.log('hi', req.session.user); // Check what's actually in your session

    res.render('index', { user: req.session.user || null });
});


app.get('/admin', (req, res) => {
    if (!req.session.user || !req.session.user.is_admin) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const sql = `SELECT users.id, users.username, users.email, 
                        COUNT(DISTINCT discs.id) AS disc_count, 
                        COUNT(DISTINCT bags.id) AS bag_count
                 FROM users
                 LEFT JOIN discs ON users.id = discs.user_id
                 LEFT JOIN bags ON users.id = bags.user_id
                 GROUP BY users.id`;

    db.all(sql, (err, usersWithCounts) => {
        console.log(usersWithCounts);
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }

        res.render('admin', { users: usersWithCounts, user: req.session.user });
    });
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
    const userId = req.session.user.id;
    let profileData = { user: req.session.user };

    // Query to find the most checked-out disc
    const favoriteDiscQuery = `
        SELECT *, MAX(times_checked_out) AS most_checked_out
        FROM discs
        WHERE user_id = ?
        GROUP BY id
        ORDER BY most_checked_out DESC
        LIMIT 1;
    `;

    const countDiscsQuery = `SELECT COUNT(*) AS discCount FROM discs WHERE user_id = ?`;
    const countBagsQuery = `SELECT COUNT(*) AS bagCount FROM bags WHERE user_id = ?`;

    // Using SQLite's sequential execution to handle multiple queries
    db.serialize(() => {
        db.get(favoriteDiscQuery, [userId], (err, favoriteDisc) => {
            if (err) {
                console.error("Database error when fetching favorite disc:", err);
            } else {
                profileData.favoriteDisc = favoriteDisc;
            }

            db.get(countDiscsQuery, [userId], (err, discs) => {
                if (err) {
                    console.error("Database error when counting discs:", err);
                } else {
                    profileData.discCount = discs.discCount;
                }

                db.get(countBagsQuery, [userId], (err, bags) => {
                    if (err) {
                        console.error("Database error when counting bags:", err);
                    } else {
                        profileData.bagCount = bags.bagCount;
                    }


                    // Render the profile page with all gathered data
                    res.render('profile', profileData);
                });
            });
        });
    });
});

app.get('/suggestion', checkAuthentication, (req, res) => {
    const userId = req.session.user.id;
    let profileData = { user: req.session.user };

    // Query to find the most checked-out disc
    const favoriteDiscQuery = `
        SELECT *, MAX(times_checked_out) AS most_checked_out
        FROM discs
        WHERE user_id = ?
        GROUP BY id
        ORDER BY most_checked_out DESC
        LIMIT 1;
    `;

    const countDiscsQuery = `SELECT COUNT(*) AS discCount FROM discs WHERE user_id = ?`;
    const countBagsQuery = `SELECT COUNT(*) AS bagCount FROM bags WHERE user_id = ?`;

    // Using SQLite's sequential execution to handle multiple queries
    db.serialize(() => {
        db.get(favoriteDiscQuery, [userId], (err, favoriteDisc) => {
            if (err) {
                console.error("Database error when fetching favorite disc:", err);
            } else {
                profileData.favoriteDisc = favoriteDisc;
            }

            db.get(countDiscsQuery, [userId], (err, discs) => {
                if (err) {
                    console.error("Database error when counting discs:", err);
                } else {
                    profileData.discCount = discs.discCount;
                }

                db.get(countBagsQuery, [userId], (err, bags) => {
                    if (err) {
                        console.error("Database error when counting bags:", err);
                    } else {
                        profileData.bagCount = bags.bagCount;
                    }


                    // Render the profile page with all gathered data
                    res.render('suggestion', profileData);
                });
            });
        });
    });
});

app.post('/submit-suggestion', (req, res) => {
    const { suggestion } = req.body;
    const username = req.session.user.username;
    const userId = req.session.user.id;
    console.log(username);
    const sql = `INSERT INTO suggestions (username, userId, suggestion) 
                 VALUES (?, ?, ?)`;
    db.run(sql, [
        username, userId, suggestion
    ], function (err) {
        if (err) {
            console.error("Database error:", err.message);
            res.status(500).send("Failed to add disc due to database error.");
            return;
        }
        res.redirect('/suggestion');
    });
});


app.get('/disc-management', checkAuthentication, (req, res) => {
    let { name, plastic, type, color, stability, speed, glide, turn, fade, weightMin, weightMax, checkedOut } = req.query;
    let sql = "SELECT * FROM discs WHERE user_id = ?";
    let params = [req.session.user.id];

    // Fetch bags data
    let bagsSql = "SELECT * FROM bags WHERE user_id = ?";
    let bagsParams = [req.session.user.id];

    db.all(bagsSql, bagsParams, (err, bags) => {
        if (err) {
            console.error("Database error when fetching bags:", err.message);
            return res.render('disc-management', { user: req.session.user, discs: [], bags: [], error: "Failed to fetch bags due to database error." });
        }

        if (checkedOut === 'true') {
            sql += " AND checked_out = 1";
        }
        if (name && name.trim()) {
            sql += " AND name LIKE ?";
            params.push('%' + name.trim() + '%');
        }
        if (plastic && plastic.trim()) {
            sql += " AND plastic_type LIKE ?";
            params.push('%' + plastic.trim() + '%');
        }
        if (type && type !== "") {
            sql += " AND disc_type = ?";
            params.push(type);
        }
        if (color && color !== "" && color !== "#ffffff") {
            sql += " AND color = ?";
            params.push(color);
        }
        if (stability && stability !== "") {
            sql += " AND stability = ?";
            params.push(stability);
        }
        if (speed && speed !== "") {
            sql += " AND speed = ?";
            params.push(speed);
        }
        if (glide && glide !== "") {
            sql += " AND glide = ?";
            params.push(glide);
        }
        if (turn && turn !== "") {
            sql += " AND turn = ?";
            params.push(turn);
        }
        if (fade && fade !== "") {
            sql += " AND fade = ?";
            params.push(fade);
        }
        if (weightMin && weightMin !== "") {
            sql += " AND weight >= ?";
            params.push(weightMin);
        }
        if (weightMax && weightMax !== "") {
            sql += " AND weight <= ?";
            params.push(weightMax);
        }

        db.all(sql, params, (err, discs) => {
            if (err) {
                console.error("Database error when fetching discs:", err.message);
                return res.render('disc-management', { user: req.session.user, discs: [], bags: bags, error: "Failed to fetch discs due to database error." });
            }
            res.render('disc-management', { user: req.session.user, discs: discs, bags: bags });
        });
    });
});




app.get('/api/manufacturers', (req, res) => {
    const search = req.query.search;
    const results = manufacturers.filter(m => m.toLowerCase().includes(search.toLowerCase()));
    res.json(results);
});

app.post('/login', (req, res) => {
    const { email, password, remember } = req.body;
    const lowerEmailOrUsername = email.toLowerCase(); // Convert username to lowercase
    const sql = `SELECT id, username, email, password, is_admin FROM users WHERE email = ? OR username = ?`;

    db.get(sql, [lowerEmailOrUsername, lowerEmailOrUsername], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "Invalid email/username or password" });
        }
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin === 1  // Assuming is_admin is a boolean field in the database
        };

        console.log('test', user.is_admin);
        if (remember) {
            req.session.cookie.maxAge = 90 * 24 * 60 * 60 * 1000;
        } else {
            req.session.cookie.expires = false;
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

    // Check if the new username is already in use
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error("Error checking username:", err.message);
            return res.redirect('/profile?error=Unable to update profile');
        }
        if (row && row.id !== userId) {
            // Username is already in use
            return res.redirect('/profile?error=Username is already in use');
        }

        // Check if the new email is already in use
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) {
                console.error("Error checking email:", err.message);
                return res.redirect('/profile?error=Unable to update profile');
            }
            if (row && row.id !== userId) {
                // Email is already in use
                return res.redirect('/profile?error=Email is already in use');
            }

            // Update the user's profile
            const sql = 'UPDATE users SET username = ?, email = ? WHERE id = ?';
            db.run(sql, [username, email, userId], function (err) {
                if (err) {
                    console.error("Error updating user:", err.message);
                    return res.redirect('/profile?error=Unable to update profile');
                }

                // Update session with new user info
                req.session.user.username = username;
                req.session.user.email = email;
                res.redirect('/profile?success=Profile updated successfully');
            });
        });
    });
});


app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const lowerUsername = username.toLowerCase(); // Convert username to lowercase
    const lowerEmail = email.toLowerCase(); // Convert email to lowercase
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Check if email or username already exists
    const checkSql = `SELECT COUNT(*) as count FROM users WHERE email = ? OR username = ?`;
    db.get(checkSql, [lowerEmail, lowerUsername], (err, result) => {
        if (err) {
            console.error("DB Error: ", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (result.count > 0) {
            return res.status(400).json({ error: "Email or username already exists" });
        }

        // Insert the new user
        const insertSql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
        db.run(insertSql, [lowerUsername, lowerEmail, hashedPassword], function (err) {
            if (err) {
                console.error("DB Error: ", err.message);
                return res.status(500).json({ error: "Failed to register user" });
            }
            req.session.user = { id: this.lastID, username: lowerUsername, email: lowerEmail };
            res.redirect('/');
        });
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

const uploadDir = path.join(__dirname, '/public/uploads/p');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
// Function to get a formatted date string
function getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
// Set up storage for multer

const storageP = multer.diskStorage({
    destination: function (req, file, cb) {
        const dateDir = getFormattedDate();
        const uploadPath = path.join(uploadDir, dateDir);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath); // Use the path variable
    },
    filename: function (req, file, cb) {
        let tempUsername = 'None';
        if (req.session.user.id) {
            tempUsername = req.session.user.username;
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + tempUsername + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadP = multer({ storage: storageP });
app.post('/backup-photos', uploadP.array('photos', 1000), (req, res) => {
    try {
        // Files are available in req.files
        console.log(req.files);

        // Update the backup status in the database
        let tempUsername = "None";
        if (!req.session.user.username) {
            console.log('no username found');
        } else {
            tempUsername = req.session.user.username;
        }

        db.run(`UPDATE users SET backup = 0 WHERE id = 1 AND username = ?`, [tempUsername], function (err) {
            if (err) {
                console.error("Failed to update backup status:", err.message);
                return res.status(500).json({ error: 'Failed to update backup status' });
            }

            res.status(200).json({
                message: 'Files uploaded successfully and backup status updated!',
                files: req.files
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// New API endpoint to check backup status
app.get('/check-backup-status', (req, res) => {
    let tempUsername = "None";
    if (!req.session.user.username) {
        console.log('no username found');
    } else {
        tempUsername = req.session.user.username;
    }
    db.get(`SELECT backup FROM users WHERE id = 1 AND username != ?`, [tempUsername], (err, row) => {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('backup status set to true');
        const needsBackup = row.backup === 1;
        res.status(200).json({ needsBackup: needsBackup });
    });
});



// Route to remove a disc
app.post('/remove-disc/:discId', (req, res) => {
    const discId = req.params.discId;

    const sql = `DELETE FROM discs WHERE id = ? AND user_id = ?`;
    db.run(sql, [discId, req.session.user.id], function (err) {
        if (err) {
            console.error("Database error:", err.message);
            res.status(500).send("Failed to remove disc due to database error.");
            return;
        }
        if (this.changes === 0) {
            res.status(404).send("Disc not found or not available for your account.");
            return;
        }
        res.json({ success: true });
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


app.post('/add-bag', checkAuthentication, (req, res) => {
    const { name, is_primary } = req.body;
    const userId = req.session.user.id;

    const sql = `INSERT INTO bags (user_id, name) VALUES (?, ?)`;
    db.run(sql, [userId, name], function (err) {
        if (err) {
            console.error("Database error when adding bag:", err.message);
            return res.status(500).send("Failed to add bag due to database error.");
        }
        res.redirect('/bag-management');
    });
});

app.delete('/remove-bag/:bagId', checkAuthentication, (req, res) => {
    const { bagId } = req.params;
    const userId = req.session.user.id;

    const sql = `DELETE FROM bags WHERE id = ? AND user_id = ?`;
    db.run(sql, [bagId, userId], function (err) {
        if (err) {
            console.error("Database error when removing bag:", err.message);

            return res.status(500).json({ success: false, message: "Failed to remove bag due to database error." });
        } else {
            db.run('DELETE FROM discs_bags WHERE bag_id = ?', [bagId], (err) => {
                if (err) {
                    console.error(err.message);
                } else {
                    console.log('Bag and associated discs removed successfully');
                }
            });
        }


        res.json({ success: true, message: "Bag removed successfully." });
    });
});


// Route to remove a disc from a bag
app.post('/remove-disc-from-bag/:bagId/:discId', checkAuthentication, (req, res) => {
    const { bagId, discId } = req.params;
    const sql = `DELETE FROM discs_bags WHERE bag_id = ? AND disc_id = ?`;
    db.run(sql, [bagId, discId], function (err) {
        if (err) {
            console.error("Database error when removing disc from bag:", err.message);
            return res.status(500).send("Failed to remove disc from bag due to database error.");
        }
        res.redirect(`/bag-details/${bagId}`);
    });
});

app.post('/new/remove-disc-from-bag/:bagId/:discId', checkAuthentication, (req, res) => {
    const { bagId, discId } = req.params;
    const sql = `DELETE FROM discs_bags WHERE bag_id = ? AND disc_id = ?`;
    db.run(sql, [bagId, discId], function (err) {
        if (err) {
            console.error("Database error when removing disc from bag:", err.message);
            return res.status(500).send("Failed to remove disc from bag due to database error.");
        }
        res.json({ success: true, message: "Disc successfully removed from the bag." });
    });
});

// Route to add a disc to a bag via AJAX
app.post('/new/add-disc-to-bag/:bagId/:discId', checkAuthentication, express.json(), (req, res) => {
    const { bagId, discId } = req.params;
    const sql = `INSERT INTO discs_bags (bag_id, disc_id) VALUES (?, ?)`;
    db.run(sql, [bagId, discId], function (err) {
        if (err) {
            console.error("Database error when adding disc to bag:", err.message);
            return res.status(500).json({ error: "Failed to add disc to bag due to database error." });
        }
        res.json({ success: true, message: "Disc added to bag successfully" });
    });
});
// Route to add a disc to a bag via AJAX
app.post('/add-disc-to-bag', checkAuthentication, express.json(), (req, res) => {
    const { bagId, discId } = req.body;
    const sql = `INSERT INTO discs_bags (bag_id, disc_id) VALUES (?, ?)`;
    db.run(sql, [bagId, discId], function (err) {
        if (err) {
            console.error("Database error when adding disc to bag:", err.message);
            return res.status(500).json({ error: "Failed to add disc to bag due to database error." });
        }
        res.json({ success: true, message: "Disc added to bag successfully" });
    });
});

app.get('/api/discs', (req, res) => {
    db.all('SELECT * FROM discs WHERE user_id = ?', [req.session.user.id], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
        console.log(req.session.userId);

        const discs = rows.map(row => {
            return {
                id: row.id,
                manufacturer: row.manufacturer,
                name: row.name,
                weight: row.weight,
                plastic_type: row.plastic_type,
                disc_type: row.disc_type,
                color: row.color,
                checked_out: row.checked_out,
                imageUrl: row.imageUrl,
                speed: row.speed,
                glide: row.glide,
                turn: row.turn,
                fade: row.fade,
                stability: row.stability,
                times_checked_out: row.times_checked_out,
                stats: JSON.parse(row.stats)
            };
        });
        console.log(discs);

        res.json(discs);
    });
});

app.put('/api/suggestions/:id/toggle', (req, res) => {
    const suggestionId = req.params.id;
    if (!req.session.user.is_admin) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const query = 'UPDATE suggestions SET completed = NOT completed WHERE id = ?';

    db.run(query, [suggestionId], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json({ success: true });
    });
});


app.get('/api/suggestions', checkAuthentication, (req, res) => {
    let query = "";
    let params = [];

    if (req.session.user.is_admin) {
        query = 'SELECT * FROM suggestions';
    } else {
        query = 'SELECT * FROM suggestions WHERE userId = ?';
        params = [req.session.user.id];
    }

    console.log(query);
    db.all(query, params.length ? params : [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const suggestions = rows.map(row => {
            return {
                id: row.id,
                username: row.username,
                suggestion: row.suggestion,
                completed: row.completed === 1
            };
        });
        console.log(suggestions);

        res.json(suggestions);
    });
});

app.delete('/delete-suggestion', checkAuthentication, (req, res) => {
    const text = req.query.text;
    const userId = req.session.user.id;

    const sql = `DELETE FROM suggestions WHERE suggestion = ? AND userId = ?`;
    db.run(sql, [text, userId], function (err) {
        if (err) {
            console.error("Database error when removing suggestion:", err.message);

            return res.status(500).json({ success: false, message: "Failed to remove suggestion due to database error." });
        }

        res.json({ success: true, message: "Suggestion removed successfully." });
    });
});



app.post('/toggle-bag-checkout/:bagId', checkAuthentication, (req, res) => {
    const bagId = req.params.bagId;
    const userId = req.session.user.id;  // Assuming `req.user` contains the authenticated user's info

    db.get(`SELECT checked_out FROM bags WHERE id = ? AND user_id = ?`, [bagId, userId], (err, bag) => {
        if (err) {
            console.error("Database error when fetching bag:", err);
            return res.status(500).send("Database error");
        }
        if (!bag) {
            return res.status(404).send("Bag not found");
        }

        if (bag.checked_out) {
            // If trying to check in, allow
            toggleBagCheckedOut(bag);
        } else {
            // If trying to check out, ensure no other bags are checked out
            db.get(`SELECT id FROM bags WHERE user_id = ? AND checked_out = 1`, [userId], (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).send("Database error");
                }
                if (result) {
                    return res.status(400).json({ success: false, message: "Another bag is already checked out." });
                } else {
                    toggleBagCheckedOut(bag);
                }
            });
        }
    });

    function toggleBagCheckedOut(bag) {
        const newCheckedOut = !bag.checked_out;
        db.run(`UPDATE bags SET checked_out = ? WHERE id = ?`, [newCheckedOut, bagId], function (err) {
            if (err) {
                console.error("Database error when updating bag checkout status:", err);
                return res.status(500).send("Failed to update bag checkout status.");
            }
            // Update all discs in the bag
            db.run(`UPDATE discs SET checked_out = ? WHERE id IN (SELECT disc_id FROM discs_bags WHERE bag_id = ?)`, [newCheckedOut, bagId], (err) => {
                if (err) {
                    console.error("Database error when updating discs checkout status:", err);
                    return res.status(500).send("Failed to update discs checkout status.");
                }
                // Respond with the new checked_out status
                res.json({ success: true, message: "Bag and discs checkout status updated successfully", checked_out: newCheckedOut });
            });
        });
    }
});

app.get('/get-bags', checkAuthentication, (req, res) => {
    const userId = req.session.user.id;
    const sql = 'SELECT * FROM bags WHERE user_id = ?';
    db.all(sql, [userId], (err, bags) => {
        if (err) {
            console.error('Error fetching bags:', err);
            res.status(500).json({ error: 'Failed to fetch bags' });
        } else {
            res.json(bags);
        }
    });
});



app.get('/bag-management', checkAuthentication, (req, res) => {
    const userId = req.session.user.id;
    const sql = `SELECT * FROM bags WHERE user_id = ?`;

    db.all(sql, [userId], (err, bags) => {
        if (err) {
            console.error("Database error when fetching bags:", err);
            return res.render('error', { message: 'Failed to load bags.' });
        }

        if (bags.length === 0) {
            return res.render('bag-management', { user: req.session.user, bags: [] });
        }

        let bagsWithDiscs = [];
        let completedRequests = 0;

        bags.forEach(bag => {
            const discsSql = `SELECT discs.* FROM discs JOIN discs_bags ON discs.id = discs_bags.disc_id WHERE discs_bags.bag_id = ?`;
            db.all(discsSql, [bag.id], (err, discs) => {
                if (err) {
                    console.error("Database error when fetching discs in bag:", err);
                    discs = [];
                }

                bag.discs = discs;
                bagsWithDiscs.push(bag);
                completedRequests++;

                if (completedRequests === bags.length) {
                    res.render('bag-management', { user: req.session.user, bags: bagsWithDiscs });
                }
            });
        });
    });
});


app.get('/bag-details/:bagId', checkAuthentication, (req, res) => {
    const bagId = req.params.bagId;
    db.get(`SELECT * FROM bags WHERE id = ? AND user_id = ?`, [bagId, req.session.user.id], (err, bag) => {
        if (err || !bag) {
            console.error("Database error or bag not found:", err);
            return res.status(404).send("Bag not found");
        }
        db.all(`SELECT discs.* FROM discs JOIN discs_bags ON discs.id = discs_bags.disc_id WHERE discs_bags.bag_id = ?`, [bagId], (err, discs) => {
            if (err) {
                console.error("Database error when fetching discs in bag:", err);
                return res.status(500).send("Failed to fetch discs");
            }
            res.render('bag-details', { user: req.session.user, bag: bag, discs: discs });
        });
    });
});

app.post('/set-primary-bag/:bagId', checkAuthentication, (req, res) => {
    const { bagId } = req.params;
    const userId = req.session.user.id;

    // Start a transaction to ensure data integrity
    db.serialize(() => {
        // Reset primary status for all bags of the user
        const resetPrimary = `UPDATE bags SET is_primary = 0 WHERE user_id = ?`;
        db.run(resetPrimary, [userId], function (err) {
            if (err) {
                console.error("Error resetting primary bags:", err.message);
                return res.status(500).json({ error: "Failed to update primary status." });
            }

            // Set the selected bag as the primary bag
            const setPrimary = `UPDATE bags SET is_primary = 1 WHERE id = ? AND user_id = ?`;
            db.run(setPrimary, [bagId, userId], function (err) {
                if (err) {
                    console.error("Error setting bag as primary:", err.message);
                    return res.status(500).json({ error: "Failed to set bag as primary." });
                }
                if (this.changes === 0) {
                    res.status(404).json({ error: "Bag not found or not available." });
                } else {
                    res.json({ success: true, message: "Primary bag updated successfully." });
                }
            });
        });
    });
});

// Assuming you have already defined your express app and database connection

// Route to check if a disc is in a bag
app.get('/check-disc-in-bag/:bagId/:discId', (req, res) => {
    const bagId = req.params.bagId;
    const discId = req.params.discId;

    const sql = `
        SELECT COUNT(*) AS count
        FROM discs_bags
        WHERE bag_id = ? AND disc_id = ?
    `;
    db.get(sql, [bagId, discId], (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            res.status(500).json({ success: false, error: 'Database error' });
            return;
        }

        if (row.count > 0) {
            // Disc is in the bag
            res.json({ success: true, inBag: true });
        } else {
            // Disc is not in the bag
            res.json({ success: true, inBag: false });
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



let dev = false;
if (dev) {
    // Start the HTTP server
    http.createServer(app).listen(DEVPORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${DEVPORT}/`);
    });
} else {
    const httpsOptions = {
        key: fs.readFileSync('/etc/letsencrypt/live/discvault.app/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/discvault.app/fullchain.pem')
    };

    const server = https.createServer(httpsOptions, app);
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on https://0.0.0.0:${PORT}/`);
    });

}


