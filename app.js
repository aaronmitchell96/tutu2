const express = require("express");
const multer = require("multer");
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const path = require('path');
const { Pool } = require("pg");
const dotenv = require("dotenv");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

dotenv.config();

const app = express();

// Configure AWS SDK
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

// Configure PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Set up session
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 60 * 60 * 1000 // 1 hour
    }
}));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Middleware to make session data available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Set up multer storage for S3
// Configure multer for S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME,
        acl: 'public-read',
        key: function (req, file, cb) {
            const filename = Date.now() + path.extname(file.originalname);
            cb(null, filename);
        },
         // Remove or set acl to undefined
        acl: undefined // or acl: null
    })
});


app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to restrict access to the upload route
function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send("Access denied");
    }
}

// Render the login page
app.get("/login", (req, res) => {
    res.render("login", { activePage: 'login' });
});

// Handle login form submission
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect("/gallery");
    } else {
        res.send("Invalid username or password");
    }
});

// Handle logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// Route to render home page
app.get("/", (req, res) => {
    console.log('AWS Config:', {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
      });
    res.render("home", { activePage: 'home' });
});

// Route to render upload page
app.get("/upload", requireAdmin, (req, res) => {
    res.render("upload", { activePage: 'upload' });
});

// Route to handle image upload
app.post("/upload", upload.single("image"), async (req, res) => {
    const { category, hatType, accessoryType, price, name, color, details, sizes, quantities } = req.body;
    let { gender } = req.body; // Change this to let
    const filename = req.file.key;  // Key from S3 response
    const filepath = req.file.location;  // S3 file URL
    let itemType = category === "hat" ? hatType : accessoryType;
    if (!gender) {
        gender = 'unisex';
    }

    try {
        // Start a transaction
        await pool.query('BEGIN');

        // Check for existing record
        const result = await pool.query(
            'SELECT id FROM images WHERE category = $1 AND (gender = $2 OR $2 IS NULL) AND type = $3 AND name = $4 AND parent_id IS NULL',
            [category, gender || null, itemType, name]
        );

        let parent_id = null;
        if (result.rows.length > 0) {
            parent_id = result.rows[0].id;
        }

        // Insert new image with or without parent_id
        const imageResult = await pool.query(
            'INSERT INTO images (filename, path, category, gender, type, price, name, color, details, parent_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
            [filename, filepath, category, gender, itemType, price, name, color, details, parent_id]
        );

        const imageId = imageResult.rows[0].id;

        // Insert sizes and quantities into sizes table
        const sizeQuantityPairs = sizes.map((size, index) => [imageId, size, quantities[index]]);

        const sizeQuery = `
            INSERT INTO sizes (product_id, size, quantity)
            VALUES ($1, $2, $3)
        `;

        for (const pair of sizeQuantityPairs) {
            await pool.query(sizeQuery, pair);
        }

        // Commit transaction
        await pool.query('COMMIT');

        res.send("Image uploaded with sizes");
    } catch (err) {
        // Rollback transaction on error
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Error uploading product");
    }
});

