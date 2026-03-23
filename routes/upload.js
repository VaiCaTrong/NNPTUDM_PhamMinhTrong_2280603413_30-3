var express = require("express");
var router = express.Router();
let { uploadImage, uploadExcel } = require('../utils/uploadHandler')
let path = require('path')
let excelJS = require('exceljs')
let fs = require('fs');
let productModel = require('../schemas/products')
let InventoryModel = require('../schemas/inventories')
let userModel = require('../schemas/users')
let roleModel = require('../schemas/roles')
let cartModel = require('../schemas/cart')
let mongoose = require('mongoose')
let slugify = require('slugify')
let { sendPasswordMail } = require('../utils/sendMailHandler')
let crypto = require('crypto')

router.post('/single', uploadImage.single('file'), function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file upload rong"
        })
    } else {
        res.send(req.file.path)
    }
})
router.post('/multiple', uploadImage.array('files'), function (req, res, next) {
    if (!req.files) {
        res.status(404).send({
            message: "file upload rong"
        })
    } else {
        let data = req.body;
        console.log(data);
        let result = req.files.map(f => {
            return {
                filename: f.filename,
                path: f.path,
                size: f.size
            }
        })
        res.send(result)
    }
})
router.get('/:filename', function (req, res, next) {
    let fileName = req.params.filename;
    let pathFile = path.join(__dirname, '../uploads', fileName)
    res.sendFile(pathFile)

})

router.post('/excel', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file upload rong"
        })
    } else {
        //workbook->worksheet-row/column->cell
        let pathFile = path.join(__dirname, '../uploads', req.file.filename)
        let workbook = new excelJS.Workbook();
        await workbook.xlsx.readFile(pathFile);
        let worksheet = workbook.worksheets[0];
        let products = await productModel.find({});
        let getTitle = products.map(p => p.title)
        let getSku = products.map(p => p.sku)
        let result = [];
        let errors = [];
        for (let index = 2; index <= worksheet.rowCount; index++) {
            let errorRow = [];
            const row = worksheet.getRow(index)
            let sku = row.getCell(1).value;//unique
            let title = row.getCell(2).value;
            let category = row.getCell(3).value;
            let price = Number.parseInt(row.getCell(4).value);
            let stock = Number.parseInt(row.getCell(5).value);
            //validate
            if (price < 0 || isNaN(price)) {
                errorRow.push("dinh dang price chua dung " + price)
            }
            if (stock < 0 || isNaN(stock)) {
                errorRow.push("dinh dang stock chua dung " + stock)
            }
            if (getTitle.includes(title)) {
                errorRow.push("title da ton tai")
            }
            if (getSku.includes(sku)) {
                errorRow.push("sku da ton tai")
            }
            if (errorRow.length > 0) {
                result.push({ success: false, data: errorRow })
                continue;
            } else {
                let session = await mongoose.startSession()
                session.startTransaction()
                try {
                    let newObj = new productModel({
                        sku: sku,
                        title: title,
                        slug: slugify(title, {
                            replacement: '-', remove: undefined,
                            locale: 'vi',
                            trim: true
                        }), price: price,
                        description: title,
                        category: category
                    })
                    let newProduct = await newObj.save({ session });
                    let newInv = new InventoryModel({
                        product: newProduct._id,
                        stock: stock
                    })
                    newInv = await newInv.save({ session })
                    await newInv.populate('product')
                    await session.commitTransaction();
                    await session.endSession()
                    getSku.push(sku);
                    getTitle.push(title)
                    result.push({ success: true, data: newInv });
                } catch (error) {
                    await session.abortTransaction();
                    await session.endSession()
                    errorRow.push(error.message)
                    result.push({ success: false, data: errorRow })
                }
            }
        }
        result = result.map(function (e, index) {
            if (e.success) {
                return (index + 1) + ": " + e.data.product.title
            } else {
                return (index + 1) + ": " + e.data
            }
        })
        res.send(result)
        fs.unlinkSync(pathFile);

    }
})


module.exports = router;

