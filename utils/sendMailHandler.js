let nodemailer = require('nodemailer')
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false,
    auth: {
        user: "315776e1806ead",
        pass: "6f1a2660515627",
    },
});
module.exports = {
    sendMail: async function (to, url) {
        await transporter.sendMail({
            from: '"admin@" <admin@nnptud.com>',
            to: to,
            subject: "mail reset passwrod",
            text: "lick vo day de doi passs", // Plain-text version of the message
            html: "lick vo <a href=" + url + ">day</a> de doi passs", // HTML version of the message
        });
    },
    sendPasswordMail: async function (to, username, password) {
        await transporter.sendMail({
            from: '"Admin" <admin@nnptud.com>',
            to: to,
            subject: "Your Account Password",
            text: `Hello ${username},\n\nYour account has been created.\nUsername: ${username}\nPassword: ${password}\n\nPlease login and change your password.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Welcome to NNPTUD!</h2>
                        <p style="color: #555; font-size: 16px;">Hello <strong>${username}</strong>,</p>
                        <p style="color: #555; font-size: 14px;">Your account has been successfully created. Here are your login credentials:</p>
                        <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #4CAF50; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                            <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background-color: #e8e8e8; padding: 5px 10px; border-radius: 3px; font-size: 14px;">${password}</code></p>
                        </div>
                        <p style="color: #555; font-size: 14px;">Please login and change your password as soon as possible for security reasons.</p>
                        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            `
        });
    }
}