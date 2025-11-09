const nodemailer = require('nodemailer');

const sendEmail = async options => {
    // 1) Create a transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.OAUTH_EMAIL,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: process.env.OAUTH_REFRESH_TOKEN
        }
    });

    // 2) Define the email options
    const mailOptions = {
        from: process.env.OAUTH_EMAIL,
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