app.get('/api/hats', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, price, path FROM images');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching hats data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to render the gallery page
app.get("/gallery", async (req, res) => {
    const { category, gender, hatType, accessoryType, color, minPrice, maxPrice } = req.query;

    let baseQuery = `
        SELECT p.*, 
               c.id AS child_id, 
               c.filename AS child_filename, 
               c.path AS child_path, 
               c.category AS child_category, 
               c.gender AS child_gender, 
               c.type AS child_type, 
               c.price AS child_price, 
               c.name AS child_name, 
               c.color AS child_color, 
               c.details AS child_details, 
               c.parent_id AS child_parent_id 
        FROM images p
        LEFT JOIN images c ON p.id = c.parent_id
        WHERE p.parent_id IS NULL`;

    const params = [];

    // Filter parent images
    if (category) {
        baseQuery += ' AND p.category = $' + (params.length + 1);
        params.push(category);
    }
    if (gender) {
        baseQuery += ' AND p.gender = $' + (params.length + 1);
        params.push(gender);
    }
    if (hatType) {
        baseQuery += ' AND p.type = $' + (params.length + 1);
        params.push(hatType);
    }
    if (accessoryType) {
        baseQuery += ' AND p.type = $' + (params.length + 1);
        params.push(accessoryType);
    }
    if (color) {
        baseQuery += ' AND p.color ILIKE $' + (params.length + 1);
        params.push('%' + color + '%');
    }
    if (minPrice) {
        baseQuery += ' AND p.price >= $' + (params.length + 1);
        params.push(minPrice);
    }
    if (maxPrice) {
        baseQuery += ' AND p.price <= $' + (params.length + 1);
        params.push(maxPrice);
    }

    // Execute the parent query
    const parentResult = await pool.query(baseQuery, params);
    const parents = parentResult.rows;

    // Collect child images
    const childQuery = `
        SELECT * FROM images
        WHERE parent_id IS NOT NULL
        AND (
            (category = $1 OR $1 IS NULL) AND
            (gender = $2 OR $2 IS NULL) AND
            (type = $3 OR $3 IS NULL) AND
            (color ILIKE $4 OR $4 IS NULL) AND
            (price >= $5 OR $5 IS NULL) AND
            (price <= $6 OR $6 IS NULL)
        )
    `;
    const childParams = [
        category || null, 
        gender || null, 
        hatType || accessoryType || null, 
        color ? '%' + color + '%' : null, 
        minPrice || null, 
        maxPrice || null
    ];
    const childResult = await pool.query(childQuery, childParams);
    const children = childResult.rows;

    // Organize images into a hierarchy
    const imageMap = {};
    parents.forEach(parent => {
        imageMap[parent.id] = {
            ...parent,
            children: []
        };
    });

    children.forEach(child => {
        if (imageMap[child.parent_id]) {
            imageMap[child.parent_id].children.push(child);
        } else {
            // If the parent does not match the filter but the child does, create an entry for the child
            imageMap[child.id] = {
                ...child,
                children: []
            };
        }
    });

    const organizedImages = Object.values(imageMap).filter(image => {
        // Ensure we only display images that match the criteria
        const match = image.children.length > 0 || (category ? image.category === category : true) &&
            (gender ? image.gender === gender : true) &&
            (hatType || accessoryType ? image.type === (hatType || accessoryType) : true) &&
            (color ? image.color.toLowerCase().includes(color.toLowerCase()) : true) &&
            (minPrice ? image.price >= minPrice : true) &&
            (maxPrice ? image.price <= maxPrice : true);

        return match;
    });

    // Get distinct hat types
    const hatTypesResult = await pool.query('SELECT DISTINCT type FROM images WHERE category = $1', ['hat']);
    const hatTypes = hatTypesResult.rows.map(row => row.type);

    // Get distinct accessory types
    const accessoryTypesResult = await pool.query('SELECT DISTINCT type FROM images WHERE category = $1', ['accessory']);
    const accessoryTypes = accessoryTypesResult.rows.map(row => row.type);

    res.render("gallery", {
        images: organizedImages,
        activePage: 'gallery',
        category: category || '',
        gender: gender || '',
        hatType: hatType || '',
        accessoryType: accessoryType || '',
        color: color || '',
        minPrice: minPrice || '',
        maxPrice: maxPrice || '',
        hatTypes,
        accessoryTypes
    });
});

app.get('/hat-types', async (req, res) => {
    const result = await pool.query('SELECT DISTINCT type FROM images WHERE category = $1', ['hat']);
    const hatTypes = result.rows.map(row => row.type);
    res.json(hatTypes);
});

// Route to render image details page
app.get("/image/:id", async (req, res) => {
    try {
        const imageResult = await pool.query('SELECT * FROM images WHERE id = $1', [req.params.id]);
        const image = imageResult.rows[0];

        if (!image) {
            return res.status(404).send("Image not found");
        }

        let parentImage = null;
        if (image.parent_id) {
            const parentImageResult = await pool.query('SELECT * FROM images WHERE id = $1', [image.parent_id]);
            parentImage = parentImageResult.rows[0];
        }

        const parentId = image.parent_id ? image.parent_id : image.id;
        const childImagesResult = await pool.query('SELECT * FROM images WHERE parent_id = $1', [parentId]);
        const childImages = childImagesResult.rows;

        // Fetch sizes and quantities
        const sizesResult = await pool.query('SELECT size, quantity FROM sizes WHERE product_id = $1', [image.id]);
        const sizes = sizesResult.rows;

        res.render("image-details", { 
            image: image, 
            childImages: childImages, 
            parentImage: parentImage, 
            sizes: sizes, 
            activePage: 'image-details' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Route to handle image deletion with requireAdmin middleware
app.post("/image/:id/delete", requireAdmin, async (req, res) => {
    await pool.query('DELETE FROM images WHERE id = $1', [req.params.id]);
    res.redirect("/gallery");
});

app.get("/testpp", async (req, res) => {
    res.render("./testpp/index")
})

// Start server on the port defined by Heroku
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
