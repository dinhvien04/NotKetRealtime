const nodemailer = require("nodemailer");
const config = require("../config/env");

let transporter = null;

function isSmtpConfigured() {
  return Boolean(config.smtpHost && config.smtpFrom);
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth:
        config.smtpUser && config.smtpPass
          ? {
              user: config.smtpUser,
              pass: config.smtpPass
            }
          : undefined
    });
  }

  return transporter;
}

async function sendPasswordResetOtp({ to, otp, expiresMinutes }) {
  const subject = "Mã OTP đặt lại mật khẩu - Nối Kết Realtime";
  const text = [
    "Bạn đã yêu cầu đặt lại mật khẩu.",
    `Mã OTP: ${otp}`,
    `Mã có hiệu lực trong ${expiresMinutes} phút.`,
    "Nếu bạn không yêu cầu, hãy bỏ qua email này."
  ].join("\n");

  const transport = getTransporter();
  if (!transport) {
    if (!config.isProduction) {
      console.log(`[mailer:dev] OTP gửi tới ${to}: ${otp}`);
      return { ok: true, mode: "console" };
    }
    throw new Error("SMTP chưa được cấu hình.");
  }

  await transport.sendMail({
    from: config.smtpFrom,
    to,
    subject,
    text
  });

  return { ok: true, mode: "smtp" };
}

module.exports = {
  isSmtpConfigured,
  sendPasswordResetOtp
};