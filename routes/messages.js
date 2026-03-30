var express = require("express");
var router = express.Router();
let messageModel = require("../schemas/messages");
let { checkLogin } = require('../utils/authHandler.js');
let { uploadImage } = require('../utils/uploadHandler');

// GET / - Lấy message cuối cùng của mỗi user mà user hiện tại có nhắn tin
router.get("/", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;

        // Lấy tất cả messages liên quan đến user hiện tại
        let messages = await messageModel.find({
            $or: [
                { from: currentUserId },
                { to: currentUserId }
            ],
            isDeleted: false
        }).populate('from to', 'username avatarUrl')
          .sort({ createdAt: -1 });

        // Tạo map để lưu message cuối cùng với mỗi user
        let lastMessages = new Map();

        messages.forEach(msg => {
            // Xác định user đối tác (không phải user hiện tại)
            let otherUserId = msg.from._id.toString() === currentUserId.toString() 
                ? msg.to._id.toString() 
                : msg.from._id.toString();

            // Chỉ lưu message đầu tiên (mới nhất) với mỗi user
            if (!lastMessages.has(otherUserId)) {
                lastMessages.set(otherUserId, msg);
            }
        });

        // Convert map thành array
        let result = Array.from(lastMessages.values());

        res.send(result);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// GET /:userID - Lấy toàn bộ message giữa user hiện tại và userID
router.get("/:userID", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let otherUserId = req.params.userID;

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: otherUserId },
                { from: otherUserId, to: currentUserId }
            ],
            isDeleted: false
        }).populate('from to', 'username avatarUrl')
          .sort({ createdAt: 1 }); // Sắp xếp từ cũ đến mới

        res.send(messages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// POST / - Gửi message mới
router.post("/", checkLogin, uploadImage.single('file'), async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let { to, text, type } = req.body;

        // Trim khoảng trắng
        if (to) to = to.trim();

        // Validate
        if (!to) {
            return res.status(400).send({ message: "Recipient (to) is required" });
        }

        let messageContent = {};

        // Nếu có file upload
        if (req.file) {
            messageContent.type = "file";
            messageContent.text = req.file.path;
        } 
        // Nếu là text
        else if (text && type === "text") {
            messageContent.type = "text";
            messageContent.text = text;
        } 
        else {
            return res.status(400).send({ message: "Message content is required (text or file)" });
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: to,
            messageContent: messageContent
        });

        let savedMessage = await newMessage.save();
        let populatedMessage = await messageModel
            .findById(savedMessage._id)
            .populate('from to', 'username avatarUrl');

        res.send(populatedMessage);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