router.post('/import-users', uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        return res.status(404).send({
            message: "file upload rong"
        })
    }

    let pathFile = path.join(__dirname, '../uploads', req.file.filename)
    let workbook = new excelJS.Workbook();
    await workbook.xlsx.readFile(pathFile);
    let worksheet = workbook.worksheets[0];

    // Lấy role "user" 
    let userRole = await roleModel.findOne({ name: "USER" });
    if (!userRole) {
        fs.unlinkSync(pathFile);
        return res.status(400).send({ message: "Role USER not found. Please create it first." });
    }

    // Lấy danh sách username và email đã tồn tại
    let existingUsers = await userModel.find({});
    let existingUsernames = existingUsers.map(u => u.username);
    let existingEmails = existingUsers.map(u => u.email);

    let result = [];

    for (let index = 2; index <= worksheet.rowCount; index++) {
        let errorRow = [];
        const row = worksheet.getRow(index);
        
        // Xử lý username
        let usernameCell = row.getCell(1).value;
        let username = '';
        if (typeof usernameCell === 'string') {
            username = usernameCell.trim();
        } else if (usernameCell && typeof usernameCell === 'object' && usernameCell.text) {
            username = usernameCell.text.trim();
        } else if (usernameCell) {
            username = usernameCell.toString().trim();
        }
        
        // Xử lý email
        let emailCell = row.getCell(2).value;
        let email = '';
        
        // Debug: Log cấu trúc email cell
        console.log(`Row ${index} email cell:`, JSON.stringify(emailCell, null, 2));
        
        if (typeof emailCell === 'string') {
            email = emailCell.trim();
        } else if (emailCell && typeof emailCell === 'object' && emailCell.text) {
            email = emailCell.text.trim();
        } else if (emailCell && typeof emailCell === 'object' && emailCell.hyperlink) {
            email = emailCell.hyperlink.trim();
        } else if (emailCell && typeof emailCell === 'object' && emailCell.result) {
            // Trường hợp formula
            email = emailCell.result.toString().trim();
        } else if (emailCell) {
            email = emailCell.toString().trim();
        }

        // Validate
        if (!username || username === '') {
            errorRow.push("Username is required");
        }
        if (!email || email === '') {
            errorRow.push("Email is required");
        }
        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            errorRow.push("Invalid email format");
        }
        if (existingUsernames.includes(username)) {
            errorRow.push("Username already exists");
        }
        if (existingEmails.includes(email)) {
            errorRow.push("Email already exists");
        }

        if (errorRow.length > 0) {
            result.push({ success: false, row: index, username, email, errors: errorRow });
            continue;
        }

        // Generate random password 16 characters
        let password = crypto.randomBytes(8).toString('hex'); // 16 hex characters

        try {
            // Create user
            let newUser = new userModel({
                username: username,
                email: email,
                password: password,
                role: userRole._id
            });
            let savedUser = await newUser.save();

            // Create cart for user
            let newCart = new cartModel({
                user: savedUser._id
            });
            await newCart.save();

            // Send email with password
            try {
                await sendPasswordMail(email, username, password);
                result.push({ 
                    success: true, 
                    row: index, 
                    username, 
                    email, 
                    message: "User created and email sent successfully" 
                });
            } catch (emailError) {
                result.push({ 
                    success: true, 
                    row: index, 
                    username, 
                    email, 
                    message: "User created but email failed to send: " + emailError.message 
                });
            }

            existingUsernames.push(username);
            existingEmails.push(email);

        } catch (error) {
            errorRow.push(error.message);
            result.push({ success: false, row: index, username, email, errors: errorRow });
        }
    }

    // Format result
    let summary = result.map(function (e) {
        if (e.success) {
            return `Row ${e.row}: ✓ ${e.username} (${e.email}) - ${e.message}`;
        } else {
            return `Row ${e.row}: ✗ ${e.username || 'N/A'} (${e.email || 'N/A'}) - ${e.errors.join(', ')}`;
        }
    });

    res.send({
        total: result.length,
        success: result.filter(r => r.success).length,
        failed: result.filter(r => !r.success).length,
        details: summary
    });

    fs.unlinkSync(pathFile);
});
